import ExcelJS from "exceljs";
import { existsSync } from "fs";
import type { TemplateConfig } from "@/app/api/config/route";
import { isMasterSheet } from "@/lib/parse-students";
import { readLedger } from "@/lib/billing-store";
import { normalizeStudentId } from "@/types/student";

// Writes receipt status back into the master spreadsheet so Excel and the app
// always tell the same story. Best-effort: if the file is open in Excel or
// otherwise locked/read-only (EBUSY/EPERM/EACCES) or not configured, we
// return a warning string instead of failing the receipt generation.

const COL_STUDENT_NAME   = 2;  // B
const COL_IDENTITY_LAST  = 8;  // H — last column mirrored from Master
const COL_TERM_FIRST     = 9;  // I — first per-term column (Lessons)
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

/** Is this the "can't write, the file is locked/read-only" case? EBUSY is the
 *  common one (Excel has it open on Windows), but a Drive-locked or
 *  read-only file surfaces as EPERM or EACCES instead depending on OS/cause —
 *  all three mean the same thing to the admin: close Excel and try again. */
function isBusyFileError(err: unknown): boolean {
  return err instanceof Error && /\b(EBUSY|EPERM|EACCES)\b/.test(err.message);
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
    const busy = isBusyFileError(err);
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

/** Which Master row a term row mirrors, read from its Student Name formula
 *  (=IF(Master!B15="","",Master!B15) → 15). This is the only trustworthy link:
 *  term row 100 does NOT necessarily mirror Master row 100 — inserting or
 *  deleting rows on Master leaves the two sheets offset from each other, and
 *  every check has to follow the row's own formula instead of assuming.
 *  Null when the cell isn't a Master-linked formula (a frozen tab holds plain
 *  values) or when the link is broken (#REF!). */
function linkedMasterRow(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (!v || typeof v !== "object" || !("formula" in v)) return null;
  const m = String((v as ExcelJS.CellFormulaValue).formula).match(/Master!\$?B\$?(\d+)/i);
  return m ? Number(m[1]) : null;
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

export interface CleanupResult {
  ok: boolean;
  /** Dead #REF! rows deleted (student's Master row was deleted). */
  removed: number;
  /** Rows whose stale term data was cleared (Master row was blanked instead). */
  cleared: number;
  warning?: string;
}

/** Rows on this sheet (descending) whose identity cells hold an Excel error —
 *  the husk left behind when the student's row is deleted from Master.
 *  Descending so deleting one never shifts the index of the next. */
function brokenRows(ws: ExcelJS.Worksheet): number[] {
  const rows: number[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    for (const c of [COL_STUDENT_NAME, COL_STUDENT_ID]) {
      const v = ws.getRow(r).getCell(c).value;
      const isErr =
        v !== null && typeof v === "object" &&
        (("error" in v) || ("result" in v && !!(v as ExcelJS.CellFormulaValue).result &&
          typeof (v as ExcelJS.CellFormulaValue).result === "object" &&
          "error" in ((v as ExcelJS.CellFormulaValue).result as object)));
      if (isErr) { rows.push(r); break; }
    }
  }
  return rows.reverse();
}

/**
 * Clears what a term tab keeps behind after a student is removed on Master, so
 * the admin's single action — remove the student where they were typed — leaves
 * every tab clean, with nothing for them to look at or tidy up by hand.
 *
 * There are two traces, because there are two ways to remove someone:
 *
 *  • DELETE the Master row → the term row's links break (#REF!). Deleting that
 *    row is what realigns the tab: Excel has already repointed the rows below
 *    to follow their own students, so dropping the dead row in between shifts
 *    that block up and each row's term data sits beside its student again.
 *    References to Master are untouched by an in-sheet row delete.
 *
 *  • CLEAR the Master row instead → the links stay valid and simply mirror
 *    blanks, leaving a nameless row still holding the departed student's
 *    lessons and fees. Here the row must stay (it still lines up with the
 *    empty Master row); only its term data is wiped.
 *
 * Never touches Master (that's the admin's own list) and never touches a row
 * that still resolves to a student. Best-effort like every write-back: a file
 * open in Excel yields a warning, not a failure.
 */
export async function tidyTermTabs(config: TemplateConfig): Promise<CleanupResult> {
  const file = config.spreadsheetPath?.trim();
  if (!file) return { ok: false, removed: 0, cleared: 0, warning: "Spreadsheet path not set in Invoice Template → Folders." };
  if (!existsSync(file)) return { ok: false, removed: 0, cleared: 0, warning: "Spreadsheet file not found." };
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    let removed = 0;
    let cleared = 0;
    for (const ws of wb.worksheets) {
      if (isMasterSheet(ws.name)) continue;
      for (const r of brokenRows(ws)) {
        ws.spliceRows(r, 1);
        removed++;
      }
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        if (linkedMasterRow(row.getCell(COL_STUDENT_NAME)) === null) continue;
        // B–H, not A: column A is a running count mirrored from Master, not
        // identity, and a stale one would keep a dead row looking occupied.
        let identity = false;
        for (let c = COL_STUDENT_NAME; c <= COL_IDENTITY_LAST; c++) if (cellText(row.getCell(c)) !== "") { identity = true; break; }
        if (identity) continue;
        let hasTermData = false;
        for (let c = COL_TERM_FIRST; c <= COL_RECEIPT_SENT; c++) if (cellText(row.getCell(c)) !== "") { hasTermData = true; break; }
        if (!hasTermData) continue;
        for (let c = COL_TERM_FIRST; c <= COL_RECEIPT_SENT; c++) row.getCell(c).value = null;
        cleared++;
      }
    }
    if (removed === 0 && cleared === 0) return { ok: true, removed: 0, cleared: 0 };
    await wb.xlsx.writeFile(file);
    return { ok: true, removed, cleared };
  } catch (err) {
    const busy = isBusyFileError(err);
    return {
      ok: false,
      removed: 0,
      cleared: 0,
      warning: busy
        ? "Close the spreadsheet in Excel and press Refresh — the app will clear the leftover rows from the term tabs."
        : "Could not clear the leftover rows from the term tabs.",
    };
  }
}

