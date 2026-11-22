import { NextRequest, NextResponse } from "next/server";
import { POST as intakePost } from "@/app/api/intake/route";

/**
 * Public website endpoint (11/22/26). The new cndprinting.com pages post their forms here
 * straight from the visitor's browser: the quote form, the sample kit request, the Design
 * Consultant's quote request, the flexible "request this order" button and orders approved in
 * the Packaging Studio.
 *
 * It does three things the old Elementor webhook route (/api/intake) cannot do for a browser:
 *   1. answers the browser's cross-site check (CORS) for our own site addresses only,
 *   2. checks the request and gives it a reference number the visitor can quote on the phone,
 *   3. supports a test flag, so the review site can prove the connection without creating a lead.
 * Real requests are then handed to /api/intake unchanged, so the lead pipeline and Jessica
 * treat them exactly like a form from the current website.
 *
 * No login, no customer data returned, nothing about invoices or payments.
 */
export const maxDuration = 60; // intake does its heavy work after the reply; give it room

const DEFAULT_ORIGINS = [
  "https://www.cndprinting.com",
  "https://cndprinting.com",
  "https://cnd-site-review.vercel.app",
  "http://localhost:3220",
];
function allowedOrigins(): string[] {
  const extra = (process.env.SITE_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}
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

// Best-effort throttle. Serverless instances do not share memory, so this only slows a burst
// hitting one instance; the intake blocklist and Jessica's scam checks are the real filter.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 8;
}

const KINDS: Record<string, string> = {
  quote: "Quote request",
  kit: "Sample kit request",
  consult: "Design Consultant quote request",
  flex: "Flexible packaging order request (from the instant quote)",
  order: "Packaging Studio order (proof approved online)",
};
const clean = (v: any, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const newRef = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 4; i++) r += A[Math.floor(Math.random() * A.length)];
  return `W-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${r}`;
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function GET(req: NextRequest) {
  return reply(req, { ok: true, service: "C&D website endpoint" });
}

export async function POST(req: NextRequest) {
  // Browsers only: the request must come from one of our own site addresses.
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins().includes(origin)) return reply(req, { error: "Not allowed from this address" }, 403);

  let b: any;
  try { b = await req.json(); } catch { return reply(req, { error: "Could not read the request" }, 400); }
  if (!b || typeof b !== "object") return reply(req, { error: "Could not read the request" }, 400);

  const kind = KINDS[b.kind] ? String(b.kind) : "quote";
  const company = clean(b.company, 160), name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase(), phone = clean(b.phone, 40);
  const what = clean(b.what, 160), qty = clean(b.qty, 60), details = clean(b.details, 4000), page = clean(b.page, 300), fileName = clean(b.fileName, 200);

  // A file the visitor uploaded through /api/public/site/upload. Only our own storage is accepted.
  let fileUrl = "";
  try {
    const u = new URL(clean(b.fileUrl, 600));
    if (u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/website-uploads/")) fileUrl = u.href;
  } catch { /* no file, or not ours */ }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(req, { error: "Please add a valid email address" }, 400);
  if (!company && !name) return reply(req, { error: "Please add your name or company" }, 400);

  const ref = newRef();
  // A filled hidden field means a bot. Answer as if it worked and drop it.
  if (clean(b.hp, 50)) return reply(req, { ok: true, ref });
  // The review site sends test:true, which proves the connection end to end and creates nothing.
  if (b.test === true) return reply(req, { ok: true, ref: "TEST-" + ref.slice(2), test: true });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return reply(req, { error: "Too many requests. Please call 727-572-9999." }, 429);

  // Spec lines from the Studio or the instant quote: [["Board", "SBS 16pt"], ...]
  const spec = Array.isArray(b.spec) ? b.spec.slice(0, 40).map((r: any) => `${clean(r?.[0], 60)}: ${clean(r?.[1], 200)}`).filter((l: string) => l.length > 2) : [];
  const shown = clean(b.priceShown, 80);
  const lines = [
    `[${KINDS[kind]} from the website, reference ${ref}]`,
    details,
    spec.length ? "Specification:\n" + spec.join("\n") : "",
    shown ? `Price shown on the site: ${shown}. This is an online estimate, not a quote. Confirm before quoting it back.` : "",
    fileUrl ? `Artwork uploaded with the request${fileName ? ` (${fileName})` : ""}.` : fileName ? `The customer has a file ready (${fileName}) but it was not sent with the form. Ask them to email it.` : "",
  ].filter(Boolean);

  // Hand off to the same intake the current website form uses. Field labels match what it looks for.
  const payload: Record<string, string> = {
    Company: company,
    "Contact Name": name,
    Email: email,
    Phone: phone,
    Product: what || (kind === "kit" ? "Pouch and label sample kit" : ""),
    Quantity: qty,
    Message: lines.join("\n\n"),
    "Page URL": page || origin,
    "Website Reference": ref,
  };
  // Only when a real file came with it. Without this field Jessica asks the customer for artwork.
  if (fileUrl) payload.Artwork = fileUrl;
  try {
    const secret = process.env.INTAKE_SECRET;
    const url = new URL("/api/intake" + (secret ? `?key=${encodeURIComponent(secret)}` : ""), req.nextUrl.origin);
    const res = await intakePost(new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }));
    if (!res.ok) throw new Error("intake answered " + res.status);
  } catch (e) {
    console.error("[Godzilla SITE] could not hand a website request to intake:", e, JSON.stringify(payload));
    return reply(req, { error: "We could not take that just now. Please call 727-572-9999 or email sales@cndprinting.com." }, 502);
  }
  return reply(req, { ok: true, ref });
}
