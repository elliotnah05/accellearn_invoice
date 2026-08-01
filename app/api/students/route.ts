import { readFileSync, statSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { parseWorkbook, idOrderChanged } from "@/lib/parse-students";
import { assignMissingStudentIds, syncTermRosters, tidyTermTabs } from "@/lib/sheet-writeback";
import type { TemplateConfig } from "@/app/api/config/route";
import { CONFIG_PATH, DATA_DIR, readJson } from "@/lib/paths";

// Last-seen student order per term tab, kept in the app's data dir. Sorting
// Master reshuffles which student each term row mirrors while the term's own
// data stays put — the one corruption a single read can't see. Comparing this
// refresh's ID order against the previous one catches it.
const ID_ORDER_PATH = path.join(DATA_DIR, "id-order.json");

function checkStudentOrder(sheetName: string, ids: string[]): string | null {
  let store: Record<string, string[]> = {};
  try { store = readJson<Record<string, string[]>>(ID_ORDER_PATH); } catch { /* first run */ }
  const prev = store[sheetName];
  const changed = prev ? idOrderChanged(prev, ids) : false;
  try {
    store[sheetName] = ids;
    writeFileSync(ID_ORDER_PATH, JSON.stringify(store), "utf8");
  } catch { /* data dir read-only — detection just won't persist */ }
  if (!changed) return null;
  return (
    "The ORDER of students on this term tab changed since the last refresh — this usually means Master was sorted or rows were " +
    "moved around. The mirrored name columns move but each term's lessons/fees/receipt marks DON'T, so they may now sit beside " +
    "the wrong children. If you didn't rearrange students on purpose, close the file without saving or restore the previous " +
    "version from Drive (right-click the file → Version history). If the change was intentional, refresh again and this notice clears."
  );
}

/** GET → parse the master spreadsheet live from the configured path.
 *  This is what lets the admin skip re-importing: edit Excel, save, refresh.
 *  Optional `?sheet=<tab name>` bills a specific term tab; without it, the
 *  active term (first tab after Master). The response always lists every term
 *  tab in `sheetNames` so the UI can offer a picker. */
export async function GET(request: Request) {
  const requestedSheet = new URL(request.url).searchParams.get("sheet") ?? undefined;
  let config: TemplateConfig;
  try {
    config = readJson<TemplateConfig>(CONFIG_PATH);
  } catch {
    return Response.json({ error: "Could not read app config" }, { status: 500 });
  }

  const file = config.spreadsheetPath?.trim();
  if (!file) {
    return Response.json(
      { error: "Master spreadsheet path not set — add it in Invoice Template → Folders." },
      { status: 400 }
    );
  }
  if (!existsSync(file)) {
    return Response.json(
      { error: "Master spreadsheet not found at the configured path — check Invoice Template → Folders." },
      { status: 404 }
    );
  }

  try {
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — a student sheet is far smaller
    if (statSync(file).size > MAX_BYTES) {
      return Response.json({ error: "Master spreadsheet is unexpectedly large (over 10 MB) — refusing to parse." }, { status: 413 });
    }
    let result = parseWorkbook(readFileSync(file), requestedSheet);

    // Removing a student is done on Master alone. Excel leaves a trace on each
    // term tab — a dead #REF! row, or a nameless row still holding their
    // lessons and fees; clear those now so the admin never has to look at them
    // or tidy them by hand. Deleting the dead row is also what realigns the
    // tab, so the sheet returns to a clean state on its own. Best-effort: if
    // Excel has the file open the rows are simply skipped this time (the parser
    // already ignores them) and cleared on a later refresh.
    if (result.leftoverRows.length > 0) {
      const cleaned = await tidyTermTabs(config);
      if (cleaned.removed + cleaned.cleared > 0) {
        result = parseWorkbook(readFileSync(file), requestedSheet); // re-read the tidied sheet
      } else if (cleaned.warning) {
        result = { ...result, errors: [...result.errors, cleaned.warning] };
      }
    }

    // Adding a student is done on Master alone too — including in the middle of
    // the list, beside the others of their level. Excel shifts the existing
    // links (so nobody else's lessons, fees or receipt marks move) but never
    // creates a row for the newcomer, who would then never be billed. Give them
    // one, in the same position they hold on Master, on every live term tab.
    if (result.rosterGaps.length > 0) {
      const synced = await syncTermRosters(config);
      if (synced.rows > 0) {
        result = parseWorkbook(readFileSync(file), requestedSheet); // re-read with the new rows
        if (synced.names.length > 0) {
          result = {
            ...result,
            errors: [
              ...result.errors,
              `Added to the term tabs: ${synced.names.join(", ")}. Check their Lessons and Material Fee for this ` +
              `term before generating — a blank Lessons cell bills the standard 12, and 0 means not enrolled this term.`,
            ],
          };
        }
      } else if (synced.warning) {
        result = { ...result, errors: [...result.errors, synced.warning] };
      }
    }

    // Any child without a permanent Student ID (new row typed into Master, or a
    // workbook that predates IDs) gets one assigned now, written into Master
    // column I and mirrored to the term tabs. Best-effort: if Excel has the
    // file open the parse result simply keeps its "no Student ID yet" error and
    // the admin refreshes after closing Excel.
    if (result.students.some((s) => !s.studentId)) {
      const assign = await assignMissingStudentIds(config);
      if (assign.assigned > 0) {
        result = parseWorkbook(readFileSync(file), requestedSheet); // re-read with fresh IDs
      } else if (assign.warning) {
        result = { ...result, errors: [...result.errors, assign.warning] };
      }
    }

    const orderWarning = checkStudentOrder(
      result.sheetName,
      result.students.map((s) => s.studentId).filter(Boolean)
    );
    if (orderWarning) result = { ...result, errors: [...result.errors, orderWarning] };

    return Response.json({
      ...result,
      source: "master",
      fileModified: statSync(file).mtime.toISOString(),
    });
  } catch (err) {
    console.error("Master sheet read error:", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Could not parse the master spreadsheet" }, { status: 500 });
  }
}
