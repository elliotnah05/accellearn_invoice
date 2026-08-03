#!/usr/bin/env node
/**
 * Regression suite for the promise the whole spreadsheet design rests on:
 *
 *   the admin only ever edits the `Master` tab — adding a student anywhere in
 *   the level-grouped list, or removing one — and every term tab looks after
 *   itself, without a single other student's lessons, fees, payment or receipt
 *   marks moving.
 *
 * Usage:
 *   npm run test:roster
 *   npm run test:roster -- --workbook "C:/path/to/student details LATEST.xlsx"
 *
 * The workbook is found from --workbook, then ACCEL_TEST_WORKBOOK, then the path
 * the app itself is configured with. Every scenario runs on a throw-away COPY in
 * the temp dir; the real file is never written to, and no student data is ever
 * written into the repo. With no workbook available the suite skips rather than
 * fails, so it stays safe to run anywhere.
 */
const H = require("./harness");

let passed = 0, failed = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; failures.push(label); console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`); }
}

/** Identity of a student's billing state — anything here changing for someone
 *  who was neither added nor removed is the failure this suite exists to catch. */
const fingerprint = (s) =>
  `${s.studentName}|$${s.totalFee}|${s.subjects.length}subj|${s.invoiceIssued}|${s.paid}|${s.receiptIssued}|${s.receiptSent}`;

function whoMoved(before, after, allowed = []) {
  const b = new Map(before.students.map((s) => [s.studentId, s]));
  const moved = [];
  for (const s of after.students) {
    const prev = b.get(s.studentId);
    if (!prev || allowed.includes(s.studentId)) continue;
    if (fingerprint(prev) !== fingerprint(s)) moved.push(`${s.studentId}: ${fingerprint(prev)} → ${fingerprint(s)}`);
  }
  return moved;
}

const gone = (before, after) =>
  before.students.map((s) => s.studentId).filter((id) => !after.students.some((s) => s.studentId === id));

async function main() {
  const src = H.findWorkbook(process.argv);
  if (!src) {
    console.log("roster-tests: no workbook available — skipping.");
    console.log("  pass one with --workbook <path>, or set ACCEL_TEST_WORKBOOK,");
    console.log("  or configure the spreadsheet path in the app (Settings → Folders).");
    return 0;
  }
  console.log(`roster-tests: using a copy of ${src}\n`);
  H.buildLibs();

  // ── Removing a student, every way an admin does it ────────────────────────
  console.log("Removing a student (Master only)");
  {
    const probe = H.freshCopy(src, "probe.xlsx");
    const { single, multi, last } = await H.findSubjects(probe);

    const removal = async (label, mutate, expectGone, allowedToChange = []) => {
      const file = H.freshCopy(src, `rm-${label.replace(/\W+/g, "-").slice(0, 30)}.xlsx`);
      const config = H.makeConfig(file);
      const base = await H.refresh(config, file);
      await mutate(file);
      const after = await H.refresh(config, file);
      const moved = whoMoved(base.result, after.result, allowedToChange);
      const left = await H.residue(file);
      const settled = await H.refresh(config, file);
      const missing = gone(base.result, after.result);
      const ok =
        moved.length === 0 && left.length === 0 && settled.writes.length === 0 &&
        JSON.stringify(missing.sort()) === JSON.stringify(expectGone.slice().sort());
      check(label, ok,
        `gone=[${missing}] expected=[${expectGone}] moved=${moved.length ? moved[0] : "none"} residue=${left.length ? left[0] : "none"} resettled=${settled.writes}`);
    };

    await removal("delete one row on Master", (f) => H.simulateDelete(f, single.row, 1), [single.id]);
    await removal("delete both rows of a two-subject child", (f) => H.simulateDelete(f, multi.row, multi.rows), [multi.id]);
    await removal("clear the row's cells instead of deleting it", (f) => H.simulateClear(f, [single.row]), [single.id]);
    await removal("delete the last student on the roster", (f) => H.simulateDelete(f, last.row, last.rows), [last.id]);
    await removal("delete three students in one sitting, bottom-up", async (f) => {
      await H.simulateDelete(f, last.row, last.rows);
      await H.simulateDelete(f, multi.row, multi.rows);
      await H.simulateDelete(f, single.row, 1);
    }, [last.id, multi.id, single.id]);
    await removal("drop one subject of a two-subject child", (f) => H.simulateDelete(f, multi.row + 1, 1), [], [multi.id]);
  }

  // ── Adding a student, anywhere in the list ────────────────────────────────
  console.log("\nAdding a student (Master only)");
  {
    const probe = H.freshCopy(src, "probe2.xlsx");
    const { children } = await H.findSubjects(probe);
    const middle = children[Math.floor(children.length / 2)];

    const addition = async (label, atRow) => {
      const file = H.freshCopy(src, `add-${label.replace(/\W+/g, "-").slice(0, 30)}.xlsx`);
      const config = H.makeConfig(file);
      const base = await H.refresh(config, file);
      await H.simulateInsert(file, atRow, {
        name: "Test Newcomer", parent: "Test Parent", school: "Test School",
        level: "P5", subject: "Math", hrs: 2, rate: 40,
      });
      const after = await H.refresh(config, file);
      const kid = after.result.students.find((s) => s.studentName === "Test Newcomer");
      const moved = whoMoved(base.result, after.result);
      const settled = await H.refresh(config, file);
      check(label,
        !!kid && !!kid.studentId && kid.totalFee > 0 &&
        moved.length === 0 && gone(base.result, after.result).length === 0 && settled.writes.length === 0,
        `billed=${!!kid} id=${kid && kid.studentId} moved=${moved.length ? moved[0] : "none"} resettled=${settled.writes}`);
    };

    await addition("insert in the middle of Master, at their level", middle.row);
    await addition("insert at the very top of Master", 2);

    // An extra subject typed under an existing child.
    {
      const file = H.freshCopy(src, "add-subject.xlsx");
      const config = H.makeConfig(file);
      const base = await H.refresh(config, file);
      const { single } = await H.findSubjects(file);
      const before = base.result.students.find((s) => s.studentId === single.id);
      await H.simulateInsert(file, single.row + 1, { name: "", parent: "", school: "", level: "", subject: "Science", hrs: 2, rate: 40 });
      const after = await H.refresh(config, file);
      const now = after.result.students.find((s) => s.studentId === single.id);
      const moved = whoMoved(base.result, after.result, [single.id]);
      check("add a second subject under an existing child",
        !!now && now.subjects.length === before.subjects.length + 1 && now.totalFee > before.totalFee && moved.length === 0,
        `subjects ${before.subjects.length} → ${now && now.subjects.length}, others moved=${moved.length ? moved[0] : "none"}`);
    }
  }

  // ── Two children sharing a name ───────────────────────────────────────────
  // Name alone is not identity. Matching on it made a new child who shared a
  // name with an existing student permanently invisible: never given a term
  // row, therefore never scanned for a Student ID, with every name-based check
  // satisfied by the namesake. The identity key for children without an ID is
  // now name PLUS parent.
  console.log("\nTwo children sharing a name");
  {
    const probe = H.freshCopy(src, "probe3.xlsx");
    const { children } = await H.findSubjects(probe);
    const namesake = children[2];

    // Different parent → genuinely a different child → must be billed.
    {
      const file = H.freshCopy(src, "twin-diff-parent.xlsx");
      const config = H.makeConfig(file);
      const base = await H.refresh(config, file);
      await H.simulateInsert(file, children[children.length - 1].row + 1, {
        name: namesake.name, parent: "A Different Parent", school: "Other Sch",
        level: "P6", subject: "Chemistry", hrs: 2, rate: 60,
      });
      const after = await H.refresh(config, file);
      const twins = after.result.students.filter((s) => s.studentName === namesake.name);
      const ids = twins.map((s) => s.studentId);
      const moved = whoMoved(base.result, after.result);
      check("a new child sharing an existing student's name still gets billed",
        twins.length === 2 && ids.every((id) => /^S\d+$/.test(id)) && ids[0] !== ids[1] &&
        twins.every((s) => s.totalFee > 0) && moved.length === 0,
        `students named "${namesake.name}": ${twins.length}, IDs: ${ids.join("/") || "none"}, moved=${moved.length ? moved[0] : "none"}`);
    }

    // Same parent too → nothing on the sheet can tell them apart → the app
    // must say so instead of silently guessing either way.
    {
      const file = H.freshCopy(src, "twin-same-parent.xlsx");
      const config = H.makeConfig(file);
      await H.refresh(config, file);
      const { children: kids } = await H.findSubjects(file);
      const dup = kids[2];
      const wb = new (H.excel().Workbook)();
      await wb.xlsx.readFile(file);
      const m = wb.worksheets.find((w) => H.isMaster(w.name));
      const parent = H.cellText(m.getRow(dup.row).getCell(3));
      await wb.xlsx.writeFile(file);
      await H.simulateInsert(file, kids[kids.length - 1].row + 1, {
        name: dup.name, parent, school: "S", level: "P6", subject: "Physics", hrs: 2, rate: 60,
      });
      const after = await H.refresh(config, file);
      const warned = after.result.errors.some((e) => e.includes("SAME name and parent") && e.includes(dup.name));
      check("identical name AND parent produces a warning, not a silent guess", warned,
        `errors: ${after.result.errors.slice(0, 2).join(" | ") || "none"}`);
    }

    // Several new rows typed before ONE refresh, two of them identical. The
    // dedupe checks the tab as it WAS, so it cannot see same-batch duplicates —
    // the insert pass has to dedupe against itself as well. (Found live: two
    // identical test rows and one different-parent row, one refresh → all
    // three billed.)
    {
      const file = H.freshCopy(src, "twin-batch.xlsx");
      const config = H.makeConfig(file);
      await H.refresh(config, file);
      const { children: kids } = await H.findSubjects(file);
      const bottom = kids[kids.length - 1].row + 1;
      await H.simulateInsert(file, bottom, { name: "Batch Twin", parent: "Same Parent", school: "S", level: "P4", subject: "Math", hrs: 2, rate: 40 });
      await H.simulateInsert(file, bottom + 1, { name: "Batch Twin", parent: "Same Parent", school: "S", level: "P4", subject: "Science", hrs: 2, rate: 50 });
      await H.simulateInsert(file, bottom + 2, { name: "Batch Twin", parent: "Different Parent", school: "S", level: "P4", subject: "English", hrs: 2, rate: 45 });
      const after = await H.refresh(config, file);
      const twins = after.result.students.filter((s) => s.studentName === "Batch Twin");
      const warned = after.result.errors.some((e) => e.includes("SAME name and parent"));
      check("two identical rows typed in one batch don't both get billed",
        twins.length === 2 && warned,
        `billed rows named Batch Twin: ${twins.length} (want 2: one of the identical pair + the different-parent child), warned=${warned}`);
    }

    // The reason name matching exists at all: a row pasted over as plain values
    // (no link) still bills its student — they must NOT get a second row.
    {
      const file = H.freshCopy(src, "pasted-values.xlsx");
      const config = H.makeConfig(file);
      const base = await H.refresh(config, file);
      const { single } = await H.findSubjects(file);
      const wb = new (H.excel().Workbook)();
      await wb.xlsx.readFile(file);
      for (const ws of wb.worksheets) {
        if (H.isMaster(ws.name)) continue;
        for (let r = 2; r <= ws.rowCount; r++) {
          if (H.cellText(ws.getRow(r).getCell(19)).trim().toUpperCase() !== single.id.toUpperCase()) continue;
          for (let c = 1; c <= 19; c++) {
            const cell = ws.getRow(r).getCell(c);
            const v = cell.value;
            if (v && typeof v === "object" && "formula" in v) {
              const res = v.result;
              cell.value = res === null || res === undefined ? null : res;
            }
          }
        }
      }
      await wb.xlsx.writeFile(file);
      const after = await H.refresh(config, file);
      const rows = after.result.students.filter((s) => s.studentName === single.name);
      check("a row pasted as plain values never gets a duplicate inserted beside it",
        rows.length === 1 && after.result.students.length === base.result.students.length,
        `rows for ${single.name}: ${rows.length}, roster ${base.result.students.length} → ${after.result.students.length}`);
    }
  }

  // ── Husks the viewed tab cannot see ───────────────────────────────────────
  // A husk on a tab with no typed term data reads as an all-blank row through
  // the flattened parse, so it used to be discarded before the leftover check —
  // and if the active tab's own husks were tidied by hand, nothing ever
  // triggered the cleaner again. The orphan check now runs before the blank
  // skip, and the tidy pass runs on every refresh.
  console.log("\nHusks the viewed tab cannot see");
  {
    const file = H.freshCopy(src, "invisible-husks.xlsx");
    const config = H.makeConfig(file);
    const { single } = await H.findSubjects(file);
    const activeSheet = (await H.refresh(config, file)).result.sheetName;
    await H.simulateDelete(file, single.row, 1);
    // Hand-tidy ONLY the active tab, the way an admin who sees #REF! would —
    // leaving just the data-less husks on the other tabs.
    const wb = new (H.excel().Workbook)();
    await wb.xlsx.readFile(file);
    const ws = wb.worksheets.find((w) => w.name === activeSheet);
    for (let r = ws.rowCount; r >= 2; r--) {
      const v = ws.getRow(r).getCell(2).value;
      const isErr = v !== null && typeof v === "object" &&
        (("error" in v) || ("result" in v && v.result && typeof v.result === "object" && "error" in v.result));
      if (isErr) ws.spliceRows(r, 1);
    }
    await wb.xlsx.writeFile(file);
    const preResidue = await H.residue(file);
    await H.refresh(config, file);
    const postResidue = await H.residue(file);
    check("husks left only on unviewed tabs are still cleaned on refresh",
      preResidue.length > 0 && postResidue.length === 0,
      `before refresh: ${preResidue.length} husk(s), after: ${postResidue.length} (${postResidue[0] || "clean"})`);
  }

  // ── A frozen term is a closed record ──────────────────────────────────────
  console.log("\nFrozen terms");
  {
    const file = H.freshCopy(src, "frozen.xlsx");
    const config = H.makeConfig(file);
    const base = await H.refresh(config, file);
    const frozenSheet = base.result.sheetNames[base.result.sheetNames.length - 1];
    if (!frozenSheet || base.result.sheetNames.length < 2) {
      console.log("  SKIP  workbook has only one term tab");
    } else {
      H.freezeTerm(file, frozenSheet);
      const { single } = await H.findSubjects(file);
      const wasOnFrozen = (await H.refresh(config, file, frozenSheet)).result.students.some((s) => s.studentId === single.id);

      await H.simulateDelete(file, single.row, 1);
      const afterFrozen = await H.refresh(config, file, frozenSheet);
      check("a student removed later still appears on a frozen term",
        wasOnFrozen && afterFrozen.result.students.some((s) => s.studentId === single.id),
        `on frozen tab before=${wasOnFrozen} after=${afterFrozen.result.students.some((s) => s.studentId === single.id)}`);

      const live = await H.refresh(config, file);
      check("the same student is gone from the live term",
        !live.result.students.some((s) => s.studentId === single.id));
      check("no husk rows are left anywhere", (await H.residue(file)).length === 0, (await H.residue(file))[0]);

      // A student added later must NOT appear on the closed term.
      await H.simulateInsert(file, 2, { name: "Late Joiner", parent: "P", school: "S", level: "P5", subject: "Math", hrs: 2, rate: 40 });
      await H.refresh(config, file);
      const frozenAfterAdd = await H.refresh(config, file, frozenSheet);
      const liveAfterAdd = await H.refresh(config, file);
      check("a student added later never appears on a frozen term",
        !frozenAfterAdd.result.students.some((s) => s.studentName === "Late Joiner") &&
        liveAfterAdd.result.students.some((s) => s.studentName === "Late Joiner"));
    }
  }

  // ── Student IDs: the identity everything else keys on ─────────────────────
  console.log("\nStudent IDs");
  {
    const file = H.freshCopy(src, "ids.xlsx");
    const config = H.makeConfig(file);
    const base = await H.refresh(config, file);
    const { single } = await H.findSubjects(file);

    // An ID cleared by accident must be recovered from that row's own stamps,
    // not replaced by a fresh number (which would orphan their history).
    const wb = new (H.excel().Workbook)();
    await wb.xlsx.readFile(file);
    wb.worksheets.find((w) => H.isMaster(w.name)).getRow(single.row).getCell(9).value = null;
    H.recalcMirrors(wb);
    await wb.xlsx.writeFile(file);
    const recovered = await H.refresh(config, file);
    const student = recovered.result.students.find((s) => s.studentName === single.name);
    const hadStamp = base.result.students.some((s) => s.studentId === single.id && /(?:INV|R)-/.test(s.invoiceIssued + s.receiptIssued));
    if (!hadStamp) console.log("  SKIP  no invoice/receipt stamp on that row to recover from");
    else check("a cleared Student ID is recovered from that row's own stamp",
      !!student && student.studentId === single.id, `expected ${single.id}, got ${student && student.studentId}`);

    // A departed student's ID must never be handed to someone new.
    const file2 = H.freshCopy(src, "ids2.xlsx");
    const config2 = H.makeConfig(file2);
    const base2 = await H.refresh(config2, file2);
    const highest = Math.max(...base2.result.students.map((s) => Number(String(s.studentId).slice(1)) || 0));
    const { single: leaver } = await H.findSubjects(file2);
    await H.simulateDelete(file2, leaver.row, 1);
    await H.refresh(config2, file2);
    await H.simulateInsert(file2, leaver.row, { name: "Replacement Kid", parent: "P", school: "S", level: "P6", subject: "Math", hrs: 2, rate: 40 });
    const after2 = await H.refresh(config2, file2);
    const replacement = after2.result.students.find((s) => s.studentName === "Replacement Kid");
    check("a new student never inherits a departed student's ID",
      !!replacement && replacement.studentId !== leaver.id && Number(String(replacement.studentId).slice(1)) > highest,
      `new student got ${replacement && replacement.studentId}, leaver had ${leaver.id}, highest was S${highest}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) console.log("failed: " + failures.join("; "));
  return failed === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => { console.error("roster-tests crashed:", err); process.exit(1); });