export interface RosterSyncResult {
  ok: boolean;
  /** Names of students given a row on one or more term tabs. */
  names: string[];
  /** Total rows inserted across all tabs (a two-subject child is two rows). */
  rows: number;
  warning?: string;
}

/** Underlying value of a cell, formulas resolved to their cached result, with
 *  the original type preserved — a rate must stay the number 40, not "40". */
function rawValue(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("formula" in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      return typeof r === "number" || typeof r === "string" ? r : null;
    }
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    return null;
  }
  return typeof v === "number" || typeof v === "string" ? v : null;
}

/** Does this Master row hold a student or one of their subject lines? Columns
 *  B–H only: column A is a fill-down serial formula that sits on empty rows too,
 *  so counting it would make every blank row look occupied. Merge continuation
 *  cells report their master's value in ExcelJS but read blank to the parser —
 *  ignored here so both sides agree on what a data row is. */
function masterRowHasData(master: ExcelJS.Worksheet, r: number): boolean {
  const row = master.getRow(r);
  for (let c = COL_STUDENT_NAME; c <= COL_IDENTITY_LAST; c++) {
    const cell = row.getCell(c);
    if (cell.type === ExcelJS.ValueType.Merge) continue;
    if (cellText(cell) !== "") return true;
  }
  return false;
}

/** A blank spare row at the bottom of a term tab: mirrors an empty Master row
 *  and carries no term data of its own. Safe to drop — that's all it is. */
function isSpareMirrorRow(ws: ExcelJS.Worksheet, r: number): boolean {
  const row = ws.getRow(r);
  if (linkedMasterRow(row.getCell(COL_STUDENT_NAME)) === null) return false;
  for (let c = 1; c <= COL_STUDENT_ID; c++) {
    if (cellText(row.getCell(c)) !== "") return false;
  }
  return true;
}

/** Adds one term-tab row mirroring Master row `masterRow`, at row `pos`.
 *
 *  A–H and S become the same linked formulas every other row uses, with the
 *  cached result filled in so the app sees the child immediately — before the
 *  workbook is ever opened in Excel again. I–R (lessons, fees, payment and
 *  receipt status) start blank: this term's data is the admin's to type.
 *
 *  Rows below shift down carrying their own formulas and their own term data
 *  together, so nobody else's row changes meaning. */
function insertMirrorRow(ws: ExcelJS.Worksheet, pos: number, master: ExcelJS.Worksheet, masterRow: number): void {
  ws.spliceRows(pos, 0, []);
  // The row we just pushed down is the local look of the sheet (banding, fonts,
  // column formats). Column A never carries a receipt status fill, so its fill
  // is this row's true banding colour — reuse it everywhere so no leftover
  // red/green shading is inherited.
  const template = ws.getRow(pos + 1 <= ws.rowCount ? pos + 1 : Math.max(2, pos - 1));
  const clone = <T>(o: T): T => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const baseFill = clone(template.getCell(1).style?.fill);
  const row = ws.getRow(pos);
  if (template.height) row.height = template.height;

  for (let c = 1; c <= COL_STUDENT_ID; c++) {
    const cell = row.getCell(c);
    const style = clone(template.getCell(c).style ?? {});
    if (baseFill) style.fill = clone(baseFill);
    cell.style = style; // fresh object per cell — never share (see styleCell)

    const masterCol = c === COL_STUDENT_ID ? MASTER_COL_ID : c;
    if (c > COL_IDENTITY_LAST && c !== COL_STUDENT_ID) {
      cell.value = null;
      continue;
    }
    const letter = String.fromCharCode(64 + masterCol);
    const cached = rawValue(master.getRow(masterRow).getCell(masterCol));
    cell.value = {
      formula: `IF(Master!${letter}${masterRow}="","",Master!${letter}${masterRow})`,
      ...(cached === null || cached === "" ? {} : { result: cached }),
    } as ExcelJS.CellFormulaValue;
  }
}

