// Browser-side file upload that goes STRAIGHT to Vercel Blob.
//
// Why: every upload used to POST the file through /api/upload, and Vercel
// caps a serverless request body at 4.5 MB -- so any real artwork PDF failed
// with 413 FUNCTION_PAYLOAD_TOO_LARGE ("uploads for artwork don't work",
// Benjy 9/16). The client-upload flow asks /api/upload/token for a short-lived
// token (auth-checked there) and then the browser talks to Blob directly, so
// file size is no longer our function's problem.
//
// Returns the same shape the old route returned so callers barely change.
import { upload } from "@vercel/blob/client";

export interface UploadResult {
  ok: boolean;
  status: number;
  data: { url?: string; fileName?: string; size?: number; error?: string; message?: string };
}

const LEGACY_LIMIT = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB body cap

export async function uploadFile(file: File): Promise<UploadResult> {
  try {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/upload/token",
      contentType: file.type || undefined,
    });
    return { ok: true, status: 200, data: { url: blob.url, fileName: file.name, size: file.size } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Small files can still go the old way if the token route is unavailable.
    if (file.size <= LEGACY_LIMIT) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json();
        return { ok: res.ok, status: res.status, data: d };
      } catch { /* fall through */ }
    }
    return {
      ok: false, status: 502,
      data: { error: "Upload failed", message: msg.includes("413") || file.size > LEGACY_LIMIT
        ? `Upload failed (${(file.size / 1048576).toFixed(1)} MB). ${msg}`
        : msg },
    };
  }
}
