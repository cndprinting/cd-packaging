import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { leadMode, leadStage, leadType, leadRegion, leadOrigin, isStalled } from "@/lib/lead-view";
import { validateField, normalizeField, VALIDATED_FIELDS, type FieldName } from "@/lib/lead-validate";

// Sales pipeline API (Benjy 6/26) — proprietary CRM, gated by the per-user
// pipelineAccess flag (not a role). Managers (Benjy/Nitay/Albert) see all.

async function gate() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  const u = await prisma.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
  if (!u?.pipelineAccess) return { error: "Forbidden", status: 403 as const };
  return { session, prisma };
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lead";

export async function GET(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { prisma } = g;

  // Dedup/triangulation check — does this company already exist as a lead,
  // a customer, or a quote? Used before adding to avoid double-entry.
  const check = request.nextUrl.searchParams.get("check");
  if (check) {
    const q = check.trim();
    if (q.length < 2) return NextResponse.json({ leads: [], companies: [], quotes: [] });
    const [leads, companies, quotes] = await Promise.all([
      prisma.lead.findMany({ where: { companyName: { contains: q, mode: "insensitive" } }, select: { id: true, companyName: true, pipelineStage: true }, take: 5 }),
      prisma.company.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 5 }),
      prisma.quote.findMany({ where: { customerName: { contains: q, mode: "insensitive" } }, select: { id: true, quoteNumber: true, customerName: true }, take: 5 }),
    ]);
    return NextResponse.json({ leads, companies, quotes });
  }

  // Explicit column list to cut Neon egress (Benjy 8/11 — the free-tier 5 GB
  // transfer cap was blown). The full row was ~2.8 KB each × 357 leads ≈ 1 MB
  // per pipeline load, and it reloads often. commentary alone was 303 KB and
  // is no longer read: the view doesn't use it and the UI shows the note
  // timeline instead. Dropping commentary + the agent-internal blobs
  // (emailAlternates, agentDraft, agentQuote, conv ids, tokens) takes the
  // payload down ~75%. intakeRaw is selected only because the lead-type
  // derivation needs it, then stripped from the response below.
  const rows = await prisma.lead.findMany({
    orderBy: [{ priority: "asc" }, { lastInteraction: "desc" }],
    select: {
      id: true, companyName: true, endMarket: true, productCategory: true, website: true,
      city: true, state: true, contactName: true, contactTitle: true, contactEmail: true,
      contactName2: true, contactEmail2: true, contactPhone: true, lastInteraction: true,
      priority: true, stage: true, pipelineStage: true, ownerName: true, volume: true, numbers: true,
      companyId: true, agentHold: true, followUpAt: true, followUpNote: true, followUpDoneAt: true,
      outreachStatus: true, outreachNextAt: true, outreachTo: true, outreachEmailed: true, outreachLog: true,
      agentStatus: true, agentNextAt: true, leadTypeOverride: true, originOverride: true,
      source: true, intakeRaw: true, updatedAt: true,
      // Newest note rides along so the row previews the current note.
      notes: { orderBy: { createdAt: "desc" as const }, take: 1, select: { body: true, authorName: true, createdAt: true } },
    },
  });
  // Presentation layer computed SERVER-SIDE (Benjy 8/2) so the UI never has to
  // re-derive it and every screen agrees. See src/lib/lead-view.ts.
  const now = new Date();
  const leads = rows.map((l) => ({
    ...l,
    notes: undefined,
    intakeRaw: undefined, // used above for type derivation; never sent to the client
    lastNote: l.notes?.[0]
      ? { body: (l.notes[0].body || "").slice(0, 280), authorName: l.notes[0].authorName, createdAt: l.notes[0].createdAt }
      : null,
    mode: leadMode(l),            // ai | needs_you | human | idle
    stageLabel: leadStage(l),     // plain-English stage
    leadType: leadType(l),        // google_ad | website | mailercity | cold | referral | manual
    region: leadRegion(l),        // Tampa Bay | Central FL | ... | Out of state | Unknown
    origin: leadOrigin(l),        // inbound | prospecting — which side of the wall (Benjy 8/7)
    stalled: isStalled(l, now),   // no future clock AND untouched 3+ days
  }));
  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { prisma, session } = g;
  // Edits flushed as the user leaves the page — same write path as PUT.
  if (request.nextUrl.searchParams.get("beacon") === "1") {
    return updateLead(prisma, await request.json());
  }
  const body = await request.json();
  if (!body.companyName) return NextResponse.json({ error: "Company name required" }, { status: 400 });
  // Geography is mandatory on NEW leads (Benjy 8/2) — the pipeline is filtered
  // and routed by region, so a lead with no city/state is unusable. Editing an
  // existing lead (PUT) is deliberately unaffected.
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  if (!city || !state) {
    return NextResponse.json({ error: "City and state are required on a new lead — we filter and route the pipeline by geography." }, { status: 400 });
  }
  const lead = await prisma.lead.create({
    data: {
      companyName: body.companyName,
      endMarket: body.endMarket || null,
      productCategory: body.productCategory || null,
      website: body.website || null,
      city,
      state,
      contactName: body.contactName || null,
      contactTitle: body.contactTitle || null,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      priority: body.priority ? Number(body.priority) : null,
      stage: body.stage || null,
      pipelineStage: body.pipelineStage || "LEAD",
      ownerName: body.ownerName || null,
      volume: body.volume || null,
      commentary: body.commentary || null,
      lastInteraction: body.lastInteraction ? new Date(body.lastInteraction) : null,
      createdBy: session.id,
    },
  });
  return NextResponse.json({ lead });
}

