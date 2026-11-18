// One company, one record (Benjy 11/18). A lead in the funnel and the customer
// record jobs/invoices hang off must be the same company, matched loosely so
// "Berry Publication's, Inc." and "Berry Publications" are one name.

const SUFFIXES = /\b(incorporated|inc|llc|l l c|ltd|limited|corp|corporation|co|company|pllc|pa|plc|lp|llp|the)\b/g;

/** Comparable company name: lowercase, no punctuation, no Inc/LLC/Corp, no spaces. */
export function normCompany(name: string | null | undefined): string {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, "");
}

/** First meaningful word, used to pull candidates from the DB before the exact compare. */
export function keyWord(name: string): string {
  const words = String(name || "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !["the", "inc", "llc", "corp", "and"].includes(w));
  return words[0] || String(name || "").trim().slice(0, 3);
}

/** Existing customer record with the same normalized name, if any. */
export async function findCompanyByName(prisma: any, name: string) {
  const target = normCompany(name);
  if (!target) return null;
  const cands = await prisma.company.findMany({ where: { name: { contains: keyWord(name), mode: "insensitive" } }, select: { id: true, name: true, isActive: true, archivedReason: true, archivedBy: true, archivedAt: true }, take: 200 });
  return cands.find((c: any) => normCompany(c.name) === target) || null;
}

/** Possible duplicates for the add-lead warning: same or containing normalized name. */
export async function similarRecords(prisma: any, name: string) {
  const target = normCompany(name);
  const kw = keyWord(name);
  if (target.length < 3) return { leads: [], companies: [], quotes: [] };
  const close = (other: string) => { const n = normCompany(other); return !!n && (n === target || (n.length >= 4 && target.length >= 4 && (n.includes(target) || target.includes(n)))); };
  const [leads, companies, quotes] = await Promise.all([
    prisma.lead.findMany({ where: { companyName: { contains: kw, mode: "insensitive" } }, select: { id: true, companyName: true, pipelineStage: true }, take: 100 }),
    prisma.company.findMany({ where: { name: { contains: kw, mode: "insensitive" } }, select: { id: true, name: true, isActive: true, archivedReason: true }, take: 100 }),
    prisma.quote.findMany({ where: { customerName: { contains: kw, mode: "insensitive" } }, select: { id: true, quoteNumber: true, customerName: true }, take: 100 }),
  ]);
  return {
    leads: leads.filter((l: any) => close(l.companyName)).slice(0, 5),
    companies: companies.filter((c: any) => close(c.name)).slice(0, 5),
    quotes: quotes.filter((q: any) => close(q.customerName)).slice(0, 5),
  };
}

/** The message shown when someone tries to add a customer that was archived. */
export function archivedMessage(c: { name: string; archivedReason?: string | null; archivedBy?: string | null; archivedAt?: Date | string | null }) {
  const when = c.archivedAt ? new Date(c.archivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  return `${c.name} is archived: ${c.archivedReason || "out of business"}${c.archivedBy ? ` (${c.archivedBy}${when ? `, ${when}` : ""})` : ""}. The record is kept for reference. If they're back in business, ask accounting to restore it on the customer's page.`;
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "customer";

/** Link a lead to its customer record, creating the record only if no match exists. */
export async function linkLeadToCompany(prisma: any, lead: { id: string; companyName: string; companyId?: string | null; website?: string | null; endMarket?: string | null }) {
  if (lead.companyId) return lead.companyId;
  let company = await findCompanyByName(prisma, lead.companyName);
  if (!company) {
    let slug = slugify(lead.companyName);
    if (await prisma.company.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString().slice(-4)}`;
    company = await prisma.company.create({ data: { name: lead.companyName, slug, type: "customer", website: lead.website || null, industry: lead.endMarket || null } });
  }
  await prisma.lead.update({ where: { id: lead.id }, data: { companyId: company.id } });
  // Prototypes asked for on the lead belong to the customer now too.
  await prisma.prototype.updateMany({ where: { leadId: lead.id, companyId: null }, data: { companyId: company.id } }).catch(() => {});
  // The lead's files belong to the customer now (Benjy 8/5).
  await prisma.attachment.updateMany({ where: { leadId: lead.id, companyId: null }, data: { companyId: company.id } });
  return company.id as string;
}
