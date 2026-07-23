import ExcelJS from "exceljs";
import { existsSync } from "fs";
import type { TemplateConfig } from "@/app/api/config/route";
import { isMasterSheet } from "@/lib/parse-students";

// Writes receipt status back into the master spreadsheet so Excel and the app
// always tell the same story. Best-effort: if the file is open in Excel
// (EBUSY) or not configured, we return a warning string instead of failing
// the receipt generation.

const COL_RECEIPT_ISSUED = 15; // O
const COL_RECEIPT_SENT   = 18; // R

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

/** Serial numbers on a term sheet are formulas pulling from Master, so the raw
 *  cell value is a {formula, result} object rather than a number. Reading that
 *  directly yields NaN and the row is never found — i.e. write-back would fail
 *  for every single student. Resolve the cached result first. */
function cellNumber(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v && typeof v === "object" && "result" in v) {
    return Number((v as ExcelJS.CellFormulaValue).result);
  }
  return Number(v);
}

function findRowBySerial(ws: ExcelJS.Worksheet, serialNo: number): ExcelJS.Row | null {
  // rowCount = last used row number. actualRowCount (the count of non-empty
  // rows) would stop the scan short the moment anyone leaves a blank row in the
  // middle of the sheet, silently skipping every student below it.
  for (let r = 2; r <= ws.rowCount; r++) {
    if (cellNumber(ws.getRow(r).getCell(1)) === serialNo) return ws.getRow(r);
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

export function writebackReceiptIssued(
  config: TemplateConfig, term: string, serialNo: number, receiptNo: string
): Promise<WritebackResult> {
  return withSheet(config, term, (ws) => {
    const row = findRowBySerial(ws, serialNo);
    if (!row) throw new Error(`Serial ${serialNo} not found in sheet`);
    const cell = row.getCell(COL_RECEIPT_ISSUED);
    cell.value = `${receiptNo} · ${dmy()}`;
    // Issued but not yet sent → red status light.
    styleCell(cell, FILL_ISSUED_NOT_SENT);
  });
}

export function writebackReceiptSent(
  config: TemplateConfig, term: string, serialNo: number
): Promise<WritebackResult> {
  return withSheet(config, term, (ws) => {
    const row = findRowBySerial(ws, serialNo);
    if (!row) throw new Error(`Serial ${serialNo} not found in sheet`);
    // Record the send date in the Receipt Sent column …
    const sentCell = row.getCell(COL_RECEIPT_SENT);
    sentCell.value = `Sent ${dmy()}`;
    styleCell(sentCell);
    // … and flip the Receipt Issued status light from red to green.
    styleCell(row.getCell(COL_RECEIPT_ISSUED), FILL_SENT);
  });
}
