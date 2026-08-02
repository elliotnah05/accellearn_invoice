#!/usr/bin/env node
/**
 * Freeze a finished term.
 *
 * Identity columns A–H on a term tab are live formulas pointing at the Master
 * tab. That is what we want for the CURRENT term, but once a term is over its
 * invoices and receipts have already gone out — if someone later raises a rate
 * or corrects a name on Master, that closed term would silently change and no
 * longer match the PDFs the parents were sent.
 *
 * This converts one term tab's A–H formulas — and the Student ID in column S,
 * which is linked the same way — into their plain current values, so the tab
 * becomes a permanent record. Everything else is left untouched.
 *
 * Column S matters as much as the names: leave it linked and deleting a student
 * from Master later breaks it to #REF!, which is exactly the signal the app uses
 * to clear out a departed student's row. A closed term would then lose the row
 * of someone it really did invoice.
 *
 * Usage:
 *   node scripts/freeze-term.js "<path to workbook>" "<term tab name>"
 *   node scripts/freeze-term.js "<path>" "AY 26 T3" --dry-run
 *
 * The equivalent by hand in Excel: select A2:H500 and S2:S500 on the term tab,
 * Copy, then Paste Special → Values.
 */
const ExcelJS = require("exceljs");
const path = require("path");

const IDENTITY_LAST_COL = 8; // H
const STUDENT_ID_COL = 19;   // S — linked to Master column I, frozen alongside A–H

async function main() {
  const [file, term, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes("--dry-run");

  if (!file || !term) {
    console.error("usage: node scripts/freeze-term.js <workbook.xlsx> <term tab name> [--dry-run]");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));

  const ws = wb.getWorksheet(term);
  if (!ws) {
    console.error(`No tab named "${term}". Tabs in this workbook: ${wb.worksheets.map((w) => w.name).join(", ")}`);
    process.exit(1);
  }
  if (ws.name.trim().toLowerCase() === "master") {
    console.error("Refusing to freeze the Master tab — it holds no formulas and is the source everything else reads.");
    process.exit(1);
  }

  // A formula that evaluates to blank is stored with no cached result at all,
  // which looks identical to a formula Excel has never calculated. They can't
  // be told apart per-cell — but they can in aggregate: a recalculated term
  // sheet always has SOME identity cell holding a real value. If not one does,
  // the workbook has not been through Excel yet and freezing it would wipe
  // every name in the term.
  const formulaCells = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    for (const c of [...Array(IDENTITY_LAST_COL).keys()].map((i) => i + 1).concat(STUDENT_ID_COL)) {
      const cell = ws.getRow(r).getCell(c);
      const v = cell.value;
      if (v && typeof v === "object" && "formula" in v) formulaCells.push({ cell, v });
    }
  }

  const withValues = formulaCells.filter(
    ({ v }) => "result" in v && v.result !== "" && v.result !== null && v.result !== undefined
  );

  if (formulaCells.length && withValues.length === 0) {
    console.error(
      `ABORTED — none of the ${formulaCells.length} linked cells on "${term}" has a calculated value.\n` +
      `Open the workbook in Excel, let it recalculate, save and close it, then run this again.`
    );
    process.exit(1);
  }

  let frozen = 0;
  let blanked = 0;
  for (const { cell, v } of formulaCells) {
    const result = "result" in v ? v.result : "";
    if (result === "" || result === null || result === undefined) {
      cell.value = null;
      blanked++;
    } else {
      cell.value = result;
      frozen++;
    }
  }

  console.log(`"${term}": ${frozen} identity cell(s) → values, ${blanked} empty cell(s) cleared`);

  if (dryRun) {
    console.log("--dry-run: nothing written");
    return;
  }
  await wb.xlsx.writeFile(path.resolve(file));
  console.log(`frozen and saved: ${path.resolve(file)}`);
}

main().catch((err) => {
  console.error("freeze-term failed:", err.message);
  process.exit(1);
});
