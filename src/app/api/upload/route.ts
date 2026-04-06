import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Try Vercel Blob if configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(file.name, file, { access: "public" });
        return NextResponse.json({ url: blob.url, fileName: file.name, size: file.size });
      } catch (e) {
        console.error("Blob upload failed:", e);
      }
    }

    // Fallback: return a placeholder URL (file not actually stored)
    return NextResponse.json({
      url: `/uploads/${Date.now()}-${file.name}`,
      fileName: file.name,
      size: file.size,
      note: "File storage not configured. Add BLOB_READ_WRITE_TOKEN env var for Vercel Blob.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
