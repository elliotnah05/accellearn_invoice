import { NextRequest } from "next/server";
import { parseWorkbook } from "@/lib/parse-students";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls" && ext !== "csv") {
      return Response.json({ error: "Only .xlsx, .xls, or .csv files are accepted" }, { status: 400 });
    }

    // Cap file size — a spreadsheet of students is well under this. Limits the
    // blast radius of a crafted workbook (memory exhaustion / parser ReDoS).
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return Response.json(parseWorkbook(buffer));
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
