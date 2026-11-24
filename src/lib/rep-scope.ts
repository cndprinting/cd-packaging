// Sales reps see only their own accounts (Benjy 11/24/26, when Bruce Eberline and
// Barry Gervais were added). Applies to the SALES_REP role only; owners, CSRs,
// accounting, the plant and SALES_MANAGER keep the full view.
//
// A rep's own:
//   jobs      = jobs where they are the sales rep (salesRepId, or repName text from imports)
//   accounts  = customers on those jobs, on invoices where they are the rep, on job
//               hand-offs they submitted or are the rep on, and on funnel leads they own
//   leads     = funnel leads whose owner is their first name
import { NextResponse } from "next/server";

export type RepScope = { userId: string; name: string; jobIds: string[]; orderIds: string[]; companyIds: string[]; leadIds: string[] };

export const isScopedRep = (s: { role?: string } | null | undefined) => s?.role === "SALES_REP";

export async function repScope(prisma: any, session: { id: string; name: string; role: string } | null | undefined): Promise<RepScope | null> {
  if (!session || !isScopedRep(session)) return null;
  const name = String(session.name || "").trim();
  const first = name.split(/\s+/)[0] || "";
  const [jobs, invs, hand, leads] = await Promise.all([
    prisma.job.findMany({ where: { OR: [{ salesRepId: session.id }, ...(name ? [{ repName: { equals: name, mode: "insensitive" } }] : [])] }, select: { id: true, orderId: true, order: { select: { companyId: true } } } }),
    prisma.invoice.findMany({ where: { salesRepId: session.id }, select: { companyId: true, jobId: true } }),
    prisma.jobHandoff.findMany({ where: { OR: [{ salesRepId: session.id }, { submittedById: session.id }] }, select: { companyId: true, jobId: true } }).catch(() => []),
    first ? prisma.lead.findMany({ where: { OR: [{ ownerName: { equals: first, mode: "insensitive" } }, { ownerName: { equals: name, mode: "insensitive" } }] }, select: { id: true, companyId: true } }) : [],
  ]);
  const jobIds = new Set<string>(jobs.map((j: any) => j.id));
  for (const x of [...invs, ...hand]) if (x.jobId) jobIds.add(x.jobId);
  const companyIds = new Set<string>();
  for (const j of jobs) if (j.order?.companyId) companyIds.add(j.order.companyId);
  for (const x of [...invs, ...hand, ...leads]) if (x.companyId) companyIds.add(x.companyId);
  return {
    userId: session.id, name,
    jobIds: [...jobIds], orderIds: [...new Set<string>(jobs.map((j: any) => j.orderId))],
    companyIds: [...companyIds], leadIds: leads.map((l: any) => l.id),
  };
}

/** Prisma where for Job rows a rep may see (null scope = no limit). */
export const jobWhere = (sc: RepScope | null) => (sc ? { id: { in: sc.jobIds } } : {});
/** Prisma where for rows keyed by companyId. */
export const companyWhere = (sc: RepScope | null) => (sc ? { companyId: { in: sc.companyIds } } : {});

export const notYours = () => NextResponse.json({ error: "That account isn't assigned to you." }, { status: 403 });

/** True when this login may see the job (always true for everyone but a sales rep). */
export async function repCanJob(prisma: any, session: any, jobId: string | null | undefined) {
  const sc = await repScope(prisma, session);
  return !sc || (!!jobId && sc.jobIds.includes(jobId));
}
/** True when this login may see the customer account. */
export async function repCanCompany(prisma: any, session: any, companyId: string | null | undefined) {
  const sc = await repScope(prisma, session);
  return !sc || (!!companyId && sc.companyIds.includes(companyId));
}

/** Drop-in guard for a route keyed by a job id: returns a 403 response for a rep's non-own job, else null. */
export async function repJobGuard(jobId: string | null | undefined) {
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  if (!isScopedRep(session)) return null;
  const prisma = (await import("@/lib/prisma")).default;
  return (await repCanJob(prisma, session, jobId)) ? null : notYours();
}
/** Same, keyed by a customer (company) id. */
export async function repCompanyGuard(companyId: string | null | undefined) {
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  if (!isScopedRep(session)) return null;
  const prisma = (await import("@/lib/prisma")).default;
  return (await repCanCompany(prisma, session, companyId)) ? null : notYours();
}
/** Same, keyed by an order id (an order belongs to one customer). */
export async function repOrderGuard(orderId: string | null | undefined) {
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  if (!isScopedRep(session)) return null;
  const prisma: any = (await import("@/lib/prisma")).default;
  const o = orderId ? await prisma.order.findUnique({ where: { id: orderId }, select: { companyId: true } }) : null;
  return (await repCanCompany(prisma, session, o?.companyId)) ? null : notYours();
}
/** The scope for whoever is signed in (null = no limit). */
export async function currentRepScope() {
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  if (!isScopedRep(session)) return null;
  return repScope((await import("@/lib/prisma")).default, session);
}
/** Prisma where for Shipment rows a rep may see: their jobs, accounts and prospects. */
export const shipmentWhere = (sc: RepScope | null) => (sc ? { OR: [{ jobId: { in: sc.jobIds } }, { companyId: { in: sc.companyIds } }, { leadId: { in: sc.leadIds } }] } : {});
export const repSeesShipment = (sc: RepScope | null, s: { jobId?: string | null; companyId?: string | null; leadId?: string | null }) =>
  !sc || (!!s.jobId && sc.jobIds.includes(s.jobId)) || (!!s.companyId && sc.companyIds.includes(s.companyId)) || (!!s.leadId && sc.leadIds.includes(s.leadId));
/** Quotes / quote requests a rep may see: ones they made, or on their own accounts. */
export const repSeesQuote = (sc: RepScope | null, q: { companyId?: string | null; createdBy?: string | null; submittedBy?: string | null }) =>
  !sc || q.createdBy === sc.userId || q.submittedBy === sc.userId || (!!q.companyId && sc.companyIds.includes(q.companyId));
