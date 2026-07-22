import ExcelJS from "exceljs";
import { existsSync } from "fs";
import type { TemplateConfig } from "@/app/api/config/route";

// Writes receipt status back into the master spreadsheet so Excel and the app
// always tell the same story. Best-effort: if the file is open in Excel
// (EBUSY) or not configured, we return a warning string instead of failing
// the receipt generation.

const COL_RECEIPT_ISSUED = 16; // P
const COL_RECEIPT_SENT   = 19; // S

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
    const ws = wb.getWorksheet(term) ?? wb.worksheets[0];
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

function findRowBySerial(ws: ExcelJS.Worksheet, serialNo: number): ExcelJS.Row | null {
  // rowCount = last used row number. actualRowCount (the count of non-empty
  // rows) would stop the scan short the moment anyone leaves a blank row in the
  // middle of the sheet, silently skipping every student below it.
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(1).value;
    if (Number(v) === serialNo) return ws.getRow(r);
  }
  return null;
}

function styleCell(cell: ExcelJS.Cell): void {
  cell.font = { name: "Calibri", size: 10 };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  // Deliberately does NOT set the fill. The sheet is banded per CHILD (a
  // multi-subject child's rows share one colour), so guessing a fill from row
  // parity here would punch a mismatched cell into the middle of a band.
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
    styleCell(cell);
  });
}

export function writebackReceiptSent(
  config: TemplateConfig, term: string, serialNo: number
): Promise<WritebackResult> {
  return withSheet(config, term, (ws) => {
    const row = findRowBySerial(ws, serialNo);
    if (!row) throw new Error(`Serial ${serialNo} not found in sheet`);
    const cell = row.getCell(COL_RECEIPT_SENT);
    cell.value = `Sent ${dmy()}`;
    styleCell(cell);
  });
}
