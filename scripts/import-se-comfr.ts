// Southeast co-manufacturer target list -> Prospecting tab, owned by Jessica
// so the outbound agent picks them up (Benjy 8/7).
//
// Source: CND_Southeast_CoManufacturer_Targets.xlsx (82 rows, NC/SC/TN/AL/MS).
// Most emails in that file are pattern GUESSES, marked "(inf)". They're loaded
// with emailGuessed=true and runner-up patterns in emailAlternates, so a bounce
// rotates to the next pattern instead of dead-ending the lead.
//
//   npx tsx scripts/import-se-comfr.ts            # dry run
//   npx tsx scripts/import-se-comfr.ts --apply
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { validateField, normalizeField } from "../src/lib/lead-validate";

const APPLY = process.argv.includes("--apply");
const SRC = "scripts/_se-rows.json";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Row = {
  state: string; tier: string; company: string; segment: string; city: string;
  size: string; ownership: string; c1: string; e1: string; c2: string; e2: string;
  phone: string; website: string; notes: string;
};

// "Steve Draper - Head of Strategic Sourcing" -> name + title.
// Anything that is a role rather than a person ("Procurement / BD - via ...")
// must NOT become contactName: the agent refuses to write "Hi Procurement" and
// would park the lead as needs_name. Better to leave it blank and say why.
const ROLEISH = /^(procurement|purchasing|sourcing|ops|operations|bd|business development|sales|info|general|plant|hr|marketing|customer service|owner|management|team|contact)\b/i;
function parseContact(raw: string): { name: string | null; title: string | null; note: string | null } {
  const v = (raw || "").trim();
  if (!v) return { name: null, title: null, note: null };
  const [left, ...rest] = v.split(/\s+[-–—]\s+/);
  const name = (left || "").trim();
  const title = rest.join(" - ").trim() || null;
  if (!name || ROLEISH.test(name) || !/^[A-Z][a-z]/.test(name) || name.split(/\s+/).length < 2) {
    return { name: null, title: null, note: v };   // keep the raw text as a note
  }
  return { name, title, note: null };
}

const stripInf = (e: string) => (e || "").replace(/\(inf\)/gi, "").trim();
const isGuess = (e: string) => /\(inf\)/i.test(e || "");

// Runner-up patterns for a guessed address, in the order Benjy described:
// first@, flast@, first.last@. Never info@ — those are a waste.
function alternates(name: string | null, email: string, domain: string): string[] {
  if (!name || !domain) return [];
  const [first, ...restParts] = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const last = restParts[restParts.length - 1];
  if (!first || !last) return [];
  const cands = [`${first}@${domain}`, `${first[0]}${last}@${domain}`, `${first}.${last}@${domain}`, `${first}${last}@${domain}`];
  return [...new Set(cands)].filter((c) => c.toLowerCase() !== (email || "").toLowerCase());
}

const domainOf = (site: string) =>
  (site || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].trim().toLowerCase();

