#!/usr/bin/env node
/**
 * One-time upgrade: give every child a permanent Student ID, and extend the
 * Master↔term-tab row links to the whole formatted sheet.
 *
 * Why: the app used to identify children by their serial number (column A),
 * which is positional — deleting a student renumbers everyone below, and every
 * record keyed on the old numbers (invoice/receipt numbers, write-back stamps,
 * the receipt ledger) silently points at the wrong child. The Student ID is
 * assigned once and never reused, so rows can be added, deleted and re-sorted
 * freely without any history shifting.
 *
 * What it does (idempotent — safe to re-run):
 *   1. Backs the workbook up next to itself (.backup-<timestamp>.xlsx).
 *   2. Master: adds a "Student ID" header in column I and assigns S001, S002…
 *      to every child that doesn't have one. Extends the serial-number formula
 *      in column A down the whole formatted sheet.
 *   3. Every term tab: adds the "Student ID" header in column S, mirrors
 *      Master column I via the same kind of formula that links A–H, and
 *      extends the A–H links from wherever they stop down the whole formatted
 *      sheet — so the roster is never cut off at a fixed row again.
 *   4. Audits each term tab for damage left by past row deletions: status
 *      values sitting on rows with no student (orphans) and broken #REF!
 *      links. Reports row numbers only (PDPA — no names printed); fixes are
 *      left to the admin, the script never deletes data.
 *
 * Usage:
 *   node scripts/add-student-ids.js "<workbook.xlsx>"
 *   node scripts/add-student-ids.js "<workbook.xlsx>" --dry-run   (report only)
 */
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const MASTER_COL_ID = 9;   // I on Master — typed source of truth for IDs
const COL_STUDENT_ID = 19; // S on term tabs — formula-linked mirror
const IDENTITY_LAST_COL = 8; // H — last Master-linked identity column
const COL_NAME = 2;        // B
const STATUS_COLS = [12, 13, 14, 15, 16, 17, 18]; // L–R: per-term status block

const isMaster = (name) => name.trim().toLowerCase() === "master";

