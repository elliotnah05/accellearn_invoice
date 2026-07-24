import { readFileSync, statSync, existsSync } from "fs";
import { parseWorkbook } from "@/lib/parse-students";
import type { TemplateConfig } from "@/app/api/config/route";
import { CONFIG_PATH, readJson } from "@/lib/paths";

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
    const result = parseWorkbook(readFileSync(file), requestedSheet);
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
