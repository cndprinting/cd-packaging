// Apply researched contact data (Benjy 8/2). Every value below was found on a
// public page — nothing pattern-guessed. Rules:
//   * only FILL blanks; never overwrite a human-entered name/email
//   * discrepancies with existing data go in commentary, not over the top of it
//   npx tsx scripts/apply-researched-contacts.ts            → dry run
//   npx tsx scripts/apply-researched-contacts.ts --apply    → writes
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── A. Leads the agent REFUSED to email because no human name was attached.
// Naming the person on the address we already had unblocks outreach.
const NAME_FOR_EXISTING_EMAIL: { id: string; co: string; name: string; title: string; src: string }[] = [
  { id: "cmr2kbd8d0007vwwjgzdzfylf", co: "Draga Laboratories", name: "Angela Williams", title: "CEO", src: "LinkedIn company page" },
  { id: "lda6a6c3a2f3b92195bf60f447", co: "Gummy Works", name: "Brad Satz", title: "CEO & Co-Founder", src: "theorg.com" },
  { id: "cmr2kbdcv0009vwwjfskz04p7", co: "FormuNova", name: "Gabriela Miraglia Ribeiro", title: "Principal, R&D/Quality", src: "LinkedIn" },
  { id: "lda068f228b6da12334828fc45", co: "Lightning Labs", name: "David Winsauer", title: "Co-Owner", src: "public profile" },
];

// ── B. Named person WITH a published personal email → fully emailable.
const PERSON_EMAIL: { id: string; co: string; name: string; email: string; src: string }[] = [
  { id: "cmrf4meb2000304l91hc8zr9d", co: "Hamsas of Munkatch", name: "Kenny Zablotsky", email: "kenny@hamsasofmunkatch.com", src: "jewishjoy.co/pages/general-inquiry" },
  { id: "cmrf4n6re000404l9i6k5ra7i", co: "Colossal Studios", name: "Isaac Amar", email: "isaac@colossalstudios.com", src: "colossalstudios.com/contact" },
  { id: "ldfab7b87c3768a815864edcbf", co: "Hive Bakery", name: "Karin Savine", email: "karin@hivepalmbeach.com", src: "hive press release" },
];

// ── C. Decision-maker NAME found, no published email. Recorded so a human can
// call, and so the name is ready if an address ever surfaces.
const NAME_ONLY: { id: string; co: string; name: string; title: string }[] = [
  { id: "cmr4zo9km0000x4wj2jldglxm", co: "Duradry", name: "Jack Benzaquen", title: "Founder & CEO" },
  { id: "cmr2kbcwl0002vwwj4tqinyw6", co: "Valentine Enterprises", name: "Alan W. Smith", title: "President/CEO" },
  { id: "ld9e34b4d3a173430a32d213ed", co: "Sun-Pac Manufacturing", name: "Gary M. Henderson", title: "President" },
  { id: "ld4a95cab361756126dabb40fa", co: "Hatberg Collective", name: "Chaz Hatfield", title: "CEO & Co-Founder" },
  { id: "ldff495cf9af9501f419c01506", co: "CUNSA International", name: "Francisco Caceres Mesias", title: "Business Development Mgr" },
  { id: "ld551cb877a4043594698c9c71", co: "InSpec Solutions", name: "Matt Hewitt", title: "Principal" },
  { id: "ldd0705b79904335992d82b761", co: "Life All Natural", name: "Raciel S. Leyva", title: "President" },
  { id: "cmruq8skk000004lasj81eu0d", co: "Shipley Do-Nuts", name: "Bill Leibengood", title: "Chief Marketing Officer" },
  { id: "ld2e8cb3a3c40c43b2bd22a76e", co: "Buccan Coral Gables", name: "Clay Conley", title: "Owner/Chef" },
];

// ── D. CRM data corrections found during research.
const FIXES: { id: string; co: string; field: "website"; value: string; why: string }[] = [
  { id: "cmr2kbed0000qvwwjlns8qkr7", co: "US Pharmaceutical", field: "website", value: "https://uspco.com", why: "uspharmaceutical.com redirects to an unrelated recruiting firm" },
  { id: "cmr2kbe4m000mvwwjqht60tpz", co: "Nutritional Resources", field: "website", value: "https://nrimfg.com", why: "healthwisenri.com now redirects here" },
];

