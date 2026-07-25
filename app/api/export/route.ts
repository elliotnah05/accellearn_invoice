import { NextRequest } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { InvoicePDF } from "@/lib/invoice-pdf";
import { ensureOutputDir, safeFileName, termSlug, outputFolderExists } from "@/lib/billing-store";
import { writebackInvoiceIssued } from "@/lib/sheet-writeback";
import type { Student } from "@/types/student";
import type { TemplateConfig } from "@/app/api/config/route";
import { CONFIG_PATH, LOGO_PATH, readJson } from "@/lib/paths";

let logoBase64: string;
function getLogo(): string {
  if (!logoBase64) {
    logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`;
  }
  return logoBase64;
}

interface ExportBody {
  students: Student[];
  term: string;
}

/** POST → writes one invoice PDF per student into <outputFolder>/Invoices/<term>/ */
export async function POST(request: NextRequest) {
  let body: ExportBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.students) || body.students.length === 0) {
    return Response.json({ error: "No students to export" }, { status: 400 });
  }

  const config: TemplateConfig = readJson<TemplateConfig>(CONFIG_PATH);
  if (!outputFolderExists(config)) {
    return Response.json(
      { error: "Output folder not set or doesn't exist — set it in Invoice Template → Folders." },
      { status: 400 }
    );
  }

  const dir = ensureOutputDir(config, "Invoices", body.term)!;
  const slug = termSlug(body.term);
  const written: string[] = [];
  const writtenSerials: number[] = [];
  const failed: number[] = [];

  for (const s of body.students) {
    try {
      const buffer = await renderToBuffer(
        createElement(InvoicePDF, { student: s, logoBase64: getLogo(), config }) as unknown as ReactElement<DocumentProps>
      );
      const invNo = `INV-${slug}-${String(s.serialNo).padStart(3, "0")}`;
      const file = path.join(dir, `Invoice_${invNo}_${safeFileName(s.studentName)}.pdf`);
      writeFileSync(file, buffer);
      written.push(invNo);
      writtenSerials.push(s.serialNo);
    } catch (err) {
      // PDPA: serial numbers only in logs
      console.error(`Invoice export failed for serial ${s.serialNo}:`, err instanceof Error ? err.message : "unknown");
      failed.push(s.serialNo);
    }
  }

  // Stamp "Yes" into Invoice Issued for every student actually written. One
  // workbook open/save for the whole batch — best-effort, so a spreadsheet
  // that's open in Excel doesn't fail the export itself, just surfaces a warning.
  let warning: string | null = null;
  if (writtenSerials.length > 0) {
    const wb = await writebackInvoiceIssued(config, body.term, writtenSerials);
    warning = wb.warning ?? null;
  }

  return Response.json({ ok: failed.length === 0, written: written.length, failed, folder: dir, warning });
}
