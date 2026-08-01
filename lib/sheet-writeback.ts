import ExcelJS from "exceljs";
import { existsSync } from "fs";
import type { TemplateConfig } from "@/app/api/config/route";
import { isMasterSheet } from "@/lib/parse-students";
import { readLedger } from "@/lib/billing-store";
import { normalizeStudentId } from "@/types/student";

// Writes receipt status back into the master spreadsheet so Excel and the app
// always tell the same story. Best-effort: if the file is open in Excel
// (EBUSY) or not configured, we return a warning string instead of failing
// the receipt generation.

const COL_STUDENT_NAME   = 2;  // B
const COL_INVOICE_ISSUED = 12; // L
const COL_RECEIPT_ISSUED = 15; // O
const COL_RECEIPT_SENT   = 18; // R
const COL_STUDENT_ID     = 19; // S — formula-linked to Master column I
const MASTER_COL_ID      = 9;  // I on the Master tab (the typed source of truth)

// The Receipt Issued cell doubles as an at-a-glance status light: red once a
// receipt is generated (issued but not yet sent to the parent), green once the
// admin marks it sent. Excel's standard "bad"/"good" fills, readable with black text.
const FILL_ISSUED_NOT_SENT = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } } as const; // red
const FILL_SENT            = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } } as const; // green

export interface WritebackResult {
  ok: boolean;
  warning?: string;
}

async function withSheet(
  config: TemplateConfig,
  term: string,
  fn: (ws: ExcelJS.Worksheet) => void
): Promise<WritebackResult> {
  const file = config.spreadsheetPath?.trim();
  if (!file) return { ok: false, warning: "Spreadsheet path not set in Invoice Template → Folders — Excel not updated." };
  if (!existsSync(file)) return { ok: false, warning: "Spreadsheet file not found — Excel not updated." };
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    // Never fall back onto the Master tab: it carries no receipt columns, so a
    // write there would be silently lost. Fall back to the active term instead.
    const ws =
      wb.getWorksheet(term) ??
      wb.worksheets.find((w) => !isMasterSheet(w.name)) ??
      wb.worksheets[0];
    if (!ws) return { ok: false, warning: "No worksheet found — Excel not updated." };
    fn(ws);
    await wb.xlsx.writeFile(file);
    return { ok: true };
  } catch (err) {
    const busy = err instanceof Error && err.message.includes("EBUSY");
    return {
      ok: false,
      warning: busy
        ? "Spreadsheet is open in Excel — close it and re-generate (or update the cell by hand). The receipt itself was created fine."
        : "Could not update the spreadsheet — update the cell by hand.",
    };
  }
}

/** Identity cells on a term sheet are formulas pulling from Master, so the raw
 *  cell value is a {formula, result} object rather than a plain value. Reading
 *  that directly would never match — i.e. write-back would fail for every
 *  single student. Resolve the cached result first. */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v && typeof v === "object") {
    // Formula cell: only its cached result counts. A formula with NO cached
    // result (empty linked row) must read as blank — falling through to
    // String(v) would yield "[object Object]" and corrupt every check built
    // on this. Error cells (#REF! etc.) surface their error text.
    if ("formula" in v || "result" in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      if (r && typeof r === "object" && "error" in r) return String(r.error);
      return r === null || r === undefined ? "" : String(r).trim();
    }
    if ("error" in v) return String((v as ExcelJS.CellErrorValue).error);
    if ("richText" in v) {
      return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("").trim();
    }
    return "";
  }
  return v === null || v === undefined ? "" : String(v).trim();
}

function findRowByStudentId(ws: ExcelJS.Worksheet, studentId: string): ExcelJS.Row | null {
  // rowCount = last used row number. actualRowCount (the count of non-empty
  // rows) would stop the scan short the moment anyone leaves a blank row in the
  // middle of the sheet, silently skipping every student below it.
  // Normalised on both sides, so a hand-edited "s7" cell still matches "S007".
  const want = normalizeStudentId(studentId);
  if (!want) return null;
  for (let r = 2; r <= ws.rowCount; r++) {
    if (normalizeStudentId(cellText(ws.getRow(r).getCell(COL_STUDENT_ID))) === want) return ws.getRow(r);
  }
  return null;
}