export async function PUT(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json();
  return updateLead(g.prisma, body);
}

// Shared by PUT and by the page-unload beacon (navigator.sendBeacon can only
// issue a POST, so pending edits arrive at POST /api/leads?beacon=1).
async function updateLead(prisma: any, body: any) {
  if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Convert → create/link a real Godzilla customer, move to CUSTOMER stage.
  if (body.convert) {
    const lead = await prisma.lead.findUnique({ where: { id: body.id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    let companyId = lead.companyId;
    if (!companyId) {
      const existing = await prisma.company.findFirst({ where: { name: { equals: lead.companyName, mode: "insensitive" } } });
      if (existing) {
        companyId = existing.id;
      } else {
        let slug = slugify(lead.companyName);
        if (await prisma.company.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString().slice(-4)}`;
        const company = await prisma.company.create({
          data: { name: lead.companyName, slug, type: "customer", website: lead.website || null, industry: lead.endMarket || null },
        });
        companyId = company.id;
      }
    }
    const updated = await prisma.lead.update({ where: { id: body.id }, data: { pipelineStage: "CUSTOMER", companyId } });
    // Carry the lead's files onto the customer record. Artwork a rep collected
    // during the chase is exactly what estimating and pre-press need, and this
    // is the moment the account it belongs to finally exists (Benjy 8/5).
    await prisma.attachment.updateMany({ where: { leadId: body.id, companyId: null }, data: { companyId } });
    return NextResponse.json({ lead: updated, companyId });
  }

  // Inline field updates (dropdowns, text, stage move).
  const data: any = {};
  for (const k of ["companyName", "endMarket", "productCategory", "website", "city", "state", "contactName", "contactTitle", "contactEmail", "contactName2", "contactEmail2", "contactPhone", "stage", "pipelineStage", "ownerName", "volume", "numbers", "commentary", "leadTypeOverride", "originOverride"]) {
    if (k in body) data[k] = body[k] || null;
  }
  // Same checks the UI runs, enforced server-side so a bad value can't arrive
  // by another path (Shimmie 8/6). Rejected outright rather than stored dirty:
  // a phone number in contactEmail silently disables outbound on that lead.
  for (const f of VALIDATED_FIELDS) {
    if (!(f in data)) continue;
    const problem = validateField(f as FieldName, data[f] || "");
    if (problem) return NextResponse.json({ error: `${f}: ${problem}`, field: f }, { status: 400 });
    if (data[f]) data[f] = normalizeField(f as FieldName, data[f]);
  }

  // "I've got this" from the pipeline (Benjy 8/6) — a human taking a lead off
  // the daily digest. Only the stand-down is accepted from the UI; the agent's
  // other states are its own to manage.
  if (body.agentStatus === "closed") { data.agentStatus = "closed"; data.agentNextAt = null; }
  // Reassigning an agent-run lead to a HUMAN owner stands the agent down
  // automatically (Benjy 8/25 — Pussers Rum: the lead moved to Shimmie but
  // Jessica kept emailing because nothing told her to stop). Any owner other
  // than Jessica/TBD takes the thread; the agent's live statuses end here.
  if ("ownerName" in data) {
    const newOwner = String(data.ownerName || "").trim().toLowerCase();
    if (newOwner && newOwner !== "jessica" && newOwner !== "tbd") {
      const cur = await prisma.lead.findUnique({ where: { id: body.id }, select: { agentStatus: true, ownerName: true, agentLog: true } });
      const LIVE = ["awaiting_mary", "quote_received", "awaiting_customer_info", "info_nudge_1", "sent", "followup_1", "followup_2", "followup_3", "mailercity_qualifying", "awaiting_customer_file"];
      if (cur && LIVE.includes(cur.agentStatus || "") && String(cur.ownerName || "").toLowerCase() !== newOwner) {
        data.agentStatus = "owner_handling";
        data.agentNextAt = null;
        data.agentHold = true;
        try {
          const log = JSON.parse(cur.agentLog || "[]");
          log.push({ at: new Date().toISOString(), event: `Agent stood down - lead reassigned to ${data.ownerName}` });
          data.agentLog = JSON.stringify(log);
        } catch { /* log stays as-is */ }
      }
    }
  }
  if ("priority" in body) data.priority = body.priority ? Number(body.priority) : null;
  if ("agentHold" in body) data.agentHold = !!body.agentHold; // outbound "Don't email (agent)" toggle
  if ("lastInteraction" in body) data.lastInteraction = body.lastInteraction ? new Date(body.lastInteraction) : null;
  if ("followUpNote" in body) data.followUpNote = body.followUpNote || null;
  if ("followUpAt" in body) {
    data.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
    data.reminderSentAt = null;     // new/changed date → allow the reminder to fire again
    data.followUpDoneAt = null;     // setting/rescheduling a date reopens the follow-up
  }
  if ("followUpDoneAt" in body) data.followUpDoneAt = body.followUpDoneAt ? new Date(body.followUpDoneAt) : null;

  // Light history: log a completed or (re)scheduled follow-up into Notes so the
  // paper trail survives. Re-read commentary to avoid clobbering a concurrent edit.
  let fuLog: string | null = null;
  if ("followUpDoneAt" in body && body.followUpDoneAt) fuLog = "Follow-up completed";
  else if ("followUpAt" in body && body.followUpAt) fuLog = `Follow-up set for ${new Date(body.followUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (fuLog && !("commentary" in body)) {
    const cur = await prisma.lead.findUnique({ where: { id: body.id }, select: { commentary: true } });
    const stamp = new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
    data.commentary = `${(cur?.commentary || "").trim()}\n[Follow-up] ${fuLog} ${stamp}`.trim().slice(0, 8000);
  }
  // Closing a lead (Lost / Customer) stops all automation — no clocks, no
  // digest entries, no chasing. The stage move IS the close-out action
  // (Benjy 8/3: "just want to make sure we close this out correctly").
  if (data.pipelineStage === "LOST" || data.pipelineStage === "CUSTOMER") {
    const cur = await prisma.lead.findUnique({ where: { id: body.id }, select: { agentStatus: true, outreachStatus: true } });
    const TERMINAL = ["closed", "declined", "disqualified", "duplicate", "unsubscribed"];
    data.agentNextAt = null;
    data.outreachNextAt = null;
    if (cur?.agentStatus && !TERMINAL.includes(cur.agentStatus)) data.agentStatus = "closed";
    if (cur?.outreachStatus && !["unsubscribed", "bounced"].includes(cur.outreachStatus)) data.outreachStatus = "done";
  }

  const updated = await prisma.lead.update({ where: { id: body.id }, data });
  return NextResponse.json({ lead: updated });
}

export async function DELETE(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { prisma } = g;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
