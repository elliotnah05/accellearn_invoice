/**
 * Test harness for the Master-only roster rules.
 *
 * The app's promise is that the admin only ever edits the `Master` tab — adding
 * a student anywhere in the level-grouped list, or removing one — and every term
 * tab looks after itself. Proving that needs a faithful stand-in for EXCEL, not
 * just for the app: when a row is inserted or deleted on Master, Excel shifts
 * every cross-sheet reference, breaks references to deleted rows into #REF!, and
 * recalculates every mirror. This file reproduces exactly those three effects on
 * a COPY of a workbook, then runs the app's own refresh pipeline over the result.
 *
 * No student data is ever written into the repo: every scenario works on a
 * throw-away copy in the OS temp dir.
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const Module = require("module");
const { execFileSync } = require("child_process");

const APP_DIR = path.resolve(__dirname, "..", "..");
// Compiled inside node_modules (git-ignored) so the emitted CommonJS can still
// resolve xlsx/exceljs the ordinary way, by walking up to app/node_modules.
const OUT = path.join(APP_DIR, "node_modules", ".cache", "accel-roster-tests");
const WORK = path.join(os.tmpdir(), "accel-roster-tests", "work");

// The libraries under test are TypeScript using the "@/..." path alias. Compile
// them to CommonJS once per run, then teach require() about the alias.
function buildLibs() {
  fs.mkdirSync(OUT, { recursive: true });
  // Run the compiler through node directly rather than npx: on Windows npx
  // resolves to a .cmd shim that execFileSync can't spawn.
  const tsc = path.join(APP_DIR, "node_modules", "typescript", "bin", "tsc");
  try {
    execFileSync(
      process.execPath,
      [tsc, "lib/parse-students.ts", "lib/sheet-writeback.ts", "lib/billing-store.ts",
       "lib/paths.ts", "types/student.ts",
       "--outDir", OUT, "--module", "commonjs", "--target", "es2020",
       "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck", "--rootDir", "."],
      { cwd: APP_DIR, stdio: "pipe" }
    );
  } catch {
    // tsc exits non-zero purely because the "@/..." aliases don't resolve without
    // the project tsconfig. The emitted JavaScript is still correct and complete.
  }
  if (!fs.existsSync(path.join(OUT, "lib", "parse-students.js"))) {
    throw new Error("could not compile lib/ for testing — run `npm install` in app/ first");
  }
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...args) {
    if (request.startsWith("@/")) request = path.join(OUT, request.slice(2));
    return resolve.call(this, request, ...args);
  };
}

/** Where the workbook to test against lives: --workbook, then
 *  ACCEL_TEST_WORKBOOK, then whatever the app itself is configured to read. */
function findWorkbook(argv) {
  const flag = argv.indexOf("--workbook");
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1];
  if (process.env.ACCEL_TEST_WORKBOOK) return process.env.ACCEL_TEST_WORKBOOK;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(APP_DIR, "app", "config", "template.json"), "utf8").replace(/^﻿/, ""));
    if (cfg.spreadsheetPath && fs.existsSync(cfg.spreadsheetPath)) return cfg.spreadsheetPath;
  } catch { /* no config on this machine */ }
  return null;
}

const isMaster = (n) => n.trim().toLowerCase() === "master";

let ExcelJS;
function excel() {
  if (!ExcelJS) ExcelJS = require(path.join(APP_DIR, "node_modules", "exceljs"));
  return ExcelJS;
}

function freshCopy(src, name) {
  fs.mkdirSync(WORK, { recursive: true });
  const dest = path.join(WORK, name);
  fs.copyFileSync(src, dest);
  return dest;
}

/** A config + private data dir, so a test run never touches the real ledger. */
function makeConfig(file) {
  const dataDir = path.join(WORK, "data", path.basename(file, ".xlsx"));
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "template.json"), JSON.stringify({ spreadsheetPath: file, outputFolder: WORK }));
  fs.writeFileSync(path.join(dataDir, "receipts-ledger.json"), "{}");
  process.env.ACCEL_DATA_DIR = dataDir;
  return { spreadsheetPath: file, outputFolder: WORK };
}

/** Excel rewrites every Master!<col><row> reference on the OTHER sheets when
 *  rows are inserted or deleted. `map` returns the new row number, or null for a
 *  reference whose target is gone (which Excel turns into #REF!). */
