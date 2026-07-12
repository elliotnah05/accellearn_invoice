import { NextRequest } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG_PATH } from "@/lib/paths";

export interface ScheduleRow {
  label: string;
  period: string;
  type: "term" | "break";
}

export interface TemplateConfig {
  companyName: string;
  payNowUEN: string;
  clause1: string;
  schedule: ScheduleRow[];
  feeScheduleIntro: string;
  feeScheduleLines: string[];
  clause4: string;
  /** Shared folder (e.g. OneDrive) where invoice/receipt PDFs are written */
  outputFolder?: string;
  /** Path to the master student spreadsheet, for receipt status write-back */
  spreadsheetPath?: string;
}

function readConfig(): TemplateConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

export async function GET() {
  try {
    return Response.json(readConfig());
  } catch {
    return Response.json({ error: "Could not read config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as TemplateConfig;
    if (
      !body.companyName ||
      !body.payNowUEN   ||
      !Array.isArray(body.schedule) ||
      !Array.isArray(body.feeScheduleLines)
    ) {
      return Response.json({ error: "Invalid config shape" }, { status: 400 });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2), "utf8");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save config" }, { status: 500 });
  }
}
