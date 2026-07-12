import { NextRequest } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { readFileSync } from "fs";
import { InvoicePDF } from "@/lib/invoice-pdf";
import { subjectsText, type Student } from "@/types/student";
import type { TemplateConfig } from "@/app/api/config/route";
import { CONFIG_PATH, LOGO_PATH } from "@/lib/paths";

const GRAPH = "https://graph.facebook.com";

let logoBase64: string;
function getLogo(): string {
  if (!logoBase64) {
    logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`;
  }
  return logoBase64;
}

function getConfig(): TemplateConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

interface WhatsAppCreds {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  templateName: string;
  templateLang: string;
}

function getCreds(): WhatsAppCreds | null {
  const token         = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    apiVersion:   process.env.WHATSAPP_API_VERSION?.trim()  || "v23.0",
    templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "",
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en",
  };
}

/** Normalise a POC number to E.164 digits without "+" (Meta format).
 *  Bare 8-digit numbers are assumed to be Singapore (+65). */
function normalizePoc(poc: string): string | null {
  const digits = poc.replace(/\D/g, "");
  if (digits.length === 8) return `65${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

/** Pull a safe, PDPA-clean error out of a Meta API error response —
 *  never echo names or phone numbers back out. */
function metaError(body: unknown): string {
  const err = (body as { error?: { code?: number; message?: string } })?.error;
  if (!err) return "Unknown API error";
  // 131047 / 131026 are the classic "outside 24h window / undeliverable" codes
  if (err.code === 131047) return "Outside 24h session window — an approved template is required (code 131047)";
  if (err.code === 131026) return "Message undeliverable — number may not be on WhatsApp (code 131026)";
  if (err.code === 132001) return "Template not found or not approved for this language (code 132001)";
  if (err.code === 190)    return "Access token expired or invalid (code 190)";
  return `${err.message ?? "API error"}${err.code ? ` (code ${err.code})` : ""}`;
}

/** GET → configuration status only (booleans — no secrets leave the server). */
export async function GET() {
  const creds = getCreds();
  return Response.json({
    configured: creds !== null,
    templateMode: !!creds?.templateName,
    templateName: creds?.templateName ?? null,
  });
}

export async function POST(request: NextRequest) {
  const creds = getCreds();
  if (!creds) {
    return Response.json(
      { error: "WhatsApp credentials not configured. Fill in app/.env.local and restart the dev server." },
      { status: 503 }
    );
  }

  let student: Student;
  try {
    student = (await request.json()) as Student;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!student?.studentName || !student?.poc) {
    return Response.json({ error: "Missing student name or POC number" }, { status: 400 });
  }

  const to = normalizePoc(student.poc);
  if (!to) {
    return Response.json({ error: "POC is not a valid WhatsApp number" }, { status: 400 });
  }

  try {
    const config = getConfig();

    // 1. Render the invoice PDF in memory only — nothing touches disk (PDPA)
    const buffer = await renderToBuffer(
      createElement(InvoicePDF, { student, logoBase64: getLogo(), config }) as unknown as ReactElement<DocumentProps>
    );
    const safeName = student.studentName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Invoice_${safeName}.pdf`;

    // 2. Upload the PDF to Meta to get a media ID
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);

    const uploadRes = await fetch(
      `${GRAPH}/${creds.apiVersion}/${creds.phoneNumberId}/media`,
      { method: "POST", headers: { Authorization: `Bearer ${creds.token}` }, body: form }
    );
    const uploadBody = await uploadRes.json();
    if (!uploadRes.ok || !uploadBody.id) {
      console.error(`Media upload failed for serial ${student.serialNo}`);
      return Response.json({ error: `PDF upload failed: ${metaError(uploadBody)}` }, { status: 502 });
    }
    const mediaId: string = uploadBody.id;

    // 3. Send the message — template if configured, else plain document
    //    (plain document only delivers inside an open 24h session window)
    const amount = `$${student.totalFee.toFixed(2)}`;
    const messagePayload = creds.templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: creds.templateName,
            language: { code: creds.templateLang },
            components: [
              {
                type: "header",
                parameters: [{ type: "document", document: { id: mediaId, filename } }],
              },
              {
                type: "body",
                parameters: [
                  { type: "text", text: student.parentName || "Parent" },       // {{1}}
                  { type: "text", text: student.studentName },                  // {{2}}
                  { type: "text", text: `${subjectsText(student)} (${student.level})` }, // {{3}}
                  { type: "text", text: amount },                               // {{4}}
                ],
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "document",
          document: {
            id: mediaId,
            filename,
            caption: `Dear ${student.parentName || "Parent"}, please find attached the ${config.companyName} tuition invoice for ${student.studentName} — ${amount}. PayNow UEN: ${config.payNowUEN}. Thank you!`,
          },
        };

    const sendRes = await fetch(
      `${GRAPH}/${creds.apiVersion}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );
    const sendBody = await sendRes.json();
    if (!sendRes.ok) {
      console.error(`Send failed for serial ${student.serialNo}`);
      return Response.json({ error: metaError(sendBody) }, { status: 502 });
    }

    return Response.json({
      ok: true,
      messageId: sendBody.messages?.[0]?.id ?? null,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    // Log only the serial number — never names or numbers (PDPA)
    console.error(`WhatsApp send error for serial ${student.serialNo}:`, err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Send failed — check server logs" }, { status: 500 });
  }
}