function retargetMasterRefs(wb, map) {
  for (const ws of wb.worksheets) {
    if (isMaster(ws.name)) continue;
    for (let r = 1; r <= ws.rowCount; r++) {
      for (let c = 1; c <= 19; c++) {
        const cell = ws.getRow(r).getCell(c);
        const v = cell.value;
        if (!v || typeof v !== "object" || !("formula" in v)) continue;
        let broke = false;
        const f = String(v.formula).replace(/Master!(\$?)([A-Z]+)(\$?)(\d+)/g, (_m, d1, col, d2, num) => {
          const nr = map(Number(num));
          if (nr === null) { broke = true; return "Master!#REF!"; }
          return `Master!${d1}${col}${d2}${nr}`;
        });
        if (broke) cell.value = { formula: f, result: { error: "#REF!" } };
        else if (f !== v.formula) cell.value = { formula: f, ...(v.result !== undefined ? { result: v.result } : {}) };
      }
    }
  }
}

/** Excel recalculates on every edit, so by the time a file is saved every
 *  mirror's cached value agrees with Master. Without this the simulated
 *  workbook would carry stale values Excel could never have written. */
function recalcMirrors(wb) {
  const master = wb.worksheets.find((w) => isMaster(w.name));
  // Master's own Serial No column: IF(B#="","",COUNTA($B$2:B#)).
  let seen = 0;
  for (let r = 2; r <= master.rowCount; r++) {
    const cell = master.getRow(r).getCell(1);
    const v = cell.value;
    if (!v || typeof v !== "object" || !("formula" in v)) continue;
    const name = master.getRow(r).getCell(2).value;
    const filled = name !== null && name !== undefined && String(name) !== "";
    if (filled) seen++;
    cell.value = { formula: v.formula, ...(filled ? { result: seen } : {}) };
  }
  const valueAt = (col, row) => {
    const v = master.getRow(Number(row)).getCell(col.charCodeAt(0) - 64).value;
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
      if ("formula" in v) return v.result === null || v.result === undefined ? "" : v.result;
      if ("richText" in v) return v.richText.map((t) => t.text).join("");
      return "";
    }
    return v;
  };
  for (const ws of wb.worksheets) {
    if (isMaster(ws.name)) continue;
    for (let r = 1; r <= ws.rowCount; r++) {
      for (let c = 1; c <= 19; c++) {
        const cell = ws.getRow(r).getCell(c);
        const v = cell.value;
        if (!v || typeof v !== "object" || !("formula" in v)) continue;
        const m = String(v.formula).match(/^IF\(Master!\$?([A-Z]+)\$?(\d+)="","",Master!/i);
        if (!m) continue;
        const val = valueAt(m[1], m[2]);
        cell.value = { formula: v.formula, ...(val === "" ? {} : { result: val }) };
      }
    }
  }
}

/** Excel: right-click a Master row number → Insert, then type the child in. */
async function simulateInsert(file, atRow, student) {
  const wb = new (excel().Workbook)();
  await wb.xlsx.readFile(file);
  const master = wb.worksheets.find((w) => isMaster(w.name));
  retargetMasterRefs(wb, (r) => (r >= atRow ? r + 1 : r));
  master.spliceRows(atRow, 0, []);
  const row = master.getRow(atRow);
  const style = JSON.parse(JSON.stringify(master.getRow(atRow + 1).getCell(2).style || {}));
  const vals = [
    { formula: `IF(B${atRow}="","",COUNTA($B$2:B${atRow}))`, result: 0 },
    student.name, student.parent, student.school, student.level, student.subject, student.hrs, student.rate,
  ];
  vals.forEach((v, i) => { row.getCell(i + 1).value = v; row.getCell(i + 1).style = style; });
  for (let r = 2; r <= master.rowCount; r++) {
    const c = master.getRow(r).getCell(1);
    if (c.value && typeof c.value === "object" && "formula" in c.value) {
      c.value = { formula: `IF(B${r}="","",COUNTA($B$2:B${r}))`, result: c.value.result };
    }
  }
  recalcMirrors(wb);
  await wb.xlsx.writeFile(file);
}

/** Excel: right-click a Master row number → Delete. */
async function simulateDelete(file, atRow, count = 1) {
  const wb = new (excel().Workbook)();
  await wb.xlsx.readFile(file);
  const master = wb.worksheets.find((w) => isMaster(w.name));
  retargetMasterRefs(wb, (r) => (r >= atRow && r < atRow + count ? null : r > atRow ? r - count : r));
  master.spliceRows(atRow, count);
  recalcMirrors(wb);
  await wb.xlsx.writeFile(file);
}

