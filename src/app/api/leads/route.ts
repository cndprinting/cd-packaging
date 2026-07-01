import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

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

  const leads = await prisma.lead.findMany({
    orderBy: [{ priority: "asc" }, { lastInteraction: "desc" }],
  });
  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { prisma, session } = g;
  const body = await request.json();
  if (!body.companyName) return NextResponse.json({ error: "Company name required" }, { status: 400 });
  const lead = await prisma.lead.create({
    data: {
      companyName: body.companyName,
      endMarket: body.endMarket || null,
      productCategory: body.productCategory || null,
      website: body.website || null,
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
  const { prisma } = g;
  const body = await request.json();
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
    return NextResponse.json({ lead: updated, companyId });
  }

  // Inline field updates (dropdowns, text, stage move).
  const data: any = {};
  for (const k of ["companyName", "endMarket", "productCategory", "website", "city", "state", "contactName", "contactTitle", "contactEmail", "contactName2", "contactEmail2", "contactPhone", "stage", "pipelineStage", "ownerName", "volume", "numbers", "commentary"]) {
    if (k in body) data[k] = body[k] || null;
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
