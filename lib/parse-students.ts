import * as XLSX from "xlsx";
import { recalcStudent, type ParseResult, type Student, type SubjectLine } from "@/types/student";

// Column index map (0-based) matching "student details LATEST.xlsx" (A–S).
// One row per SUBJECT; rows sharing a Serial No are one child → one invoice.
// A–H are fixed forever (the template guarantees it); everything from I on is
// the current billing layout. The old sheets had separate Material/Lesson
// adjustment pairs in K–N, which pushed the status columns out to O–U.
const COL = {
  serialNo:        0,   // A
  studentName:     1,   // B
  parentName:      2,   // C
  poc:             3,   // D
  level:           4,   // E
  subject:         5,   // F
  durationHrs:     6,   // G
  ratePerHour:     7,   // H
  lessons:         8,   // I
  adjustment:      9,   // J  — one figure, may be negative
  adjustmentNotes: 10,  // K  — internal only, never printed
  invoiceIssued:   11,  // L
  paid:            12,  // M
  dateOfReceipt:   13,  // N
  receiptIssued:   14,  // O
  differentEndDate:15,  // P
  backedUp:        16,  // Q
  receiptSent:     17,  // R
} as const;

type Row = (string | number | boolean | null | undefined)[];

function cellVal(row: Row, idx: number): string {
  const v = row[idx];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numVal(row: Row, idx: number): number {
  const v = row[idx];
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/** Like numVal but returns `dflt` only for a genuinely BLANK cell. A typed `0`
 *  stays 0. This matters for Lessons: a blank cell means "standard term, 12
 *  lessons", but an explicit 0 means "not enrolled this term" (e.g. a student
 *  added to Master for a future term) and must bill nothing — `numVal(...) || 12`
 *  would wrongly turn that 0 back into 12. */
function numValOr(row: Row, idx: number, dflt: number): number {
  const v = row[idx];
  if (v === null || v === undefined || v === "") return dflt;
  const n = Number(v);
  return isNaN(n) ? dflt : n;
}

/** Excel silently converts typed dates ("13/7/26") into date cells, which reach
 *  us as day serials (e.g. 46216) — and those would print verbatim on receipts.
 *  For the free-text status columns, turn plausible serials (2020–2064) back
 *  into dd/mm/yy text. Anything else falls through unchanged. */
function dateVal(row: Row, idx: number): string {
  const v = row[idx];
  if (typeof v === "number" && v >= 43831 && v < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear()).slice(2)}`;
  }
  return cellVal(row, idx);
}

/** The workbook holds a "Master" tab (identity columns A–H, the single place a
 *  child is ever typed in) followed by one tab per term. Billing always comes
 *  from a TERM tab — never Master, which has no fees on it and would silently
 *  produce invoices with defaulted lessons and nobody marked paid.
 *  The active term is the first tab after Master. */
export const MASTER_SHEET = "Master";

export function isMasterSheet(name: string): boolean {
  return name.trim().toLowerCase() === MASTER_SHEET.toLowerCase();
}

/** First tab that isn't Master; falls back to the first tab for older
 *  single-sheet workbooks that have no Master at all. */
export function activeTermSheet(names: string[]): string {
  return names.find((n) => !isMasterSheet(n)) ?? names[0];
}

/** Every term tab (all sheets except Master), in workbook/tab order. Falls back
 *  to all sheet names for older single-sheet workbooks that have no Master.
 *  This is what the term picker on the invoice/receipt pages lists — so as the
 *  admin adds term tabs over time, they appear automatically. */
export function listTermSheets(names: string[]): string[] {
  const terms = names.filter((n) => !isMasterSheet(n));
  return terms.length ? terms : names;
}

/** Parse one term tab. `requestedSheet` picks a specific tab (e.g. from the
 *  term dropdown); it is only honoured when it's a real, non-Master tab —
 *  otherwise we fall back to the active term. Master is never parsed for
 *  billing (it has no fees). */
export function parseWorkbook(buffer: Buffer, requestedSheet?: string): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const termSheets = listTermSheets(wb.SheetNames);
  const sheetName =
    requestedSheet && termSheets.includes(requestedSheet)
      ? requestedSheet
      : activeTermSheet(wb.SheetNames);
  const ws = wb.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const errors: string[] = [];
  const students: Student[] = [];
  const seenSerials = new Set<number>();

  // Build the subject line for a data row.
  function buildLine(row: Row, rowNum: number, name: string): SubjectLine {
    const ratePerHour = numVal(row, COL.ratePerHour);
    if (ratePerHour === 0) {
      errors.push(`Row ${rowNum} (${name}): missing Per Hour Rate`);
    }
    return {
      subject:      cellVal(row, COL.subject),
      durationHrs:  numValOr(row, COL.durationHrs, 2),
      ratePerHour,
      lessons:      numValOr(row, COL.lessons, 12),
      adjustment:      numVal(row, COL.adjustment),
      adjustmentNotes: cellVal(row, COL.adjustmentNotes),
      lessonFee: 0,
      subtotal: 0,
    };
  }

  // A row carries subject content if it has a subject name or any fee/rate data.
  function hasSubjectData(row: Row): boolean {
    return (
      cellVal(row, COL.subject) !== "" ||
      numVal(row, COL.ratePerHour) !== 0 ||
      numVal(row, COL.adjustment) !== 0 ||
      numVal(row, COL.lessons) !== 0
    );
  }

  let current: Student | null = null; // the child rows are currently attaching to

  // Row 0 = headers, data starts at row 1
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;

    const studentName = cellVal(row, COL.studentName);

    // ── Continuation row (merged/blank Student Name) = another subject for the child above ──
    if (!studentName) {
      if (!hasSubjectData(row)) continue; // truly empty filler row
      if (!current) {
        errors.push(`Row ${i + 1}: subject data with no student name above it — skipped. Put the child's name on the first row.`);
        continue;
      }
      current.subjects.push(buildLine(row, i + 1, current.studentName));
      // Child-level fields (level, status) may sit only on the top row; fill any still-empty here.
      if (!current.level) current.level = cellVal(row, COL.level);
      for (const f of ["invoiceIssued", "paid", "dateOfReceipt", "receiptIssued", "differentEndDate", "backedUp", "receiptSent"] as const) {
        if (!current[f]) current[f] = dateVal(row, COL[f]);
      }
      continue;
    }

    // ── New child ──
    const serialNo = numVal(row, COL.serialNo);
    if (serialNo > 0 && seenSerials.has(serialNo)) {
      errors.push(
        `Row ${i + 1} ("${studentName}"): serial ${serialNo} was already used above. ` +
        `If this is the same child's extra subject, leave the Student Name cell blank (or merge it) instead of repeating the name.`
      );
    }
    if (serialNo > 0) seenSerials.add(serialNo);

    current = {
      serialNo,
      studentName,
      parentName:      cellVal(row, COL.parentName),
      poc:             cellVal(row, COL.poc),
      level:           cellVal(row, COL.level),
      subjects: [buildLine(row, i + 1, studentName)],
      invoiceIssued:   dateVal(row, COL.invoiceIssued),
      paid:            dateVal(row, COL.paid),
      dateOfReceipt:   dateVal(row, COL.dateOfReceipt),
      receiptIssued:   dateVal(row, COL.receiptIssued),
      differentEndDate:dateVal(row, COL.differentEndDate),
      backedUp:        dateVal(row, COL.backedUp),
      receiptSent:     dateVal(row, COL.receiptSent),
      totalFee: 0,
    };
    students.push(current);
  }

  return {
    sheetName,
    students: students.map(recalcStudent),
    errors,
    sheetNames: termSheets,
  };
}
