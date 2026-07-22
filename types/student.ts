/** One subject line for a child — one Excel row. A child with Math + Science
 *  has two SubjectLines under a single Student (same Serial No). */
export interface SubjectLine {
  subject: string;
  durationHrs: number;
  ratePerHour: number;
  lessons: number;
  materialFee: number;
  /** One combined adjustment (was separate material + lesson adjustments).
   *  Positive adds to the bill, negative discounts it. */
  adjustment: number;
  /** Admin's internal reason for the adjustment — never printed on the invoice. */
  adjustmentNotes: string;
  // Calculated
  lessonFee: number;   // ratePerHour * durationHrs * lessons
  subtotal: number;    // lessonFee + materialFee + adjustment
}

/** A child = one invoice = one receipt. Grouped from Excel rows sharing a Serial No. */
export interface Student {
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

export interface ParseResult {
  sheetName: string;
  students: Student[];
  errors: string[];
}

export function recalcLine(l: SubjectLine): SubjectLine {
  const lessonFee = l.ratePerHour * l.durationHrs * l.lessons;
  const subtotal  = lessonFee + l.materialFee + l.adjustment;
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
