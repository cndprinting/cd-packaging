import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/session";

// Token endpoint for browser -> Vercel Blob direct uploads (see
// src/lib/upload-client.ts). The browser never sends the file bytes through
// this function -- only a small JSON handshake -- so artwork of any size
// works despite Vercel's 4.5 MB request-body cap. Auth is checked here:
// no session, no token. Internal users and portal customers both have
// sessions, matching who could use /api/upload before.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File storage not configured", message: "Vercel Blob isn't set up yet." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        addRandomSuffix: true,
        maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB -- big packaging artwork is normal
        tokenPayload: JSON.stringify({ userId: session.id }),
      }),
      // Fires as a webhook after the blob lands (production only). Nothing to
      // record here -- callers save the returned URL onto their own records.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Blob token error:", msg);
    return NextResponse.json({ error: "Upload token failed", message: msg }, { status: 400 });
  }
}
