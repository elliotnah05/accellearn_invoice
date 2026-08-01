/** One subject line for a child — one Excel row. A child with Math + Science
 *  has two SubjectLines under a single Student (same Serial No). */
export interface SubjectLine {
  subject: string;
  durationHrs: number;
  ratePerHour: number;
  lessons: number;
  /** One combined adjustment (was separate material + lesson adjustments).
   *  Positive adds to the bill, negative discounts it. */
  adjustment: number;
  /** Admin's internal reason for the adjustment — never printed on the invoice. */
  adjustmentNotes: string;
  // Calculated
  lessonFee: number;   // ratePerHour * durationHrs * lessons
  subtotal: number;    // lessonFee + adjustment
}

/** A child = one invoice = one receipt. Grouped from Excel rows sharing a Serial No. */
export interface Student {
  /** Permanent identity (e.g. "S007"), from the Student ID column. Assigned once,
   *  never reused, survives row deletion/renumbering. Everything that must match
   *  a child across time — ledger keys, receipt/invoice numbers, Excel write-back
   *  — keys on this. Empty string until the app assigns one (new Master row). */
  studentId: string;
  /** Positional display number from column A. Renumbers when rows are added or
   *  removed, so it must never be used to identify a child — cosmetic only. */
  serialNo: number;
  studentName: string;
  parentName: string;
  poc: string;           // WhatsApp number
  level: string;
  subjects: SubjectLine[];
  // Status columns (taken from the child's first row; first non-empty wins)
  invoiceIssued: string;
  paid: string;
  dateOfReceipt: string;
  receiptIssued: string;
  differentEndDate: string;
  backedUp: string;
  receiptSent: string;
  // Calculated
  totalFee: number;      // sum of subject subtotals
}

/** A row on Master that this term tab has no mirror row for — a student the
 *  admin added, typically in the middle of the list next to others of their
 *  level. Until a row is added they can't be billed, so the app creates it. */
export interface RosterGap {
  masterRow: number;
  /** Blank for an extra-subject row (the child's name sits on the row above). */
  name: string;
}

export interface ParseResult {
  sheetName: string;
  students: Student[];
  errors: string[];
  /** Every term tab in the workbook (all sheets except Master), in tab order —
   *  drives the term picker so it reflects whatever tabs currently exist. */
  sheetNames: string[];
  /** Master rows with no row on this term tab yet (see RosterGap). Empty on a
   *  frozen term tab, which is deliberately never topped up. */
  rosterGaps: RosterGap[];
  /** Sheet rows (1-based) left behind by a student removed on Master: a broken
   *  #REF! row, or a nameless row still holding their term data. Billed to
   *  nobody; the app tidies them away. */
  leftoverRows: number[];
  /** Whether the PARSED tab's identity columns (A–H) are still formula-linked
   *  to Master, i.e. this is a live term and not a frozen past one. Frozen
   *  tabs hold plain values, so they never surface leftoverRows/rosterGaps of
   *  their own — a caller that only reacts to leftoverRows on the parsed tab
   *  misses husk rows sitting on other, still-linked tabs while a frozen tab
   *  is the one being viewed. */
  masterLinked: boolean;
  /** Whether the workbook has a Master tab at all (false only for very old,
   *  single-sheet workbooks that predate it — see v0.4.0). */
  hasMaster: boolean;
}

export function recalcLine(l: SubjectLine): SubjectLine {
  const lessonFee = l.ratePerHour * l.durationHrs * l.lessons;
  const subtotal  = lessonFee + l.adjustment;
  return { ...l, lessonFee, subtotal };
}

export function recalcStudent(s: Student): Student {
  const subjects = s.subjects.map(recalcLine);
  return { ...s, subjects, totalFee: subjects.reduce((t, l) => t + l.subtotal, 0) };
}

export function totalLessons(s: Student): number {
  return s.subjects.reduce((t, l) => t + l.lessons, 0);
}

/** "12 Mathematics and 12 Science" — for the receipt's acknowledgment line. */
export function lessonsText(s: Student): string {
  return s.subjects.map((l) => `${l.lessons} ${l.subject}`.trim()).join(" and ");
}

export function subjectsText(s: Student): string {
  return s.subjects.map((l) => l.subject).filter(Boolean).join(", ");
}

/** One canonical spelling for a Student ID, so a hand-edited "s7" or "S07 "
 *  still matches the "S007" in stamps, ledger keys and receipt numbers.
 *  App-format IDs are padded to 3+ digits; anything else (including empty)
 *  is just trimmed/uppercased so it can still be flagged by validation. */
export function normalizeStudentId(id: string): string {
  const s = (id ?? "").trim().toUpperCase();
  const m = s.match(/^S0*(\d+)$/);
  return m ? `S${m[1].padStart(3, "0")}` : s;
}

/** True for IDs the app itself would assign (S001, S002 …). Anything else was
 *  typed by hand and deserves a warning before it gets baked into documents. */
export function isAppStudentId(id: string): boolean {
  return /^S\d{3,}$/.test(normalizeStudentId(id));
}
