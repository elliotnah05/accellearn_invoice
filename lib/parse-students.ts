import * as XLSX from "xlsx";
import {
  normalizeStudentId, isAppStudentId, recalcStudent,
  type ParseResult, type RosterGap, type Student, type SubjectLine,
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

/**
 * Sheet rows (1-based) whose identity cells hold an Excel error — the husk a
 * term tab keeps when the student's row is deleted from Master.
 *
 * This is the normal, expected result of removing a student: the admin deletes
 * the row on Master (the one place a student is typed), and Excel repoints
 * every OTHER term row's formula along with its student, so the rest of the
 * tab stays correctly matched. Only the departed student's own row breaks, and
 * it breaks visibly, as #REF!.
 *
 * Those rows must be skipped outright. Their identity resolves to nothing while
 * their old typed term data (lessons, fees, status marks) is still sitting
 * there, so treating one as a normal row would silently bill it — and because
 * its name cell reads blank, the plain continuation rule would otherwise hand
 * that data to the child above as an extra subject.
 *
 * sheet_to_json flattens error cells to "", which is exactly why this reads the
 * raw cells instead: an error cell is type "e" and is unambiguous.
 */
function brokenLinkRows(ws: XLSX.WorkSheet): Set<number> {
  const rows = new Set<number>();
  const ref = ws["!ref"];
  if (!ref) return rows;
  const range = XLSX.utils.decode_range(ref);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (const c of [COL.studentName, COL.studentId] as number[]) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as { t?: string } | undefined;
      if (cell && cell.t === "e") {
        rows.add(r + 1);
        break;
      }
    }
  }
  return rows;
}

/** Is this tab still mirroring Master (identity columns are formulas), or is it
 *  a frozen past term whose formulas were turned into plain values? A frozen
 *  term must never be topped up with students who joined later.
 *
 *  Only NAMED rows are checked: a formula that evaluates to blank is stored
 *  with no value, and SheetJS drops such cells entirely — so blank mirror rows
 *  are invisible here, and only the ones showing a name can be relied on. */
