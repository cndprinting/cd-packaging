// One-time: fold the legacy contact fields + number dump into LeadContact rows (Shimmie 9/23).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const digits = (s: string) => s.replace(/\D/g, "");
async function main() {
  const leads = await prisma.lead.findMany({ select: { id: true, contactName: true, contactTitle: true, contactEmail: true, contactPhone: true, contactName2: true, contactEmail2: true, numbers: true, emailAlternates: true, contacts: { select: { id: true } } } });
  let made = 0, skipped = 0;
  for (const l of leads) {
    if (l.contacts.length) { skipped++; continue; }
    const rows: { name: string; title?: string | null; email?: string | null; phone?: string | null; emailCandidates?: string | null; phoneCandidates?: string | null }[] = [];
    // number dump: anything in `numbers` plus a multi-number contactPhone; the clean single number becomes the primary
    const dumpSrc = [l.numbers || "", l.contactPhone || ""].join("\n");
    const dump = dumpSrc.split(/\r?\n|;|·|\)R:|\)C:|\)U:/).map((x) => x.trim()).filter((x) => digits(x).length >= 7);
    const single = l.contactPhone && digits(l.contactPhone).length >= 7 && digits(l.contactPhone).length <= 11 && !/[A-Za-z]{2,}/.test(l.contactPhone) ? l.contactPhone.trim() : null;
    const emailAlts = (l.emailAlternates || "").split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x.includes("@") && x.toLowerCase() !== (l.contactEmail || "").toLowerCase());
    if (l.contactName || l.contactEmail || single || dump.length) {
      rows.push({ name: l.contactName || "Primary contact", title: l.contactTitle, email: l.contactEmail, phone: single,
        emailCandidates: emailAlts.length ? emailAlts.join("\n") : null,
        phoneCandidates: dump.filter((d) => !single || digits(d) !== digits(single)).join("\n") || null });
    }
    if (l.contactName2 || l.contactEmail2) rows.push({ name: l.contactName2 || "Second contact", email: l.contactEmail2 });
    for (let i = 0; i < rows.length; i++) await prisma.leadContact.create({ data: { leadId: l.id, sort: i, ...rows[i] } });
    if (rows.length) made++;
  }
  console.log(`leads with contacts created: ${made} | already had: ${skipped} | none to migrate: ${leads.length - made - skipped}`);
  await prisma.$disconnect();
}
main();