/**
 * Gives every student on Master a row on every live term tab.
 *
 * Adding a student is done on Master alone — including in the MIDDLE of the
 * list, next to the others of their level, which is how the roster is meant to
 * read. Excel handles half of that by itself: inserting a row shifts the term
 * tabs' link formulas along with the students they point at, so everyone else
 * keeps their own lessons, fees and receipt marks. What Excel does NOT do is
 * create a row for the new child — no term row points at them, so they'd never
 * be billed. This adds those rows, in the same position they hold on Master.
 *
 * Every tab is checked, so terms prepared in advance stay complete too. Frozen
 * tabs (past terms converted to plain values by freeze-term.js) hold no links
 * and are deliberately left alone — a finished term must not gain students.
 *
 * Never touches Master, never touches an existing row's data. Best-effort like
 * every write-back: a file open in Excel yields a warning, not a failure.
 */
export async function syncTermRosters(config: TemplateConfig): Promise<RosterSyncResult> {
  const file = config.spreadsheetPath?.trim();
  if (!file) return { ok: false, names: [], rows: 0, warning: "Spreadsheet path not set in Invoice Template → Folders." };
  if (!existsSync(file)) return { ok: false, names: [], rows: 0, warning: "Spreadsheet file not found." };
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const master = wb.worksheets.find((w) => isMasterSheet(w.name));
    if (!master) return { ok: false, names: [], rows: 0, warning: "No Master tab — cannot check the term tabs." };

    const dataRows: number[] = [];
    for (let r = 2; r <= master.rowCount; r++) if (masterRowHasData(master, r)) dataRows.push(r);

    const names = new Set<string>();
    let rows = 0;

    for (const ws of wb.worksheets) {
      if (isMasterSheet(ws.name)) continue;

      // termRow → masterRow for every linked row on this tab.
      let links: { termRow: number; masterRow: number }[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const m = linkedMasterRow(ws.getRow(r).getCell(COL_STUDENT_NAME));
        if (m !== null) links.push({ termRow: r, masterRow: m });
      }
      if (links.length === 0) continue; // frozen term — plain values, no links

      const mirrored = new Set(links.map((l) => l.masterRow));
      // Who this tab already shows, by value. A tab can hold rows that aren't
      // linked at all (someone pasted values over part of it), and those rows
      // still bill the student — inserting a mirror beside one would invoice
      // them twice. Matching on the visible name/ID is what rules that out.
      const onTab = new Set<string>();
      for (let r = 2; r <= ws.rowCount; r++) {
        const name = cellText(ws.getRow(r).getCell(COL_STUDENT_NAME)).toLowerCase();
        const id = normalizeStudentId(cellText(ws.getRow(r).getCell(COL_STUDENT_ID)));
        if (name) onTab.add(name);
        if (id) onTab.add(id);
      }
      const missing = dataRows.filter((r) => {
        if (mirrored.has(r)) return false;
        const name = cellText(master.getRow(r).getCell(COL_STUDENT_NAME)).toLowerCase();
        const id = normalizeStudentId(cellText(master.getRow(r).getCell(MASTER_COL_ID)));
        return !(name && onTab.has(name)) && !(id && onTab.has(id));
      });
      if (missing.length === 0) continue;

      for (const m of missing) {
        // Slot the new row where it belongs: straight after the row mirroring
        // the nearest student ABOVE them on Master, so the tab keeps Master's
        // order (which is the admin's level grouping).
        const prev = links.filter((l) => l.masterRow < m).reduce((max, l) => Math.max(max, l.termRow), 0);
        const pos = prev > 0 ? prev + 1 : links[0].termRow;
        insertMirrorRow(ws, pos, master, m);
        links = links.map((l) => (l.termRow >= pos ? { ...l, termRow: l.termRow + 1 } : l));
        links.push({ termRow: pos, masterRow: m });
        rows++;
        const name = cellText(master.getRow(m).getCell(COL_STUDENT_NAME));
        if (name) names.add(name);
      }

      // Each tab keeps a tail of blank spare rows. Give back as many as were
      // used up so the sheet doesn't grow a row longer on every addition.
      for (let k = 0; k < missing.length && ws.rowCount > 2 && isSpareMirrorRow(ws, ws.rowCount); k++) {
        ws.spliceRows(ws.rowCount, 1);
      }
    }

    if (rows === 0) return { ok: true, names: [], rows: 0 };
    await wb.xlsx.writeFile(file);
    return { ok: true, names: [...names], rows };
  } catch (err) {
    const busy = isBusyFileError(err);
    return {
      ok: false,
      names: [],
      rows: 0,
      warning: busy
        ? "Close the spreadsheet in Excel and press Refresh — the app will add the new student(s) to the term tabs."
        : "Could not add the new student(s) to the term tabs.",
    };
  }
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
          if (linkedMasterRow(ws.getRow(r).getCell(COL_STUDENT_NAME)) !== masterRow) continue;
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
        // Follow the row's OWN link target rather than assuming term row r maps
        // to Master row r: past insertions/deletions leave link formulas skewed
        // (e.g. term row 100 → Master row 99), and the ID must stay attached to
        // the same student the name formula shows.
        const t = linkedMasterRow(ws.getRow(r).getCell(COL_STUDENT_NAME));
        if (t === null) continue;
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
    const busy = isBusyFileError(err);
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