// ── E. Research contradicts a name already on the lead — noted, NOT overwritten.
const DISCREPANCIES: { id: string; co: string; note: string }[] = [
  { id: "cms67ub5n000004joc8iuu693", co: "Lola and The Boys", note: "Public sources name the founder as Irina Ovrutsky; the lead lists 'Angeli Angelios'. Confirm which is our actual contact." },
  { id: "cms4r8thn000004jva95asnf6", co: "Half Moon Empanadas", note: "Public sources name the CEO as Pilar Guzman Zavala; the lead lists 'Angele Perez'. Confirm which is our actual contact." },
  { id: "cms6hzi2i000004jp3t8drx3q", co: "Red Rooster Overtown", note: "Could not verify 'Isaiah Tudor' on any public source. Parent group inbox: info@samuelssongroup.com." },
  { id: "cmrf4ouj5000504l9xa99aedn", co: "Jewish Joy", note: "Same principal and inbox as Hamsas of Munkatch (Kenny Zablotsky) - treat as ONE outreach, not two." },
];

const stamp = (c: string | null, line: string) =>
  (c || "").includes(line.slice(0, 40)) ? (c || "") : `${c || ""}\n${line}`.trim().slice(0, 8000);

(async () => {
  let n = 0;
  const log = (s: string) => console.log(s);

  log(`\n── A. Name added to an address we already had (unblocks the agent) ── ${NAME_FOR_EXISTING_EMAIL.length}`);
  for (const r of NAME_FOR_EXISTING_EMAIL) {
    const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { contactName: true, contactEmail: true, commentary: true } });
    if (!cur) { log(`  MISSING ${r.co}`); continue; }
    log(`  ${r.co.padEnd(24)} ${r.name} (${r.title}) -> ${cur.contactEmail}${cur.contactName ? "   [already named: " + cur.contactName + ", skipping]" : ""}`);
    if (APPLY && !cur.contactName) {
      await prisma.lead.update({ where: { id: r.id }, data: {
        contactName: r.name, contactTitle: r.title,
        outreachStatus: null, // clear the needs_name block so the sweep can pick it up
        commentary: stamp(cur.commentary, `[Research 8/2] Contact identified: ${r.name}, ${r.title} (${r.src}).`),
      } });
      n++;
    }
  }

  log(`\n── B. Named person + published personal email ── ${PERSON_EMAIL.length}`);
  for (const r of PERSON_EMAIL) {
    const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { contactName: true, contactEmail: true, commentary: true } });
    if (!cur) { log(`  MISSING ${r.co}`); continue; }
    log(`  ${r.co.padEnd(24)} ${r.name} <${r.email}>${cur.contactEmail ? "   [already has " + cur.contactEmail + "]" : ""}`);
    if (APPLY) {
      await prisma.lead.update({ where: { id: r.id }, data: {
        contactName: cur.contactName || r.name,
        contactEmail: cur.contactEmail || r.email,
        commentary: stamp(cur.commentary, `[Research 8/2] ${r.name} <${r.email}> (${r.src}).`),
      } });
      n++;
    }
  }

  log(`\n── C. Decision-maker named, no published email (for manual outreach) ── ${NAME_ONLY.length}`);
  for (const r of NAME_ONLY) {
    const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { contactName: true, commentary: true } });
    if (!cur) { log(`  MISSING ${r.co}`); continue; }
    log(`  ${r.co.padEnd(24)} ${r.name} (${r.title})${cur.contactName ? "   [already named: " + cur.contactName + "]" : ""}`);
    if (APPLY) {
      await prisma.lead.update({ where: { id: r.id }, data: {
        contactName: cur.contactName || r.name,
        contactTitle: r.title,
        commentary: stamp(cur.commentary, `[Research 8/2] Decision-maker: ${r.name}, ${r.title}. No published email - call or find on LinkedIn.`),
      } });
      n++;
    }
  }

  log(`\n── D. Website corrections ── ${FIXES.length}`);
  for (const r of FIXES) {
    log(`  ${r.co.padEnd(24)} -> ${r.value}   (${r.why})`);
    if (APPLY) {
      const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { commentary: true } });
      await prisma.lead.update({ where: { id: r.id }, data: { website: r.value, commentary: stamp(cur?.commentary ?? null, `[Research 8/2] Website corrected: ${r.why}.`) } });
      n++;
    }
  }

  log(`\n── E. Flagged discrepancies (noted only, nothing overwritten) ── ${DISCREPANCIES.length}`);
  for (const r of DISCREPANCIES) {
    log(`  ${r.co.padEnd(24)} ${r.note}`);
    if (APPLY) {
      const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { commentary: true } });
      if (cur) { await prisma.lead.update({ where: { id: r.id }, data: { commentary: stamp(cur.commentary, `[Research 8/2] ${r.note}`) } }); n++; }
    }
  }

  log(APPLY ? `\nApplied ${n} updates.\n` : `\nDRY RUN — nothing written. Re-run with --apply.\n`);
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
