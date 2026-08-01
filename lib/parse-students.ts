import * as XLSX from "xlsx";
import {
  normalizeStudentId, isAppStudentId, recalcStudent,
  type ParseResult, type Student, type SubjectLine,
} from "@/types/student";

// Column index map (0-based) matching "student details LATEST.xlsx" (A–R).
// One row per SUBJECT; rows sharing a Serial No are one child → one invoice.
// A–H are fixed forever (the template guarantees it); everything from I on is
// the current billing layout. Older sheets had a separate Material Fee column
// and split Material/Lesson adjustments, which pushed status further right.
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
  studentId:       18,  // S — permanent ID, formula-linked to Master column I
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

/** A broken identity cell (#REF!/#N/A etc.) means this row's formula link to
 *  Master was severed — the classic leftover of a deleted Master row. Excel
 *  errors reach us as their display text. */
function isErrorText(s: string): boolean {
  return /^#(REF|N\/A|VALUE|NAME|DIV\/0|NULL|NUM)[!?]?$/i.test(s.trim());
}

/** "INV-AY26T4-S007 · 01/08/26" or "R-AY26T4-S007 · 14/07/26" → the stamp's
 *  term slug and Student ID. Stamps written by the app carry both, which lets
 *  us verify a status cell still sits on the row of the child it was issued to
 *  AND on the term tab it was issued for. Null for stamps without an ID (e.g.
 *  a plain "Yes" or hand-typed text). */
function stampInfo(cellText: string): { slug: string; studentId: string } | null {
  const m = cellText.match(/\b(?:INV|R)-([A-Z0-9]+)-(S\d+)\b/i);
  return m ? { slug: m[1].toUpperCase(), studentId: normalizeStudentId(m[2]) } : null;
}

/** Same slug rule as billing-store's termSlug (kept inline — billing-store
 *  pulls in fs, which this parser must stay free of). */