const norm = (s: string) => (s || "").toLowerCase()
  .replace(/\(.*?\)/g, " ")
  .replace(/\b(inc|llc|ltd|corp|co|company|the|group|holdings|industries|usa|labs?|laboratories)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim();

(async () => {
  const rows: Row[] = JSON.parse(fs.readFileSync(SRC, "utf8"));

  const existing = await prisma.lead.findMany({ select: { id: true, companyName: true, website: true, contactEmail: true, city: true, state: true, ownerName: true, pipelineStage: true } });
  const byName = new Map(existing.map((l) => [norm(l.companyName), l]));

  let created = 0, enriched = 0, skipped = 0, noEmail = 0, guessed = 0, rejected = 0, noName = 0, sendable = 0;
  const log: string[] = [];
  const samples: string[] = [];

  for (const r of rows) {
    const company = (r.company || "").trim();
    if (!company) { skipped++; continue; }

    const site = r.website ? normalizeField("website", r.website) : "";
    if (site && validateField("website", site)) { log.push(`  BAD SITE  ${company}: ${r.website}`); }
    const domain = domainOf(site);

    const p1 = parseContact(r.c1);
    const p2 = parseContact(r.c2);
    let email1 = stripInf(r.e1);
    let email2 = stripInf(r.e2);
    // Never store a value the app itself would reject on save.
    for (const [label, val] of [["contactEmail", email1], ["contactEmail2", email2]] as const) {
      if (val && validateField(label, val)) {
        log.push(`  DROP ${label}  ${company}: "${val}" — ${validateField(label, val)}`);
        if (label === "contactEmail") email1 = ""; else email2 = "";
        rejected++;
      }
    }
    email1 = email1 ? normalizeField("contactEmail", email1) : "";
    email2 = email2 ? normalizeField("contactEmail2", email2) : "";

    let phone = (r.phone || "").trim();
    if (phone && validateField("contactPhone", phone)) { log.push(`  DROP phone  ${company}: "${phone}"`); phone = ""; }

    const tier = parseInt(String(r.tier), 10);
    const priority = tier >= 1 && tier <= 3 ? tier : null;

    const noteParts = [
      r.notes && String(r.notes).trim(),
      r.size && `Size: ${String(r.size).trim()}`,
      r.ownership && `Ownership: ${String(r.ownership).trim()}`,
      p1.note && `Contact 1 listed as: ${p1.note}`,
      p2.note && `Contact 2 listed as: ${p2.note}`,
      isGuess(r.e1) && "Email is a PATTERN GUESS, not verified — a bounce rotates to the next pattern automatically.",
    ].filter(Boolean);
    const commentary = `[SE co-manufacturer list, imported 8/7] Tier ${r.tier} · ${r.segment || "—"}\n${noteParts.join("\n")}`.slice(0, 8000);

    if (!email1 && !email2) noEmail++;
    if (isGuess(r.e1)) guessed++;
    if (!p1.name && !p2.name) noName++;
    if ((p1.name && email1) || (p2.name && email2)) sendable++;
    if (samples.length < 6 && p1.name) samples.push(`  ${company.slice(0, 28).padEnd(28)} ${String(p1.name).padEnd(20)} ${String(p1.title || "").slice(0, 24).padEnd(24)} ${email1 || "(no email)"}`);

    // Two plants of the same parent are NOT the same lead. "Voyant Beauty
    // (Olive Branch plant)" in MS must not overwrite "Voyant Beauty
    // (Gainesville plant)" in IL — enriching would silently relabel a real
    // record. Only treat as a duplicate when the site qualifier matches too.
    const siteQualifier = (n: string) => (n.match(/\(([^)]*)\)/)?.[1] || "").toLowerCase().trim();
    const candidate = byName.get(norm(company));
    const dup = candidate && siteQualifier(candidate.companyName) === siteQualifier(company) ? candidate : undefined;
    if (candidate && !dup) {
      log.push(`  SEPARATE  ${company}  — same parent as "${candidate.companyName}" but a different site; importing as its own lead`);
    }
    const data: any = {
      companyName: company,
      endMarket: (r.segment || "").trim() || null,
      city: (r.city || "").trim() || null,
      state: (r.state || "").trim().toUpperCase() || null,
      website: site || null,
      contactName: p1.name, contactTitle: p1.title, contactEmail: email1 || null,
      contactName2: p2.name, contactEmail2: email2 || null,
      contactPhone: phone || null,
      priority,
      ownerName: "Jessica",
      pipelineStage: "LEAD",
      source: "prospecting",
      agentHold: false,
      emailGuessed: isGuess(r.e1) || isGuess(r.e2),
      emailAlternates: JSON.stringify(alternates(p1.name, email1, domain)),
      commentary,
    };

    if (dup) {
      // Same company already in the funnel. Fill in what we now know rather
      // than creating a second row the agent could email twice.
      enriched++;
      log.push(`  ENRICH    ${company}  (existing: ${dup.companyName}, ${dup.city || "?"} ${dup.state || "?"}, owner ${dup.ownerName})`);
      if (APPLY) {
        const patch: any = { ...data };
        delete patch.companyName;               // keep the name already on file
        if (dup.pipelineStage !== "LEAD") { delete patch.pipelineStage; delete patch.ownerName; }
        await prisma.lead.update({ where: { id: dup.id }, data: patch });
        await prisma.leadNote.create({ data: {
          leadId: dup.id, kind: "system", source: "import", authorName: "Godzilla",
          body: `Enriched from the Southeast co-manufacturer list (8/7): ${r.city}, ${r.state} · Tier ${r.tier}.`,
        } });
      }
      continue;
    }

    created++;
    if (APPLY) {
      const lead = await prisma.lead.create({ data });
      await prisma.leadNote.create({ data: {
        leadId: lead.id, kind: "system", source: "import", authorName: "Godzilla",
        body: commentary,
      } });
    }
  }

  console.log(`\nSoutheast co-manufacturer list -> Prospecting / Jessica`);
  console.log(`  rows in file:        ${rows.length}`);
  console.log(`  new leads:           ${created}`);
  console.log(`  existing enriched:   ${enriched}`);
  console.log(`  skipped (no name):   ${skipped}`);
  console.log(`  with NO email:       ${noEmail}  (call targets — agent can't email them)`);
  console.log(`  guessed emails:      ${guessed}  (flagged, alternates loaded for bounce rotation)`);
  console.log(`  values rejected:     ${rejected}`);
  console.log(`  no real contact name: ${noName}  (agent parks these as "needs contact name")`);
  console.log(`  ready for Jessica:   ${sendable}  (real name + valid email)`);
  if (samples.length) { console.log("\nParsed contacts (sample):"); samples.forEach((x) => console.log(x)); }
  if (log.length) { console.log("\nDetail:"); log.forEach((l) => console.log(l)); }
  console.log(APPLY ? "\nApplied.\n" : "\nDRY RUN — re-run with --apply.\n");
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
