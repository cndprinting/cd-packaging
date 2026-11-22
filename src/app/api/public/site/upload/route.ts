import { NextRequest, NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

/**
 * Public website file upload, step 1 (11/22/26). The quote form on the new cndprinting.com asks
 * here for permission to upload ONE artwork file. We answer with a short-lived, single-path
 * upload token; the browser then sends the file straight to Vercel Blob (files never pass through
 * this function, so the 4.5 MB request cap does not apply). The returned file address is sent with
 * the quote request to /api/public/site, which puts it on the lead as the artwork.
 *
 * Limits, because this needs no login: our own site addresses only, artwork file types only,
 * 50 MB, the path is chosen here (not by the visitor), the token dies in 10 minutes, and a
 * per-address throttle. SITE_UPLOADS=0 turns uploads off; the form then falls back to
 * "we will ask you for the file by email".
 */
const DEFAULT_ORIGINS = ["https://www.cndprinting.com", "https://cndprinting.com", "https://cnd-site-review.vercel.app", "http://localhost:3220"];
const allowedOrigins = () => [...DEFAULT_ORIGINS, ...(process.env.SITE_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)];
function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const h: Record<string, string> = { Vary: "Origin" };
  if (allowedOrigins().includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
const reply = (req: NextRequest, body: any, status = 200) => NextResponse.json(body, { status, headers: cors(req) });

// What a printer actually receives as artwork. The content type is decided here from the
// file's extension, never taken from the visitor.
const TYPES: Record<string, string> = {
  pdf: "application/pdf", ai: "application/postscript", eps: "application/postscript",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", tif: "image/tiff", tiff: "image/tiff", psd: "image/vnd.adobe.photoshop",
};
const MAX_BYTES = 50 * 1024 * 1024;

const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 6;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins().includes(origin)) return reply(req, { error: "Not allowed from this address" }, 403);
  if (process.env.SITE_UPLOADS === "0") return reply(req, { error: "Uploads are off" }, 503);
  const rw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!rw) return reply(req, { error: "File storage is not set up" }, 503);

  let b: any;
  try { b = await req.json(); } catch { return reply(req, { error: "Could not read the request" }, 400); }
  const name = String(b?.name || "").slice(0, 160);
  const ext = (name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] || "").toLowerCase();
  const contentType = TYPES[ext];
  if (!contentType) return reply(req, { error: "Please send a PDF, AI, EPS, PNG, JPG, TIFF or PSD file." }, 400);
  const size = Number(b?.size) || 0;
  if (!(size > 0)) return reply(req, { error: "That file is empty." }, 400);
  if (size > MAX_BYTES) return reply(req, { error: "That file is over 50 MB. Send the request without it and we will email you a way to send the file." }, 400);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return reply(req, { error: "Too many uploads. Please call 727-572-9999." }, 429);

  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  const safe = name.replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "artwork";
  const pathname = `website-uploads/${d.getFullYear()}-${p(d.getMonth() + 1)}/${safe}.${ext}`;
  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: rw, pathname, maximumSizeInBytes: MAX_BYTES, allowedContentTypes: [contentType],
      addRandomSuffix: true, validUntil: Date.now() + 10 * 60 * 1000,
    });
    // Everything the browser needs for the one PUT that follows.
    return reply(req, { ok: true, api: "https://vercel.com/api/blob", version: "12", pathname, contentType, clientToken });
  } catch (e) {
    console.error("[Godzilla SITE] upload token failed:", e);
    return reply(req, { error: "We could not start the upload." }, 500);
  }
}
