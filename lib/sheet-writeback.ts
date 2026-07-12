import ExcelJS from "exceljs";
import { existsSync } from "fs";
import type { TemplateConfig } from "@/app/api/config/route";

// Writes receipt status back into the master spreadsheet so Excel and the app
// always tell the same story. Best-effort: if the file is open in Excel
// (EBUSY) or not configured, we return a warning string instead of failing
// the receipt generation.

const COL_RECEIPT_ISSUED = 18; // R
const COL_RECEIPT_SENT   = 21; // U

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
  for (let r = 2; r <= ws.actualRowCount; r++) {
    const v = ws.getRow(r).getCell(1).value;
    if (Number(v) === serialNo) return ws.getRow(r);
  }
  return null;
}

function styleCell(cell: ExcelJS.Cell, rowNumber: number): void {
  cell.font = { name: "Calibri", size: 10 };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.fill = rowNumber % 2 === 0
    ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }
    : { type: "pattern", pattern: "none" };
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
    styleCell(cell, row.number);
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
    styleCell(cell, row.number);
  });
}