/** Excel: select the Master row's cells and press Delete — the row stays, empty. */
async function simulateClear(file, rows) {
  const wb = new (excel().Workbook)();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets.find((w) => isMaster(w.name));
  for (const r of rows) for (let c = 2; c <= 9; c++) ws.getRow(r).getCell(c).value = null;
  recalcMirrors(wb);
  await wb.xlsx.writeFile(file);
}

/** Turn a term tab into a closed record, the way freeze-term.js does. */
function freezeTerm(file, sheet) {
  execFileSync("node", [path.join(APP_DIR, "scripts", "freeze-term.js"), file, sheet], { stdio: "pipe" });
}

function cellText(cell) {
  const v = cell.value;
  if (v && typeof v === "object") {
    if ("formula" in v) {
      const r = v.result;
      return r && typeof r === "object" && "error" in r ? String(r.error) : String(r ?? "");
    }
    if ("error" in v) return String(v.error);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
  }
  return String(v ?? "");
}

/** Exactly what app/api/students/route.ts does on ⟳ Refresh. */
async function refresh(config, file, sheet) {
  const { parseWorkbook } = require(path.join(OUT, "lib", "parse-students.js"));
  const { assignMissingStudentIds, syncTermRosters, tidyTermTabs } = require(path.join(OUT, "lib", "sheet-writeback.js"));
  const steps = [];
  const writes = [];
  let result = parseWorkbook(fs.readFileSync(file), sheet);
  // Tidy runs on every refresh (matching the route): a husk can live only on a
  // tab the admin never views, where no per-tab trigger would ever fire.
  {
    const c = await tidyTermTabs(config);
    steps.push(`tidy ${JSON.stringify(c)}`);
    if (c.removed + c.cleared + c.repaired > 0) { writes.push("tidy"); result = parseWorkbook(fs.readFileSync(file), sheet); }
    else if (c.warning && (result.leftoverRows.length > 0 || result.frozenTab)) result.errors.push(c.warning);
  }
  if (result.rosterGaps.length > 0) {
    const s = await syncTermRosters(config);
    steps.push(`sync ${JSON.stringify(s)}`);
    if (s.rows > 0) { writes.push("sync"); result = parseWorkbook(fs.readFileSync(file), sheet); }
    else if (s.warning) result.errors.push(s.warning);
  }
  if (result.students.some((s) => !s.studentId)) {
    const a = await assignMissingStudentIds(config);
    steps.push(`assign ${JSON.stringify(a)}`);
    if (a.assigned > 0) { writes.push("assign"); result = parseWorkbook(fs.readFileSync(file), sheet); }
    else if (a.warning) result.errors.push(a.warning);
  }
  return { result, steps, writes };
}

/** Anything on a term tab an admin would have to look at or tidy by hand. */
async function residue(file) {
  const wb = new (excel().Workbook)();
  await wb.xlsx.readFile(file);
  const out = [];
  for (const ws of wb.worksheets) {
    if (isMaster(ws.name)) continue;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      let identity = "", term = "";
      for (let c = 2; c <= 8; c++) identity += cellText(row.getCell(c));
      for (let c = 9; c <= 18; c++) term += cellText(row.getCell(c));
      if (/#REF!/.test(identity + term)) out.push(`${ws.name} r${r}: #REF!`);
      else if (identity.trim() === "" && term.trim() !== "") out.push(`${ws.name} r${r}: nameless row still holding "${term.slice(0, 24)}"`);
    }
  }
  return out;
}

/** Master row numbers of the first single-subject child and the first
 *  multi-subject child, so scenarios don't hardcode anyone's position. */
async function findSubjects(file) {
  const wb = new (excel().Workbook)();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets.find((w) => isMaster(w.name));
  const children = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const name = cellText(ws.getRow(r).getCell(2)).trim();
    const subject = cellText(ws.getRow(r).getCell(6)).trim();
    if (name) children.push({ row: r, name, id: cellText(ws.getRow(r).getCell(9)).trim(), rows: 1 });
    else if (subject && children.length) children[children.length - 1].rows++;
  }
  return {
    children,
    single: children.find((c) => c.rows === 1 && c.row > 3),
    multi: children.find((c) => c.rows > 1),
    last: children[children.length - 1],
  };
}

module.exports = {
  APP_DIR, OUT, WORK, buildLibs, findWorkbook, freshCopy, makeConfig,
  simulateInsert, simulateDelete, simulateClear, freezeTerm, recalcMirrors,
  refresh, residue, findSubjects, cellText, isMaster, excel,
};
