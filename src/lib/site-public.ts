import { NextRequest, NextResponse } from "next/server";

/**
 * Shared by the public website endpoints under /api/public/site (forms, artwork upload,
 * flexible price, flexible checkout). The new cndprinting.com pages call these straight from
 * the visitor's browser, so every one of them answers the browser's cross-site check (CORS)
 * for our own site addresses only.
 */
const DEFAULT_ORIGINS = [
  "https://www.cndprinting.com",
  "https://cndprinting.com",
  "https://cnd-site-review.vercel.app",
  "http://localhost:3220",
];
export function allowedOrigins(): string[] {
  const extra = (process.env.SITE_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}
export function cors(req: NextRequest): Record<string, string> {
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
export const reply = (req: NextRequest, body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors(req) });
export const preflight = (req: NextRequest) => new NextResponse(null, { status: 204, headers: cors(req) });
export const fromOurSite = (req: NextRequest) => allowedOrigins().includes(req.headers.get("origin") || "");
export const clientIp = (req: NextRequest) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

/** Best-effort throttle. Serverless instances do not share memory, so this only slows a burst
 *  hitting one instance. Returns a function: true when this address has gone over the limit. */
export function throttle(max: number, windowMs = 10 * 60 * 1000) {
  const hits = new Map<string, number[]>();
  return (ip: string): boolean => {
    const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear();
    return list.length > max;
  };
}

export const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Reference the visitor can quote on the phone: W-yymmdd-XXXX. */
export const newRef = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 4; i++) r += A[Math.floor(Math.random() * A.length)];
  return `W-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${r}`;
};

/** A file the visitor uploaded through /api/public/site/upload. Only our own storage is accepted. */
export function ourUpload(v: unknown): string {
  try {
    const u = new URL(clean(v, 600));
    if (u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/website-uploads/")) return u.href;
  } catch { /* no file, or not ours */ }
  return "";
}
