// "New Lead" gate (Shimmie 9/24): a prospecting lead sits in New Lead (Not
// contacted) until a rep actually does something. The moment they add a note,
// a contact, or enrich the record, Godzilla makes them say where it stands
// first, so the sub-status is never stale.
export const NEW_LEAD = "New Lead (Not contacted)";
export const NEW_LEAD_MESSAGE = `This lead is still "${NEW_LEAD}". Set the sub-status first (Actively Working, Quote Needed or Quote Sent), then add this.`;

export async function newLeadBlock(prisma: any, leadId: string): Promise<string | null> {
  const l = await prisma.lead.findUnique({ where: { id: leadId }, select: { source: true, stage: true } });
  if (!l) return null;
  if (l.source === "prospecting" && (l.stage || "") === NEW_LEAD) return NEW_LEAD_MESSAGE;
  return null;
}

// Fields whose edit counts as "working the lead" and therefore needs a real sub-status.
export const ENRICH_FIELDS = ["website", "city", "state", "volume", "numbers", "commentary", "endMarket", "productCategory", "contactName", "contactTitle", "contactEmail", "contactName2", "contactEmail2", "contactPhone", "priority"];
