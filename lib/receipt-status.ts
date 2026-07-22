import type { Student } from "@/types/student";

// Reading receipt state back out of the master spreadsheet.
//
// The local ledger (lib/billing-store.ts) is only a cache on one machine. The
// spreadsheet is the real record: generating a receipt stamps column R and
// Mark as Sent stamps column U, and that file lives in the shared Drive folder,
// so every admin's computer sees the same history. Parsing those columns back
// is what lets a fresh install — a new admin, or the owner after handover —
// still know a receipt was already issued and warn before re-issuing it.
//
// Pure functions only (no fs), so both the client page and the API route can
// import this.

export interface ReceiptState {
  receiptNo: string;
  /** Display date the receipt was issued, dd/mm/yy. */
  issued: string;
  /** Display date it was sent to the parent, dd/mm/yy. Empty if not sent. */
  sent: string;
}

/** Column R: "R-AY26T3-015 · 14/07/26" → { receiptNo, date }. Null if blank. */
export function parseIssuedCell(value: string | undefined): { receiptNo: string; date: string } | null {
  const s = (value ?? "").trim();
  if (!s) return null;
  const [left, right] = s.split("·").map((p) => p.trim());
  return { receiptNo: left ?? "", date: right ?? "" };
}

/** Column U: "Sent 14/07/26" → "14/07/26". Empty string if not sent. */
export function parseSentCell(value: string | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  return s.replace(/^sent\b/i, "").trim() || s;
}

/** ISO timestamp → dd/mm/yy, for values that came from the local ledger. */
export function fmtIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * What we know about this child's receipt, spreadsheet first, local ledger as
 * backup. The ledger still matters: if the spreadsheet was open in Excel the
 * write-back failed, and the ledger is the only place the issuance was recorded.
 * Returns null when no receipt exists in either source.
 */
export function receiptState(
  student: Student,
  ledgerEntry?: { receiptNo: string; issuedAt: string; sentAt: string | null }
): ReceiptState | null {
  const sheet = parseIssuedCell(student.receiptIssued);
  if (!sheet && !ledgerEntry) return null;
  return {
    receiptNo: sheet?.receiptNo || ledgerEntry?.receiptNo || "",
    issued:    sheet?.date      || fmtIso(ledgerEntry?.issuedAt),
    sent:      parseSentCell(student.receiptSent) || fmtIso(ledgerEntry?.sentAt),
  };
}
