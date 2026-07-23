import type { Student } from "@/types/student";

// Reading receipt state back out of the master spreadsheet.
//
// The spreadsheet is the single source of truth. Generating a receipt stamps
// column O (Receipt Issued) and Mark as Sent stamps column R (Receipt Sent),
// and that file lives in the shared Drive folder, so every admin's computer sees
// the same history. Parsing those columns back is what lets a fresh install — a
// new admin, or the owner after handover — still know a receipt was issued.
//
// Because the sheet is authoritative, its BLANKS are meaningful too: if an admin
// clears the Receipt Issued or Receipt Sent cell in Excel, the app reflects that
// on the next refresh (the status is undone). The per-machine ledger
// (lib/billing-store.ts) is only a last-resort backup used when the sheet is
// completely silent for a child — e.g. a write-back that failed because the file
// was open in Excel — and it is never allowed to revive a status the sheet no
// longer shows.
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
 * What we know about this child's receipt.
 *
 * The spreadsheet is authoritative: whenever it holds ANY receipt info for this
 * child (a Receipt Issued or Receipt Sent value), that is used verbatim and its
 * blanks win — so clearing a cell in Excel undoes the status here on the next
 * refresh, and marking sent by hand in Excel shows up as sent. The ledger is a
 * pure fallback, consulted only when the sheet is completely silent for this
 * child (e.g. a write-back that failed while the file was open in Excel); it is
 * never allowed to revive a status the sheet no longer shows.
 *
 * Callers that want strict "sheet only" behaviour (the live receipts list)
 * simply pass no ledgerEntry. Returns null when nothing is known.
 */
export function receiptState(
  student: Student,
  ledgerEntry?: { receiptNo: string; issuedAt: string; sentAt: string | null }
): ReceiptState | null {
  const sheet     = parseIssuedCell(student.receiptIssued);
  const sheetSent = parseSentCell(student.receiptSent);

  // Sheet has something → it is the record, blanks included.
  if (sheet || sheetSent) {
    return {
      receiptNo: sheet?.receiptNo || "",
      issued:    sheet?.date || "",
      sent:      sheetSent,
    };
  }

  // Sheet is silent → last-resort ledger fallback (never overrides the sheet).
  if (ledgerEntry && (ledgerEntry.issuedAt || ledgerEntry.sentAt)) {
    return {
      receiptNo: ledgerEntry.receiptNo,
      issued:    fmtIso(ledgerEntry.issuedAt),
      sent:      fmtIso(ledgerEntry.sentAt),
    };
  }

  return null;
}