function sheetSlug(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "TERM";
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

/** Did the RELATIVE ORDER of students change between two refreshes?
 *
 *  Deleting or adding students keeps everyone else's order — but sorting (or
 *  cutting-and-pasting rows around) on Master reshuffles which student each
 *  term-tab row mirrors while the term data stays put, silently attaching
 *  lessons/fees/statuses to the wrong children. Stamped rows get caught by the
 *  stamp checks; this catches the sort itself, stamps or not. Compares only
 *  IDs present in both lists, so normal add/remove churn never trips it. */
export function idOrderChanged(prevIds: string[], currIds: string[]): boolean {
  const currSet = new Set(currIds);
  const prevSet = new Set(prevIds);
  if (currSet.size !== currIds.length) return false; // duplicate IDs — other checks own this
  const prevCommon = prevIds.filter((id) => currSet.has(id));
  const currCommon = currIds.filter((id) => prevSet.has(id));
  if (prevCommon.length < 2) return false;
  return prevCommon.join("\n") !== currCommon.join("\n");
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
  const masterName = wb.SheetNames.find(isMasterSheet);
  const mastersheet = masterName ? wb.Sheets[masterName] : undefined;

  const raw = XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const errors: string[] = [];
  const students: Student[] = [];
  const seenSerials = new Set<number>();
  const seenIds = new Map<string, string>(); // studentId → first student name using it

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

    // ── Leftover of a deleted Master row: identity formulas broken (#REF!) but
    // the static status columns still hold the deleted child's data. Surface it
    // for cleanup rather than mis-attaching that data to a neighbour. ──
    if (isErrorText(studentName)) {
      errors.push(
        `Row ${i + 1}: broken link to Master (${studentName}) — this looks like a leftover row from a ` +
        `deleted student. Delete this row on this tab (right-click the row number → Delete).`
      );
      current = null; // whatever follows must not attach to the deleted child
      continue;
    }

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

    const studentId = normalizeStudentId(cellVal(row, COL.studentId));
    if (studentId) {
      const usedBy = seenIds.get(studentId);
      if (usedBy) {
        errors.push(
          `Row ${i + 1} ("${studentName}"): Student ID ${studentId} is already used by "${usedBy}" above — ` +
          `every child must have their own ID. Fix the Student ID column on Master (never copy-drag or reuse IDs).`
        );
      } else {
        seenIds.set(studentId, studentName);
      }
      if (!isAppStudentId(studentId) && !isErrorText(studentId)) {
        errors.push(
          `Row ${i + 1} ("${studentName}"): Student ID "${studentId}" isn't the app's format (S001, S002…). ` +
          `Clear the cell on Master and let the app assign one (close Excel, press Refresh).`
        );
      }
    }

    current = {
      studentId: isErrorText(studentId) ? "" : studentId,
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

  // ── Identity safety checks ────────────────────────────────────────────────
  // Missing IDs: the child can't be safely invoiced/receipted until the app
  // assigns one (done automatically on refresh while the file isn't open in
  // Excel — see assignMissingStudentIds).
  const noId = students.filter((s) => !s.studentId).map((s) => s.studentName);
  if (noId.length > 0) {
    errors.push(
      `${noId.length} student(s) have no Student ID yet (${noId.slice(0, 3).join(", ")}${noId.length > 3 ? "…" : ""}). ` +
      `Close the spreadsheet in Excel and press Refresh — the app will assign IDs automatically.`
    );
  }
  // Stamp checks: app-written stamps carry the child's Student ID and the term
  // they were issued for. Two things can silently go wrong on a sheet, and both
  // leave fingerprints in the stamps:
  //  • rows shifted (Master sorted / a half-done deletion) → stamp ID ≠ row ID;
  //  • a term tab copied from a filled term without clearing I–R → stamp slug ≠
  //    this tab's slug, and every child looks already-invoiced.
  const slug = sheetSlug(sheetName);
  for (const s of students) {
    if (!s.studentId) continue;
    for (const [field, label] of [["invoiceIssued", "Invoice Issued"], ["receiptIssued", "Receipt Issued"]] as const) {
      const stamp = stampInfo(s[field]);
      if (!stamp) continue;
      if (stamp.studentId !== s.studentId) {
        errors.push(
          `"${s.studentName}" (${s.studentId}): the ${label} mark on their row belongs to ${stamp.studentId} — ` +
          `the sheet's rows look shifted (was Master sorted or a row half-deleted?). Don't generate anything for this term ` +
          `until the rows are back in place — restore an earlier version of the file if unsure (Drive keeps version history).`
        );
      } else if (stamp.slug !== slug) {
        errors.push(
          `"${s.studentName}": the ${label} mark on this tab is from ${stamp.slug}, not ${slug} — ` +
          `this tab was probably copied from an old term without clearing columns I–R. Clear I–R (rows 2 down) on this tab.`
        );
      }
    }
  }

  // Roster completeness: every child on Master should appear on the ACTIVE term
  // tab (identity columns are mirrored by formulas). If someone is on Master but
  // invisible here, a row was inserted into the middle of Master (the mirror
  // formulas skew and the new row has no mirror), or their term-tab row was
  // deleted. Either way they'd silently never be billed — say so.
  if (mastersheet && sheetName === activeTermSheet(wb.SheetNames)) {
    const termIds   = new Set(students.map((s) => s.studentId).filter(Boolean));
    const termNames = new Set(students.map((s) => s.studentName.trim().toLowerCase()));
    const missing: string[] = [];
    const mRaw = XLSX.utils.sheet_to_json<Row>(mastersheet, { header: 1, defval: "", blankrows: false });
    for (let i = 1; i < mRaw.length; i++) {
      const name = cellVal(mRaw[i], COL.studentName);
      if (!name || isErrorText(name)) continue;
      const id = normalizeStudentId(cellVal(mRaw[i], 8)); // Master column I
      const onTerm = id ? termIds.has(id) : termNames.has(name.trim().toLowerCase());
      if (!onTerm) missing.push(name);
    }
    if (missing.length > 0) {
      errors.push(
        `${missing.length} student(s) on Master are NOT appearing on this term tab (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}) ` +
        `— they would never be billed. This happens when a row is inserted into the MIDDLE of Master (always add new students at the bottom) ` +
        `or when their row on this tab was deleted. Move them to the bottom of Master, or restore an earlier version of the file.`
      );
    }
  }

  return {
    sheetName,
    students: students.map(recalcStudent),
    errors,
    sheetNames: termSheets,
  };
}
