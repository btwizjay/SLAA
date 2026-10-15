import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const coachId = (formData.get("coachId") as string | null) ?? "provisional";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF, JPG, and PNG are allowed." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5 MB limit." },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const documentId = randomUUID();
    const documentPath = `${coachId}/${documentId}.${ext}`;

    // Try saving locally in upload storage if Supabase storage isn't configured
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = join(process.cwd(), "public", "uploads", "coach-documents", coachId);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, `${documentId}.${ext}`), buffer);
    } catch (fsErr) {
      console.warn("Local storage write warning:", fsErr);
    }

    return NextResponse.json({
      success: true,
      documentPath,
      name: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Failed to upload document." }, { status: 500 });
  }
}

