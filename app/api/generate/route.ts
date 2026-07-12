import { NextRequest } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { readFileSync } from "fs";
import { InvoicePDF } from "@/lib/invoice-pdf";
import type { Student } from "@/types/student";
import type { TemplateConfig } from "@/app/api/config/route";
import { CONFIG_PATH, LOGO_PATH } from "@/lib/paths";

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

export async function POST(request: NextRequest) {
  try {
    const student = (await request.json()) as Student;
    if (!student?.studentName) {
      return Response.json({ error: "Invalid student data" }, { status: 400 });
    }

    const [logo, config] = [getLogo(), getConfig()];

    const buffer = await renderToBuffer(
      createElement(InvoicePDF, { student, logoBase64: logo, config }) as unknown as ReactElement<DocumentProps>
    );

    const safeName = student.studentName.replace(/[^a-zA-Z0-9]/g, "_");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice_${safeName}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
