# Roster regression tests

These guard the promise the whole spreadsheet design rests on:

> The admin only ever edits the **`Master`** tab — adding a student anywhere in
> the level-grouped list, or removing one — and every term tab looks after
> itself, without a single other student's lessons, fees, payments or receipt
> marks moving.

## Running them

```bash
npm run test:roster
npm run test:roster -- --workbook "C:/path/to/student details LATEST.xlsx"
```

The workbook is found in this order: `--workbook`, then `ACCEL_TEST_WORKBOOK`,
then whatever path the app itself is configured with (Settings → Folders). With
none of those available the suite **skips and exits 0**, so it is always safe to
run — including on a machine that has no spreadsheet at all.

## What they will not do

- **They never write to your spreadsheet.** Every scenario runs against a
  throw-away copy under the OS temp dir.
- **No student data ever enters this repo** (PDPA). The tests read a workbook
  you point them at; nothing from it is written into the project, and no
  fixture workbook is committed.

## Why the harness simulates Excel

Half of the behaviour under test belongs to Excel, not to the app. When a row is
inserted or deleted on `Master`, Excel shifts every cross-sheet reference along
with the student it points at, turns references to deleted rows into `#REF!`, and
recalculates every mirrored cell. Testing the app against a workbook that hasn't
had those three things done to it proves nothing, so `harness.js` reproduces them
faithfully before handing the file to the app's own refresh pipeline.

## Coverage

**Removing a student** (Master only) — deleting one row; deleting both rows of a
two-subject child; clearing the row's cells instead of deleting the row;
deleting the last student on the roster; deleting three students in one sitting;
dropping a single subject from a two-subject child.

**Adding a student** (Master only) — inserting in the middle of the list beside
others of their level; inserting at the very top; adding a second subject under
an existing child.

**Frozen terms** — a student removed later still appears on a frozen term (it is
the record of a term they really were billed for); the same student is gone from
the live term; no husk rows are left anywhere; a student added later never
appears on the frozen term.

**Student IDs** — an ID cleared by accident is recovered from that row's own
invoice/receipt stamp rather than re-minted; a new student never inherits a
departed student's ID.

Each scenario also asserts that a **second refresh settles**: the app must not
keep rewriting the workbook once it has tidied up.
