import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { BASE_URL, MAKER_ROLES, REQUEST_ROLES, VIEW_ROLES, addLog, dieCheck, esc, mail, makers, nextNumber, noteOnLead, sizeText } from "@/lib/prototypes";

// Prototypes (Benjy 11/18). GET the board; POST a request; PUT moves it along.
const num = (v: unknown) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null; };
const t = (v: unknown, max = 2000) => (v === null || v === undefined ? "" : String(v).trim().slice(0, max));
const dayDate = (v: unknown) => { const s = t(v, 40); if (!s) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s); return isNaN(+d) ? null : d; };
const link = (id?: string) => `${BASE_URL}/dashboard/prototypes${id ? `?open=${id}` : ""}`;

function shape(p: any) {
  let files: any[] = [], dieMatches: any = null, log: any[] = [];
  try { files = JSON.parse(p.files || "[]"); } catch { /* none */ }
  try { dieMatches = JSON.parse(p.dieMatches || "null"); } catch { /* none */ }
  try { log = JSON.parse(p.log || "[]"); } catch { /* none */ }
  return { ...p, files, dieMatches, log };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !VIEW_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ prototypes: [] });
  const sp = request.nextUrl.searchParams;
  const where: any = {};
  if (sp.get("leadId")) where.leadId = sp.get("leadId");
  if (sp.get("companyId")) where.companyId = sp.get("companyId");
  if (sp.get("status")) where.status = sp.get("status");
  // The board: everything open, plus what was approved or dropped in the last 30 days.
  if (!sp.get("leadId") && !sp.get("companyId") && !sp.get("status")) where.OR = [{ status: { in: ["requested", "making", "ready", "with_customer"] } }, { updatedAt: { gte: new Date(Date.now() - 30 * 86400e3) } }];
  const rows = await (prisma as any).prototype.findMany({ where, orderBy: [{ neededBy: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 300 });
  return NextResponse.json({ prototypes: rows.map(shape), canMake: MAKER_ROLES.includes(session.role), canRequest: REQUEST_ROLES.includes(session.role), me: session.name });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !REQUEST_ROLES.includes(session.role)) return NextResponse.json({ error: "Only sales and Customer Service can ask for a prototype" }, { status: 403 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json().catch(() => ({}));

  // Customer: from the lead, the customer record, or typed (prospects often aren't customers yet).
  let leadId: string | null = b.leadId ? String(b.leadId) : null, companyId: string | null = b.companyId ? String(b.companyId) : null;
  let customerName = t(b.customerName, 200);
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { companyName: true, companyId: true } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 400 });
    customerName = customerName || lead.companyName; companyId = companyId || lead.companyId || null;
  }
  if (companyId && !customerName) customerName = (await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }))?.name || "";
  const req = t(b.request, 4000);
  const missing = [!customerName && "the customer", !req && "what they want"].filter(Boolean);
  if (missing.length) return NextResponse.json({ error: `Still needed: ${missing.join(", ")}.` }, { status: 400 });

  const length = num(b.length), width = num(b.width), depth = num(b.depth);
  const dies = await dieCheck(length, width, depth);
  const files = Array.isArray(b.files) ? b.files.filter((f: any) => f?.url).slice(0, 10).map((f: any) => ({ name: t(f.name, 200), url: t(f.url, 1000) })) : [];
  const number = await nextNumber(prisma);
  const p = await prisma.prototype.create({ data: {
    number, leadId, companyId, customerName, request: req,
    requestedById: session.id, requestedByName: session.name, requestedByEmail: session.email,
    style: t(b.style, 20) || null, length, width, depth, stock: t(b.stock, 300) || null,
    samples: parseInt(b.samples) > 0 ? Math.min(parseInt(b.samples), 500) : null, neededBy: dayDate(b.neededBy),
    files: files.length ? JSON.stringify(files) : null, dieMatches: dies ? JSON.stringify(dies) : null,
    log: addLog(null, session.name, "Requested"),
  } });
  await noteOnLead(prisma, leadId, `Prototype ${number} requested by ${session.name}: ${req}`);
  const todd = await makers(prisma);
  const exact = dies?.exact?.[0];
  await mail(todd.map((u: any) => u.email), `Prototype request ${number}: ${customerName}`,
    `<p>${esc(session.name)} needs a prototype for <b>${esc(customerName)}</b>${p.neededBy ? ` by ${new Date(p.neededBy).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}` : ""}.</p>
     <p>${esc(req).replace(/\n/g, "<br>")}</p>
     ${sizeText(p) || p.stock ? `<p>${esc(sizeText(p))}${p.stock ? `${sizeText(p) ? ", " : ""}${esc(p.stock)}` : ""}${p.samples ? `, ${p.samples} sample${p.samples > 1 ? "s" : ""}` : ""}</p>` : ""}
     ${exact ? `<p>We already have die <b>${esc(exact.dieNumber)}</b> at that size${exact.customerName ? ` (${esc(exact.customerName)})` : ""}.</p>` : ""}
     <p><a href="${link(p.id)}">Open it in Godzilla</a></p>`, session.email);
  return NextResponse.json({ prototype: shape(p) });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || !VIEW_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json().catch(() => ({}));
  const p = await prisma.prototype.findUnique({ where: { id: String(b.id || "") } });
  if (!p) return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  const maker = MAKER_ROLES.includes(session.role), asker = REQUEST_ROLES.includes(session.role);
  const data: any = {};
  let event = "", leadNote = "", emailTo: string[] = [], subject = "", html = "";

  switch (b.action) {
    case "start":
      if (!maker) return NextResponse.json({ error: "Todd starts prototypes" }, { status: 403 });
      data.status = "making"; event = `Round ${p.round} started`; break;
    case "ready": {
      if (!maker) return NextResponse.json({ error: "Todd marks prototypes ready" }, { status: 403 });
      data.status = "ready"; data.readyAt = new Date();
      if (b.makerNotes !== undefined) data.makerNotes = t(b.makerNotes, 2000) || null;
      if (b.dieNumber !== undefined) data.dieNumber = t(b.dieNumber, 40).toUpperCase() || null;
      event = `Round ${p.round} ready${data.makerNotes ? `: ${data.makerNotes}` : ""}`;
      leadNote = `Prototype ${p.number} round ${p.round} is ready (Todd).${data.makerNotes ? ` ${data.makerNotes}` : ""}`;
      emailTo = [p.requestedByEmail]; subject = `Prototype ready: ${p.number} ${p.customerName}`;
      html = `<p>Round ${p.round} of the <b>${esc(p.customerName)}</b> prototype is ready.</p>${data.makerNotes ? `<p>${esc(data.makerNotes)}</p>` : ""}<p>Once it's with the customer, mark it sent so we know we're waiting on them. <a href="${link(p.id)}">Open ${p.number}</a></p>`;
      break;
    }
    case "sent":
      if (!asker && !maker) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      data.status = "with_customer"; data.sentAt = new Date(); event = `Round ${p.round} sent to the customer${b.how ? ` (${t(b.how, 100)})` : ""}`;
      leadNote = `Prototype ${p.number} round ${p.round} went to the customer.`; break;
    case "changes": {
      if (!asker && !maker) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const fb = t(b.feedback, 3000);
      if (!fb) return NextResponse.json({ error: "What does the customer want changed?" }, { status: 400 });
      data.status = "requested"; data.round = p.round + 1; data.feedback = fb; data.readyAt = null; data.sentAt = null;
      event = `Customer wants changes, round ${p.round + 1}: ${fb}`;
      leadNote = `Prototype ${p.number}: customer wants changes (round ${p.round + 1}): ${fb}`;
      emailTo = (await makers(prisma)).map((u: any) => u.email); subject = `Prototype changes, round ${p.round + 1}: ${p.number} ${p.customerName}`;
      html = `<p><b>${esc(p.customerName)}</b> wants another round on ${p.number}:</p><blockquote style="border-left:3px solid #b45309;margin:0;padding:4px 12px;">${esc(fb).replace(/\n/g, "<br>")}</blockquote><p>From ${esc(session.name)}. <a href="${link(p.id)}">Open it</a></p>`;
      break;
    }
    case "approved":
      if (!asker && !maker) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      data.status = "approved"; data.approvedAt = new Date(); if (b.feedback) data.feedback = t(b.feedback, 3000);
      event = `Approved by the customer (round ${p.round})`;
      leadNote = `Prototype ${p.number} approved by the customer (round ${p.round})${p.dieNumber ? `, die ${p.dieNumber}` : ""}. It carries onto the job when it's entered.`;
      emailTo = (await makers(prisma)).map((u: any) => u.email); subject = `Prototype approved: ${p.number} ${p.customerName}`;
      html = `<p>The customer approved round ${p.round} of the <b>${esc(p.customerName)}</b> prototype (${p.number}). Nice work.</p>`;
      break;
    case "drop":
      if (!asker && !maker) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      data.status = "dropped"; event = `Dropped${b.reason ? `: ${t(b.reason, 300)}` : ""}`; leadNote = `Prototype ${p.number} dropped.${b.reason ? ` ${t(b.reason, 300)}` : ""}`; break;
    case "reopen":
      data.status = "requested"; event = "Reopened"; break;
    case "edit": {
      if (!asker && !maker) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      for (const k of ["request", "stock", "makerNotes", "style"]) if (k in b) data[k] = t(b[k], k === "style" ? 20 : 4000) || (k === "request" ? p.request : null);
      for (const k of ["length", "width", "depth"]) if (k in b) data[k] = num(b[k]);
      if ("dieNumber" in b) data.dieNumber = t(b.dieNumber, 40).toUpperCase() || null;
      if ("dielineUrl" in b) data.dielineUrl = t(b.dielineUrl, 1000) || null;
      if ("neededBy" in b) data.neededBy = dayDate(b.neededBy);
      if ("samples" in b) data.samples = parseInt(b.samples) > 0 ? Math.min(parseInt(b.samples), 500) : null;
      if (["length", "width", "depth"].some((k) => k in b)) { const d = await dieCheck(data.length ?? p.length, data.width ?? p.width, data.depth ?? p.depth); data.dieMatches = d ? JSON.stringify(d) : null; }
      event = "Details updated"; break;
    }
    default: return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  data.log = addLog(p.log, session.name, event);
  const updated = await prisma.prototype.update({ where: { id: p.id }, data });
  if (leadNote) await noteOnLead(prisma, p.leadId, leadNote);
  if (emailTo.length && subject) await mail(emailTo, subject, html, session.email);
  return NextResponse.json({ prototype: shape(updated) });
}
