import { NextRequest } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { ReceiptPDF, termEndDate } from "@/lib/receipt-pdf";
import {
  readLedger, writeLedger, ledgerKey, receiptNo, termSlug,
  ensureOutputDir, safeFileName, outputFolderExists,
} from "@/lib/billing-store";
import { parseIssuedCell, parseSentCell } from "@/lib/receipt-status";
import { writebackReceiptIssued, writebackReceiptSent } from "@/lib/sheet-writeback";
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

function getConfig(): TemplateConfig {
  return readJson<TemplateConfig>(CONFIG_PATH);
}

/** GET ?term=AY%2026%20T3 → ledger entries for that term + folder status. */
export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("term") ?? "";
  const config = getConfig();
  const ledger = readLedger();
  const slug = termSlug(term);
  const entries = Object.values(ledger).filter((e) => termSlug(e.term) === slug);
  return Response.json({
    folderConfigured: outputFolderExists(config),
    outputFolder: config.outputFolder ?? "",
    entries,
  });
}

interface GenerateBody {
  action: "generate";
  student: Student;
  term: string;
  force?: boolean;   // explicit re-issue past the duplicate warning
}
interface MarkSentBody {
  action: "markSent";
  serialNo: number;
  term: string;
}
interface PreviewBody {
  action: "preview";
  student: Student;
  term: string;
}

export async function POST(request: NextRequest) {
  let body: GenerateBody | MarkSentBody | PreviewBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = getConfig();

  // ── Preview a receipt (render only — never saves, no ledger, no writeback) ──
  // Uses the same deterministic receipt number the real receipt would get, so
  // the preview is faithful, but nothing is committed to disk or the sheet.
  if (body.action === "preview") {
    const s = body.student;
    if (!s?.studentName || !s?.serialNo) {
      return Response.json({ error: "Missing student data" }, { status: 400 });
    }
    try {
      const buffer = await renderToBuffer(
        createElement(ReceiptPDF, {
          student: s,
          logoBase64: getLogo(),
          config,
          receiptNo: receiptNo(body.term, s.serialNo),
          term: body.term,
          endDate: termEndDate(s, config, body.term),
          paymentDate: s.dateOfReceipt || "",
        }) as unknown as ReactElement<DocumentProps>
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Receipt_${safeFileName(s.studentName)}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    } catch (err) {
      // PDPA: log serial numbers only
      console.error(`Receipt preview failed for serial ${s.serialNo}:`, err instanceof Error ? err.message : "unknown");
      return Response.json({ error: "Receipt preview failed — check server logs" }, { status: 500 });
    }
  }

  const ledger = readLedger();

  // ── Mark a receipt as sent (manual send by admin) ──
  if (body.action === "markSent") {
    const key = ledgerKey(body.term, body.serialNo);
    // The local ledger may be empty on this machine even though the receipt was
    // genuinely issued (another admin's computer, or a fresh install after
    // handover). The spreadsheet is the real record and the receipt number is
    // deterministic, so rebuild the entry rather than refusing.
    const entry = ledger[key] ?? {
      serialNo: body.serialNo,
      term: body.term,
      receiptNo: receiptNo(body.term, body.serialNo),
      amount: 0,
      issuedAt: new Date().toISOString(),
      reissuedAt: [],
      sentAt: null,
      file: "",
    };
    entry.sentAt = new Date().toISOString();
    ledger[key] = entry;
    writeLedger(ledger);
    const wb = await writebackReceiptSent(config, body.term, body.serialNo);
    return Response.json({ ok: true, entry, warning: wb.warning ?? null });
  }

  // ── Generate a receipt ──
  if (body.action === "generate") {
    const s = body.student;
    if (!s?.studentName || !s?.serialNo) {
      return Response.json({ error: "Missing student data" }, { status: 400 });
    }
    if (!outputFolderExists(config)) {
      return Response.json(
        { error: "Output folder not set or doesn't exist — set it in Invoice Template → Folders." },
        { status: 400 }
      );
    }

    const key = ledgerKey(body.term, s.serialNo);
    const existing = ledger[key];

    // Duplicate guard. Checks the spreadsheet (column R) as well as the local
    // ledger, so the warning still fires on a machine that has never issued
    // this receipt itself — the shared Excel is what both admins have in common.
    const fromSheet = parseIssuedCell(s.receiptIssued);
    if ((existing || fromSheet) && !body.force) {
      return Response.json(
        {
          duplicate: true,
          // No local record, but the sheet says it was issued. Hand back an
          // entry-shaped object; the client fills the dates in from the sheet.
          entry: existing ?? {
            serialNo: s.serialNo,
            term: body.term,
            receiptNo: fromSheet?.receiptNo || receiptNo(body.term, s.serialNo),
            amount: s.totalFee,
            issuedAt: "",
            reissuedAt: [],
            sentAt: parseSentCell(s.receiptSent) ? "" : null,
            file: "",
          },
        },
        { status: 409 }
      );
    }

    try {
      const rNo = receiptNo(body.term, s.serialNo);
      const buffer = await renderToBuffer(
        createElement(ReceiptPDF, {
          student: s,
          logoBase64: getLogo(),
          config,
          receiptNo: rNo,
          term: body.term,
          endDate: termEndDate(s, config, body.term),
          paymentDate: s.dateOfReceipt || "",
        }) as unknown as ReactElement<DocumentProps>
      );

      const dir = ensureOutputDir(config, "Receipts", body.term)!;
      const file = path.join(dir, `Receipt_${rNo}_${safeFileName(s.studentName)}.pdf`);
      writeFileSync(file, buffer);

      const now = new Date().toISOString();
      ledger[key] = existing
        ? { ...existing, amount: s.totalFee, file, reissuedAt: [...existing.reissuedAt, now] }
        : {
            serialNo: s.serialNo,
            term: body.term,
            receiptNo: rNo,
            amount: s.totalFee,
            issuedAt: now,
            reissuedAt: [],
            sentAt: null,
            file,
          };
      writeLedger(ledger);

      const wb = await writebackReceiptIssued(config, body.term, s.serialNo, rNo);
      return Response.json({ ok: true, entry: ledger[key], warning: wb.warning ?? null });
    } catch (err) {
      // PDPA: log serial numbers only
      console.error(`Receipt generation failed for serial ${s.serialNo}:`, err instanceof Error ? err.message : "unknown");
      return Response.json({ error: "Receipt generation failed — check server logs" }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