function styleCell(cell: ExcelJS.Cell, fill?: ExcelJS.FillPattern): void {
  // IMPORTANT: assign a fresh, independent style object rather than mutating
  // cell.font / cell.fill directly. In an .xlsx, cells with identical formatting
  // share one style record, and ExcelJS hands them the SAME in-memory style
  // object — so `cell.fill = x` mutates every cell that shares it, painting the
  // whole row (and beyond). Spreading the current style into a new object first
  // breaks the share, so only THIS cell changes.
  cell.style = {
    ...cell.style,
    font: { name: "Calibri", size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    // Only the Receipt Issued status cell is deliberately filled (red/green —
    // see the callers). Everywhere else the fill is left as-is.
    ...(fill ? { fill } : {}),
  };
}

function dmy(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

/** Stamps "INV-<term>-<StudentID> · <date>" into Invoice Issued (column L) for
 *  every exported student. The stamp carries the child's permanent ID, so the
 *  parser can later verify the mark still sits on the right child's row (rows
 *  shift when Master is sorted or a deletion is half-done). One workbook
 *  open/save for the whole export run rather than one per student. Plain
 *  overwrite, so re-exporting the same student is idempotent. */
export function writebackInvoiceIssued(
  config: TemplateConfig, term: string, stamps: { studentId: string; invNo: string }[]
): Promise<WritebackResult> {
  return withSheet(config, term, (ws) => {
    for (const { studentId, invNo } of stamps) {
      const row = findRowByStudentId(ws, studentId);
      if (!row) continue; // shouldn't happen — the student came from this sheet
      const cell = row.getCell(COL_INVOICE_ISSUED);
      cell.value = `${invNo} · ${dmy()}`;
      styleCell(cell);
    }
  });
}

export function writebackReceiptIssued(
  config: TemplateConfig, term: string, studentId: string, receiptNo: string
): Promise<WritebackResult> {
  return withSheet(config, term, (ws) => {
    const row = findRowByStudentId(ws, studentId);
    if (!row) throw new Error(`Student ID ${studentId} not found in sheet`);
    const cell = row.getCell(COL_RECEIPT_ISSUED);
    cell.value = `${receiptNo} · ${dmy()}`;
    // Issued but not yet sent → red status light.
    styleCell(cell, FILL_ISSUED_NOT_SENT);
  });
}

/** "S007" → 7; null for anything that isn't an app-style ID. */
function idNumber(id: string): number | null {
  const m = id.trim().match(/^S0*(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/** A Master row starts a new child when its name cell holds a value and isn't
 *  the tail of a vertical merge (multi-subject children merge the name cell
 *  across their subject rows — only the top row identifies the child). */
function isChildRow(cell: ExcelJS.Cell): boolean {
  if (cellText(cell) === "") return false;
  return !cell.isMerged || cell.master.address === cell.address;
}

export interface AssignResult {
  ok: boolean;
  assigned: number;
  warning?: string;
}

/** Gives every child on Master a permanent Student ID if they don't have one.
 *
 *  IDs live as typed values in Master column I; each term tab mirrors them in
 *  column S via the same kind of formula that links A–H. New IDs continue from
 *  the highest ever seen — across the sheet AND the receipt ledger — so an ID
 *  freed by deleting a student is never given to someone else (their history in
 *  the ledger, Drive PDFs and frozen term tabs must stay unambiguous).
 *
 *  Also repairs plumbing as it goes: creates the Student ID headers and the
 *  column-S formulas on any tab missing them (formulas are written with their
 *  cached result set, so the app sees the IDs immediately — without this, the
 *  mirrored cells would read blank until the admin next opens Excel).
 *
 *  Best-effort like every write-back: returns a warning instead of throwing
 *  when the file is open in Excel. */
export async function assignMissingStudentIds(config: TemplateConfig): Promise<AssignResult> {
  const file = config.spreadsheetPath?.trim();
  if (!file) return { ok: false, assigned: 0, warning: "Spreadsheet path not set in Invoice Template → Folders." };
  if (!existsSync(file)) return { ok: false, assigned: 0, warning: "Spreadsheet file not found." };
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const master = wb.worksheets.find((w) => isMasterSheet(w.name));
    if (!master) return { ok: false, assigned: 0, warning: "No Master tab — cannot assign Student IDs." };

    // Highest ID ever used: Master column I + every term tab's column S + IDs
    // embedded in invoice/receipt stamps (columns L and O) + the local receipt
    // ledger. The stamp and ledger sources cover students already deleted from
    // the sheet — their IDs must never be handed to someone new, even if the
    // ledger file was wiped, because the stamps in frozen tabs and the PDFs in
    // Drive still carry them.
    let maxId = 0;
    const seen = (id: string) => {
      const n = idNumber(id);
      if (n !== null && n > maxId) maxId = n;
    };
    const stampId = (t: string): string => {
      const m = t.match(/\b(?:INV|R)-[A-Z0-9]+-(S\d+)\b/i);
      return m ? m[1] : "";
    };
    for (const ws of wb.worksheets) {
      const isM = isMasterSheet(ws.name);
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        seen(cellText(row.getCell(isM ? MASTER_COL_ID : COL_STUDENT_ID)));
        if (!isM) {
          seen(stampId(cellText(row.getCell(COL_INVOICE_ISSUED))));
          seen(stampId(cellText(row.getCell(COL_RECEIPT_ISSUED))));
        }
      }
    }
    for (const entry of Object.values(readLedger())) seen(entry.studentId ?? "");

    // Header on Master (styled like its neighbour so the sheet stays tidy).
    const headerStyle = JSON.parse(JSON.stringify(master.getRow(1).getCell(MASTER_COL_ID - 1).style ?? {}));
    const mHeader = master.getRow(1).getCell(MASTER_COL_ID);
    if (cellText(mHeader) === "") {
      mHeader.value = "Student ID";
      mHeader.style = headerStyle;
      master.getColumn(MASTER_COL_ID).width = 12;
    }

    // Self-healing: if a child's ID cell was accidentally cleared, their old
    // stamps still name it (INV-…-S007). Reclaim that ID instead of minting a
    // new one, so their history re-attaches instead of orphaning — but only
    // when no OTHER child currently holds it.
    const masterIds = new Set<string>();
    for (let r = 2; r <= master.rowCount; r++) {
      const t = normalizeStudentId(cellText(master.getRow(r).getCell(MASTER_COL_ID)));
      if (t) masterIds.add(t);
    }
    const recoverId = (masterRow: number): string | null => {
      for (const ws of wb.worksheets) {
        if (isMasterSheet(ws.name)) continue;
        for (let r = 2; r <= ws.rowCount; r++) {
          const v = ws.getRow(r).getCell(COL_STUDENT_NAME).value;
          if (!v || typeof v !== "object" || !("formula" in v)) continue;
          const m = String((v as ExcelJS.CellFormulaValue).formula).match(/Master!\$?B\$?(\d+)/i);
          if (!m || Number(m[1]) !== masterRow) continue;
          const row = ws.getRow(r);
          const fromStamp =
            stampId(cellText(row.getCell(COL_INVOICE_ISSUED))) ||
            stampId(cellText(row.getCell(COL_RECEIPT_ISSUED)));
          const id = normalizeStudentId(fromStamp);
          if (id && !masterIds.has(id)) return id;
        }
      }
      return null;
    };

    // Assign to every child row on Master that lacks an ID.
    const assignedRows: number[] = [];
    for (let r = 2; r <= master.rowCount; r++) {
      const row = master.getRow(r);
      if (!isChildRow(row.getCell(COL_STUDENT_NAME))) continue;
      const idCell = row.getCell(MASTER_COL_ID);
      if (cellText(idCell) !== "") continue;
      const recovered = recoverId(r);
      if (recovered) {
        masterIds.add(recovered);
      } else {
        maxId += 1;
      }
      idCell.value = recovered ?? `S${String(maxId).padStart(3, "0")}`;
      idCell.style = {
        ...JSON.parse(JSON.stringify(idCell.style ?? {})),
        font: { name: "Calibri", size: 10 },
        alignment: { horizontal: "center", vertical: "middle" },
      };
      assignedRows.push(r);
    }

    // Mirror into every term tab's column S: make sure the header and the
    // linked formula exist wherever A–H are linked, and refresh the cached
    // result so the app reads the ID without waiting for Excel to recalculate.
    for (const ws of wb.worksheets) {
      if (isMasterSheet(ws.name)) continue;
      const sHeader = ws.getRow(1).getCell(COL_STUDENT_ID);
      if (cellText(sHeader) === "") {
        sHeader.value = "Student ID";
        sHeader.style = JSON.parse(JSON.stringify(ws.getRow(1).getCell(COL_RECEIPT_SENT).style ?? {}));
        ws.getColumn(COL_STUDENT_ID).width = 12;
      }
      for (let r = 2; r <= ws.rowCount; r++) {
        const nameCell = ws.getRow(r).getCell(COL_STUDENT_NAME);
        const v = nameCell.value;
        const linked = v && typeof v === "object" && "formula" in v;
        if (!linked) continue;
        // Follow the row's OWN link target rather than assuming term row r maps
        // to Master row r: past insertions/deletions leave link formulas skewed
        // (e.g. term row 100 → Master row 99), and the ID must stay attached to
        // the same student the name formula shows.
        const m = String((v as ExcelJS.CellFormulaValue).formula).match(/Master!\$?B\$?(\d+)/i);
        const t = m ? Number(m[1]) : r;
        const masterVal = cellText(master.getRow(t).getCell(MASTER_COL_ID));
        ws.getRow(r).getCell(COL_STUDENT_ID).value = {
          formula: `IF(Master!I${t}="","",Master!I${t})`,
          ...(masterVal !== "" ? { result: masterVal } : {}),
        } as ExcelJS.CellFormulaValue;
      }
    }

    await wb.xlsx.writeFile(file);
    return { ok: true, assigned: assignedRows.length };
  } catch (err) {
    const busy = err instanceof Error && err.message.includes("EBUSY");
    return {
      ok: false,
      assigned: 0,
      warning: busy
        ? "Spreadsheet is open in Excel — close it and press Refresh so the app can assign Student IDs."
        : "Could not update the spreadsheet to assign Student IDs.",
    };
  }
}

export function writebackReceiptSent(
  config: TemplateConfig, term: string, studentId: string
): Promise<WritebackResult> {
  return withSheet(config, term, (ws) => {
    const row = findRowByStudentId(ws, studentId);
    if (!row) throw new Error(`Student ID ${studentId} not found in sheet`);
    // Record the send date in the Receipt Sent column …
    const sentCell = row.getCell(COL_RECEIPT_SENT);
    sentCell.value = `Sent ${dmy()}`;
    styleCell(sentCell);
    // … and flip the Receipt Issued status light from red to green.
    styleCell(row.getCell(COL_RECEIPT_ISSUED), FILL_SENT);
  });
}