function isLinkedTab(ws: XLSX.WorkSheet, lastRow: number): boolean {
  for (let r = 1; r < lastRow; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: COL.studentName })] as { f?: string } | undefined;
    if (cell?.f && /Master!/i.test(cell.f)) return true;
  }
  return false;
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

  // blankrows:true keeps index alignment with real sheet rows (raw[i] is sheet
  // row i+1), so reported row numbers match what the admin sees in Excel and
  // the orphan-row lookup below can be keyed by row number. Blank rows are
  // still skipped by the loop itself.
  const raw = XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: "",
    blankrows: true,
  });
  const orphanRows = brokenLinkRows(ws);

  const errors: string[] = [];
  const students: Student[] = [];
  const seenSerials = new Set<number>();
  const seenIds = new Map<string, string>(); // studentId → first student name using it
  const leftoverRows: number[] = [];         // rows left behind by a deletion on Master

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

  // Identity (A–H) is mirrored from Master. A row with a blank name but a
  // subject/rate is one of a child's extra subjects; a row with NOTHING in B–H
  // mirrors a Master row that is empty — nobody. Column A is deliberately left
  // out: it's a running count, not identity, and a stale one would make an
  // empty row look occupied.
  function hasIdentityData(row: Row): boolean {
    for (let c = COL.studentName; c <= COL.ratePerHour; c++) {
      if (cellVal(row, c) !== "") return true;
    }
    return false;
  }

  // I–R: this term's own typed data (lessons, fees, payment/receipt marks).
  function hasTermData(row: Row): boolean {
    for (let c = COL.lessons; c <= COL.receiptSent; c++) {
      if (cellVal(row, c) !== "") return true;
    }
    return false;
  }

  let current: Student | null = null; // the child rows are currently attaching to

  // Row 0 = headers, data starts at row 1
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;

    const studentName = cellVal(row, COL.studentName);

    // ── Leftover row from a student deleted on Master. Skipped entirely: it is
    // billed to nobody and, crucially, is NOT offered to the child above as an
    // extra subject. `current` is deliberately left untouched so that deleting
    // one subject of a multi-subject child doesn't detach their remaining
    // subject rows. ──
    if (orphanRows.has(i + 1) || isErrorText(studentName)) {
      leftoverRows.push(i + 1);
      continue;
    }

    // ── Continuation row (merged/blank Student Name) = another subject for the child above ──
    if (!studentName) {
      // Identity blank right across A–H: this row mirrors an empty Master row.
      // If it still holds term data, that data belonged to a student whose
      // Master row was CLEARED rather than deleted (clearing leaves the link
      // intact, so there's no #REF! to spot it by). It must not be read as an
      // extra subject for the child above — that would silently move a departed
      // student's lessons and fees onto their invoice.
      if (!hasIdentityData(row)) {
        if (hasTermData(row)) leftoverRows.push(i + 1);
        continue;
      }
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

  // Leftover rows are the normal trace of removing a student on Master. They
  // are already excluded from billing, so this is housekeeping, not a fault —
  // worded that way so it doesn't read as something being wrong.
  if (leftoverRows.length > 0) {
    errors.push(
      `Tidy-up only (nothing is wrong): ${leftoverRows.length} empty row(s) left over from student(s) you removed. ` +
      `Nobody is billed from them. The app clears them for you automatically — if you can still see them in Excel, ` +
      `close the spreadsheet and press Refresh.`
    );
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

  // Roster completeness: every row on Master should have a row on this term tab
  // mirroring it. A student added in the MIDDLE of Master has none — Excel
  // shifts the existing links down along with the students they point at, but
  // it never creates a row for the newcomer, so they'd silently never be
  // billed. Matched by link, not by name: two children can share a name, and a
  // renamed child must still count as the same row.
  //
  // Only linked tabs are checked. A frozen past term (freeze-term.js turns its
  // formulas into values) legitimately has no links and must not gain students.
  const rosterGaps: RosterGap[] = [];
  if (mastersheet && isLinkedTab(ws, raw.length)) {
    // Read Master the same way a term tab is read: a named row starts a child,
    // rows under it with a subject but no name are that child's extra subjects.
    // blankrows:true keeps mMaster[i] on sheet row i+1, so reported row numbers
    // are the ones the admin sees.
    const mRaw = XLSX.utils.sheet_to_json<Row>(mastersheet, { header: 1, defval: "", blankrows: true });
    const masterChildren: { row: number; name: string; id: string; subjectRows: number[] }[] = [];
    for (let i = 1; i < mRaw.length; i++) {
      const mRow = mRaw[i];
      if (!mRow) continue;
      const name = cellVal(mRow, COL.studentName);
      if (name && !isErrorText(name)) {
        masterChildren.push({
          row: i + 1,
          name,
          id: normalizeStudentId(cellVal(mRow, 8)), // Master column I
          subjectRows: [i + 1],
        });
        continue;
      }
      // Extra-subject row: subject/duration/rate typed with no name of its own.
      const last = masterChildren[masterChildren.length - 1];
      const isSubjectRow =
        cellVal(mRow, COL.subject) !== "" || numVal(mRow, COL.ratePerHour) !== 0 || numVal(mRow, COL.durationHrs) !== 0;
      if (last && isSubjectRow) last.subjectRows.push(i + 1);
    }

    // Matched on the mirrored VALUES, not on the link formulas: a formula whose
    // result is blank isn't stored in the file at all, so half the links are
    // invisible from this side. Student ID first (permanent), name second (a
    // child added just now has no ID until the app assigns one).
    const byId = new Map(students.filter((s) => s.studentId).map((s) => [s.studentId, s]));
    const byName = new Map(students.map((s) => [s.studentName.trim().toLowerCase(), s]));
    for (const child of masterChildren) {
      const onTerm = (child.id && byId.get(child.id)) || byName.get(child.name.trim().toLowerCase());
      if (!onTerm) {
        rosterGaps.push({ masterRow: child.row, name: child.name });
      } else if (onTerm.subjects.length < child.subjectRows.length) {
        // The child is there but one of their subjects isn't — a subject row
        // added on Master under an existing student.
        for (const row of child.subjectRows.slice(onTerm.subjects.length)) {
          rosterGaps.push({ masterRow: row, name: child.name });
        }
      }
    }

    if (rosterGaps.length > 0) {
      const named = [...new Set(rosterGaps.map((g) => g.name).filter(Boolean))];
      errors.push(
        `Tidy-up only (nothing is wrong): ${named.length} student(s) you added on Master ` +
        `(${named.slice(0, 3).join(", ")}${named.length > 3 ? "…" : ""}) aren't on this term tab yet. ` +
        `The app adds them for you automatically — if they're still missing, close the spreadsheet in Excel and press Refresh.`
      );
    }
  }

  return {
    sheetName,
    students: students.map(recalcStudent),
    errors,
    sheetNames: termSheets,
    rosterGaps,
    leftoverRows,
  };
}
