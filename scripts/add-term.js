#!/usr/bin/env node
/**
 * Add fresh term tab(s) to the master workbook.
 *
 * A term tab is a per-term billing sheet. Its identity columns A–H are LIVE
 * formulas pointing at the Master roster (=IF(Master!A2="","",Master!A2)), so a
 * child typed once on Master appears on every term automatically. Columns I–R
 * are the per-term billing/status fields and start BLANK on a new term — each
 * term has its own lessons, adjustments, payments and receipts.
 *
 * This clones an existing term tab (default "AY 26 T3") for its exact layout,
 * column widths, banding and header styling, then:
 *   • keeps A–H as formulas linked to Master (references are per-row and valid
 *     on any tab, so they carry over unchanged),
 *   • clears every billing/status value in I–R (rows 2+),
 *   • resets each data cell's fill to that row's base banding colour, so no
 *     leftover red/green receipt-status shading comes across from the template.
 *
 * New tabs are APPENDED after the template. The app treats the FIRST tab after
 * Master as the active billing term, so the current term must stay first —
 * appending keeps it that way. When a term becomes current, drag its tab to sit
 * directly after Master.
 *
 * Usage:
 *   node scripts/add-term.js "<workbook.xlsx>" "AY 26 T2" "AY 26 T4"
 *   node scripts/add-term.js "<workbook.xlsx>" --from "AY 26 T3" "AY 26 T2"
 */
const ExcelJS = require("exceljs");
const path = require("path");

const IDENTITY_LAST_COL = 8;   // H — last Master-linked column
const LAST_COL = 18;           // R — last billing/status column

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

async function main() {
  const argv = process.argv.slice(2);
  let template = null;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from") { template = argv[++i]; continue; }
    positional.push(argv[i]);
  }
  const [file, ...newTerms] = positional;

  if (!file || newTerms.length === 0) {
    console.error('usage: node scripts/add-term.js "<workbook.xlsx>" "AY 26 T2" ["AY 26 T4" ...] [--from "AY 26 T3"]');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));

  const src =
    (template && wb.getWorksheet(template)) ||
    wb.worksheets.find((w) => w.name.trim().toLowerCase() !== "master");
  if (!src) {
    console.error("No term tab to use as a template. Tabs: " + wb.worksheets.map((w) => w.name).join(", "));
    process.exit(1);
  }

  const maxRow = src.rowCount;
  const maxCol = Math.max(src.columnCount, LAST_COL);

  for (const name of newTerms) {
    if (wb.getWorksheet(name)) {
      console.error(`A tab named "${name}" already exists — skipping. Rename or delete it first.`);
      continue;
    }
    const ws = wb.addWorksheet(name);

    // Sheet-level: frozen top row, print setup, default row height.
    ws.views = clone(src.views);
    ws.pageSetup = clone(src.pageSetup);
    ws.properties.defaultRowHeight = src.properties.defaultRowHeight;

    // Column widths.
    for (let c = 1; c <= maxCol; c++) ws.getColumn(c).width = src.getColumn(c).width;

    for (let r = 1; r <= maxRow; r++) {
      const srcRow = src.getRow(r);
      const dstRow = ws.getRow(r);
      if (srcRow.height) dstRow.height = srcRow.height;

      // Row 1 = header: copy verbatim (purple fill, bold, wrap).
      if (r === 1) {
        for (let c = 1; c <= maxCol; c++) {
          const s = srcRow.getCell(c), d = dstRow.getCell(c);
          d.value = s.value;
          d.style = clone(s.style);
        }
        continue;
      }

      // Data row: the true banding colour lives in column A, which never gets a
      // receipt status fill. Reuse it for every cell so red/green shading from
      // the template is wiped while the alternating banding is preserved.
      const baseFill = clone(src.getRow(r).getCell(1).style.fill);
      for (let c = 1; c <= maxCol; c++) {
        const s = srcRow.getCell(c), d = dstRow.getCell(c);
        // A–H stay linked to Master (formula + cached result copied as-is so the
        // app reads names immediately, before the file is ever opened in Excel).
        // I–R start blank — this is a fresh term.
        d.value = c <= IDENTITY_LAST_COL ? s.value : null;
        const style = clone(s.style);
        if (baseFill) style.fill = clone(baseFill);
        d.style = style; // fresh, independent object — no shared-style bleed
      }
    }

    // Per-child status merges in L–R (multi-subject children), copied verbatim.
    for (const range of src.model.merges) ws.mergeCells(range);

    console.log(`+ "${name}" (cloned from "${src.name}"): A–H linked to Master, I–R blank`);
  }

  await wb.xlsx.writeFile(path.resolve(file));
  console.log(`saved: ${path.resolve(file)}`);
  console.log(`tabs now: ${wb.worksheets.map((w) => w.name).join(", ")}`);
}

main().catch((err) => {
  console.error("add-term failed:", err.message);
  process.exit(1);
});