function cellText(cell) {
  const v = cell.value;
  if (v && typeof v === "object") {
    // Formula cell: only its cached result counts — a formula with no cached
    // result (empty linked row) must read as blank, and error results (#REF!)
    // surface their error text.
    if ("formula" in v || "result" in v) {
      const r = v.result;
      if (r && typeof r === "object" && "error" in r) return String(r.error);
      return r === null || r === undefined ? "" : String(r).trim();
    }
    if ("error" in v) return String(v.error);
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    return "";
  }
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Master row this term row's name formula actually points at (null if the
 *  cell isn't formula-linked). Past insertions/deletions skew these targets
 *  (e.g. term row 100 → Master row 99), so alignment must never be assumed. */
function linkTarget(cell) {
  const v = cell.value;
  if (!v || typeof v !== "object" || !("formula" in v)) return null;
  const m = String(v.formula).match(/Master!\$?B\$?(\d+)/i);
  return m ? Number(m[1]) : null;
}

const isErrorText = (s) => /^#(REF|N\/A|VALUE|NAME|DIV\/0|NULL|NUM)[!?]?$/i.test(s.trim());

/** A row starts a new child when its name cell holds a value and isn't the
 *  tail of a vertical merge (multi-subject children merge the name cell). */
function isChildRow(cell) {
  if (cellText(cell) === "" || isErrorText(cellText(cell))) return false;
  return !cell.isMerged || cell.master.address === cell.address;
}

/** Last row of the formatted grid (banding/styles), i.e. "the whole
 *  spreadsheet" as the admin sees it. Links are extended down to here. */
function formattedExtent(ws) {
  return ws.rowCount;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const file = argv.find((a) => a !== "--dry-run");
  if (!file) {
    console.error('usage: node scripts/add-student-ids.js "<workbook.xlsx>" [--dry-run]');
    process.exit(1);
  }
  const abs = path.resolve(file);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(abs);
  const master = wb.worksheets.find((w) => isMaster(w.name));
  if (!master) {
    console.error('No "Master" tab found — this script needs the Master+term-tabs workbook layout.');
    process.exit(1);
  }
  const termSheets = wb.worksheets.filter((w) => !isMaster(w.name));

  // ── 1. Highest ID ever used (never reuse a deleted student's ID) ──────────
  let maxId = 0;
  const seen = (t) => {
    const m = t.match(/^S0*(\d+)$/i);
    if (m && Number(m[1]) > maxId) maxId = Number(m[1]);
  };
  for (const ws of wb.worksheets) {
    const col = isMaster(ws.name) ? MASTER_COL_ID : COL_STUDENT_ID;
    for (let r = 2; r <= ws.rowCount; r++) seen(cellText(ws.getRow(r).getCell(col)));
  }

  // ── 2. Master: header, IDs, serial formula down the whole sheet ───────────
  const mExtent = formattedExtent(master);
  const mHeader = master.getRow(1).getCell(MASTER_COL_ID);
  if (cellText(mHeader) === "") {
    mHeader.value = "Student ID";
    mHeader.style = JSON.parse(JSON.stringify(master.getRow(1).getCell(MASTER_COL_ID - 1).style ?? {}));
    master.getColumn(MASTER_COL_ID).width = 12;
    console.log("Master: added Student ID header (column I)");
  }

  let assigned = 0;
  for (let r = 2; r <= mExtent; r++) {
    const row = master.getRow(r);
    if (!isChildRow(row.getCell(COL_NAME))) continue;
    const idCell = row.getCell(MASTER_COL_ID);
    if (cellText(idCell) !== "") continue;
    maxId += 1;
    idCell.value = `S${String(maxId).padStart(3, "0")}`;
    idCell.style = {
      ...JSON.parse(JSON.stringify(idCell.style ?? {})),
      font: { name: "Calibri", size: 10 },
      alignment: { horizontal: "center", vertical: "middle" },
    };
    assigned++;
  }
  console.log(`Master: assigned ${assigned} new Student ID(s) (highest now S${String(maxId).padStart(3, "0")})`);

  let serialExtended = 0;
  for (let r = 2; r <= mExtent; r++) {
    const cell = master.getRow(r).getCell(1);
    const v = cell.value;
    const hasFormula = v && typeof v === "object" && "formula" in v;
    if (hasFormula || cellText(cell) !== "") continue;
    cell.value = { formula: `IF(B${r}="","",COUNTA($B$2:B${r}))` };
    serialExtended++;
  }
  if (serialExtended) console.log(`Master: serial-number formula extended over ${serialExtended} more row(s) (down to row ${mExtent})`);

  // ── 3. Term tabs: S column + extend A–H links to the whole sheet ──────────
  const colLetter = (c) => String.fromCharCode(64 + c); // 1→A … 8→H
  for (const ws of termSheets) {
    const extent = formattedExtent(ws);
    const sHeader = ws.getRow(1).getCell(COL_STUDENT_ID);
    if (cellText(sHeader) === "") {
      sHeader.value = "Student ID";
      sHeader.style = JSON.parse(JSON.stringify(ws.getRow(1).getCell(COL_STUDENT_ID - 1).style ?? {}));
      ws.getColumn(COL_STUDENT_ID).width = 12;
    }

    let linksAdded = 0, realigned = 0;
    const misaligned = [];
    for (let r = 2; r <= extent; r++) {
      const row = ws.getRow(r);
      const target = linkTarget(row.getCell(COL_NAME));
      const skewed = target !== null && target !== r;
      const hasRowData = [9, 10, 11, ...STATUS_COLS].some((c) => {
        const cell = row.getCell(c);
        if (cell.isMerged && cell.master.address !== cell.address) return false;
        return cellText(cell) !== "";
      });

      if (skewed && hasRowData) {
        // A skewed link on a row that carries real term data: re-pointing it
        // would detach the data from its student. Keep the row's own mapping
        // for the ID (so the ID matches the name shown) and flag for review.
        misaligned.push(r);
        const masterVal = cellText(master.getRow(target).getCell(MASTER_COL_ID));
        row.getCell(COL_STUDENT_ID).value = {
          formula: `IF(Master!I${target}="","",Master!I${target})`,
          ...(masterVal !== "" ? { result: masterVal } : {}),
        };
        continue;
      }

      // Empty (or straight) row: normalise the whole row to the canonical
      // row-for-row mapping, repairing any skew left by old insert/deletes.
      for (let c = 1; c <= IDENTITY_LAST_COL; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        const hasFormula = v && typeof v === "object" && "formula" in v;
        if (!hasFormula && cellText(cell) !== "") continue; // typed literal — leave it
        const L = colLetter(c);
        const want = `IF(Master!${L}${r}="","",Master!${L}${r})`;
        if (hasFormula && String(v.formula) === want) continue;
        const masterVal = cellText(master.getRow(r).getCell(c));
        cell.value = { formula: want, ...(masterVal !== "" ? { result: masterVal } : {}) };
        if (c === COL_NAME) (hasFormula ? realigned++ : linksAdded++);
      }
      // S: mirror Master column I, cached result set so the app sees IDs
      // immediately (formula results only refresh when Excel opens the file).
      const masterVal = cellText(master.getRow(r).getCell(MASTER_COL_ID));
      row.getCell(COL_STUDENT_ID).value = {
        formula: `IF(Master!I${r}="","",Master!I${r})`,
        ...(masterVal !== "" ? { result: masterVal } : {}),
      };
    }
    console.log(
      `${ws.name}: Student ID column linked (S), A–H links extended over ${linksAdded} row(s), ` +
      `${realigned} skewed empty row(s) re-aligned — roster now mirrors Master down to row ${extent}`
    );
    if (misaligned.length > 0) {
      console.log(`  ⚠ ${ws.name}: rows with data whose links are SKEWED (left untouched, review by hand): ${misaligned.join(", ")}`);
    }
  }

  // ── 4. Audit: damage left behind by past row deletions ────────────────────
  console.log("\n── Audit " + "─".repeat(50));
  let findings = 0;
  for (const ws of termSheets) {
    let current = null; // row number of the child this row belongs to
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = cellText(row.getCell(COL_NAME));
      const nameCell = row.getCell(COL_NAME);
      if (isErrorText(name)) {
        console.log(`  ⚠ ${ws.name} row ${r}: broken link to Master (${name}) — leftover of a deleted student; delete this row.`);
        findings++;
        current = null;
        continue;
      }
      if (name !== "" && (!nameCell.isMerged || nameCell.master.address === nameCell.address)) current = r;
      if (name === "" && !nameCell.isMerged) {
        // No child here: any subject or status content is stranded.
        const hasSubject = cellText(row.getCell(6)) !== "" || cellText(row.getCell(8)) !== "";
        const statusCols = STATUS_COLS.filter((c) => {
          const cell = row.getCell(c);
          if (cell.isMerged && cell.master.address !== cell.address) return false; // merged tail of the child above
          return cellText(cell) !== "";
        });
        if (!hasSubject && statusCols.length > 0 && current === null) {
          console.log(`  ⚠ ${ws.name} row ${r}: status marks (${statusCols.map((c) => colHeader(ws, c)).join(", ")}) but no student on or above this row — orphaned by a deletion; verify and clear the cells or delete the row.`);
          findings++;
        }
        if (!hasSubject && statusCols.length === 0) current = null; // fully blank row ends the child group
      }
    }
  }
  if (findings === 0) console.log("  ✓ no orphaned rows or broken links found");

  function colHeader(ws, c) {
    return cellText(ws.getRow(1).getCell(c)) || `col ${c}`;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backup = abs.replace(/\.xlsx$/i, `.backup-${stamp}.xlsx`);
  fs.copyFileSync(abs, backup);
  console.log(`\nbackup: ${backup}`);
  await wb.xlsx.writeFile(abs);
  console.log(`saved:  ${abs}`);
}

main().catch((err) => {
  console.error("add-student-ids failed:", err.message);
  process.exit(1);
});
