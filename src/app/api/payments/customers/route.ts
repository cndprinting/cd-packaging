import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Customer picker for New invoice (Benjy 11/7: every invoice must hang off the
// same customer record the rest of Godzilla uses, never a retyped name).
// GET ?q=  -> matching customers with their billing email and recent jobs.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ customers: [] });
  const companies = await prisma.company.findMany({
    where: { type: "customer", isActive: true, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    select: { id: true, name: true, city: true, state: true, contacts: { select: { name: true, email: true, isPrimary: true }, orderBy: { isPrimary: "desc" }, take: 3 } },
    orderBy: { name: "asc" }, take: 12,
  });
  const ids = companies.map((c) => c.id);
  const jobs = ids.length ? await prisma.job.findMany({
    where: { order: { companyId: { in: ids } }, status: { notIn: ["CANCELLED"] as any } },
    select: { id: true, order: { select: { companyId: true } }, jobNumber: true, name: true, quotedPrice: true, status: true, salesRep: { select: { name: true } }, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 60,
  }).catch(() => []) : [];
  const out = companies.map((c) => ({
    id: c.id, name: c.name, where: [c.city, c.state].filter(Boolean).join(", "),
    email: c.contacts.find((x) => x.email)?.email || null, contact: c.contacts[0]?.name || null,
    jobs: jobs.filter((j: any) => j.order?.companyId === c.id).slice(0, 10).map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, quotedPrice: j.quotedPrice, status: j.status, rep: j.salesRep?.name || null })),
  }));
  // Sales reps for the manual commission pick (Benjy 11/7: Denise reads the
  // rep off Mary's estimate until jobs live in Godzilla). Jessica is the AI agent.
  const reps = await prisma.user.findMany({ where: { isActive: true, role: { in: ["SALES_REP", "SALES_MANAGER", "OWNER", "ADMIN"] }, email: { endsWith: "@cndprinting.com", not: "jwaxman@cndprinting.com" }, NOT: { name: { contains: "retired" } } }, select: { id: true, name: true, commissionPct: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ customers: out, reps });
}
