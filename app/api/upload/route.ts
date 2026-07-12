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

    const buffer = Buffer.from(await file.arrayBuffer());
    return Response.json(parseWorkbook(buffer));
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
