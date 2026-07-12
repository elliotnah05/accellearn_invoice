import { readFileSync, statSync, existsSync } from "fs";
import { parseWorkbook } from "@/lib/parse-students";
import type { TemplateConfig } from "@/app/api/config/route";
import { CONFIG_PATH } from "@/lib/paths";

/** GET → parse the master spreadsheet live from the configured path.
 *  This is what lets the admin skip re-importing: edit Excel, save, refresh. */
export async function GET() {
  let config: TemplateConfig;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
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
    const result = parseWorkbook(readFileSync(file));
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
