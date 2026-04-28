import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Vercel Blob is required for real file storage. The previous fallback
    // silently returned a fake URL that broke proof links — surface a real
    // error instead so the UI can prompt the user to paste a URL.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({
        error: "File storage not configured",
        message: "Vercel Blob isn't set up yet. Until it is, paste a OneDrive/Dropbox URL in the field below instead.",
        configRequired: "BLOB_READ_WRITE_TOKEN",
      }, { status: 503 });
    }

    try {
      const { put } = await import("@vercel/blob");
      // addRandomSuffix avoids collisions when two users upload "proof-v1.pdf";
      // the original filename is still preserved in the response so the UI
      // displays it normally. Public access matches our other files.
      const blob = await put(file.name, file, { access: "public", addRandomSuffix: true });
      return NextResponse.json({ url: blob.url, fileName: file.name, size: file.size });
    } catch (e: any) {
      console.error("Blob upload failed:", e);
      return NextResponse.json({
        error: "Upload to Vercel Blob failed",
        message: e?.message || "Unknown blob error — try pasting a URL instead.",
      }, { status: 502 });
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed", message: error?.message }, { status: 500 });
  }
}
