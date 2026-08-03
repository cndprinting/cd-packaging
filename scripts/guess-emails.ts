// Generate likely email addresses for leads that have a person's name and a
// website but no address (Benjy 8/2: "why not guess... first@ / flast@ /
// first.last@ — don't email info@ addresses, those are a waste").
//
// Safeguards, because a bounce costs sender reputation:
//   1. LEARN the pattern from addresses we already know at the same domain.
//   2. Otherwise use the pattern distribution observed across our own CRM.
//   3. Skip domains with no MX record (nothing can receive mail there).
//   4. Store the runners-up so a bounce rotates to the next candidate
//      instead of killing the lead.
//   5. Never guess for role words ("Purchasing / Ops") — no person, no guess.
//
//   npx tsx scripts/guess-emails.ts            → dry run
//   npx tsx scripts/guess-emails.ts --apply    → writes
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { resolveMx } from "node:dns/promises";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ROLE = new Set(["info", "sales", "hello", "admin", "office", "contact", "support", "team",
  "accounts", "accounting", "billing", "orders", "order", "purchasing", "ops", "operations",
  "enquiries", "inquiries", "inquiry", "marketing", "service", "services", "owner", "manager",
  "business", "development", "procurement", "gainesville", "corporate"]);

/** "Phil Alessi" -> {first:"phil", last:"alessi"}; multi-person fields take the
 *  first person; role words and initials-only are rejected. */
function parseName(raw: string | null): { first: string; last: string } | null {
  const firstPerson = (raw || "").split(/[|,;/]| and /i)[0].trim();
  const clean = firstPerson.replace(/["'".]/g, " ").replace(/\s+/g, " ").trim();
  const SUFFIX = new Set(["jr", "sr", "ii", "iii", "iv", "md", "phd", "cpa", "esq"]);
  const parts = clean.split(" ")
    .filter((p) => p.length > 1 && /^[A-Za-z-]+$/.test(p))
    .filter((p) => !SUFFIX.has(p.toLowerCase()));   // "David A. Erdman Sr." -> erdman, not sr
  if (parts.length < 2) return null;                       // need first AND last
  const first = parts[0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();
  if (ROLE.has(first) || ROLE.has(last)) return null;      // "Purchasing / Ops"
  if (first.length < 2 || last.length < 2) return null;
  return { first, last };
}

function domainOf(website: string | null): string | null {
  const w = (website || "").trim();
  if (!w) return null;
  const m = w.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
  return m ? m[1].toLowerCase().replace(/\/$/, "") : null;
}

type Pattern = "first" | "flast" | "first.last" | "firstlast" | "first_last" | "f.last" | "lastf";
const build = (p: Pattern, f: string, l: string, d: string): string => {
  const local = p === "first" ? f
    : p === "flast" ? f[0] + l
    : p === "first.last" ? `${f}.${l}`
    : p === "firstlast" ? f + l
    : p === "first_last" ? `${f}_${l}`
    : p === "f.last" ? `${f[0]}.${l}`
    : l + f[0];
  return `${local}@${d}`;
};
const ALL: Pattern[] = ["first", "flast", "first.last", "firstlast", "f.last", "first_last", "lastf"];

/** Which pattern does this known address use for this known name? */
function detect(email: string, first: string, last: string): Pattern | null {
  const local = email.split("@")[0].toLowerCase();
  for (const p of ALL) {
    if (build(p, first, last, "x").split("@")[0] === local) return p;
  }
  return null;
}

(async () => {
  // ── Learn from our own data ────────────────────────────────────────────
  const known = await prisma.lead.findMany({
    where: { NOT: [{ contactEmail: null }, { contactEmail: "" }, { contactName: null }] },
    select: { contactName: true, contactEmail: true, website: true },
  });
  const byDomain = new Map<string, Pattern>();
  const tally = new Map<Pattern, number>();
  for (const k of known) {
    const nm = parseName(k.contactName);
    const em = (k.contactEmail || "").trim().toLowerCase();
    if (!nm || !em.includes("@")) continue;
    const p = detect(em, nm.first, nm.last);
    if (!p) continue;
    tally.set(p, (tally.get(p) || 0) + 1);
    byDomain.set(em.split("@")[1], p);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  console.log("\nPattern distribution in our own contacts:");
  if (ranked.length) for (const [p, n] of ranked) console.log(`  ${p.padEnd(12)} ${n}`);
  else console.log("  (no name/email pairs to learn from — using the standard order)");
  // Benjy's stated order, re-ranked by whatever our data actually shows.
  const DEFAULT: Pattern[] = ["first", "flast", "first.last", "firstlast", "f.last"];
  const order: Pattern[] = [...ranked.map(([p]) => p), ...DEFAULT.filter((p) => !tally.has(p))];

  // ── Candidates ─────────────────────────────────────────────────────────
  const leads = await prisma.lead.findMany({
    where: {
      pipelineStage: { in: ["LEAD", "QUALIFIED"] }, agentHold: false,
      OR: [{ contactEmail: null }, { contactEmail: "" }],
      NOT: [{ contactName: null }, { contactName: "" }, { website: null }, { website: "" }],
    },
    select: { id: true, companyName: true, contactName: true, website: true, commentary: true },
  });

  const mxCache = new Map<string, boolean>();
  // FAIL OPEN: only reject on a definitive "this domain has zero MX records".
  // A lookup error (blocked resolver, timeout) tells us nothing, and treating
  // it as failure silently rejected every domain on the first run.
  const hasMx = async (d: string) => {
    if (mxCache.has(d)) return mxCache.get(d)!;
    let ok = true;
    try { ok = (await resolveMx(d)).length > 0; }
    catch (e: any) { ok = e?.code === "ENOTFOUND" || e?.code === "ENODATA"; if (!ok && e?.code !== "ENOTFOUND" && e?.code !== "ENODATA") ok = true; }
    mxCache.set(d, ok);
    return ok;
  };

  const writes: { id: string; co: string; email: string; alts: string[]; why: string }[] = [];
  const skipped: { co: string; why: string }[] = [];

  for (const l of leads) {
    const nm = parseName(l.contactName);
    const dom = domainOf(l.website);
    if (!nm) { skipped.push({ co: l.companyName, why: `no personal name ("${(l.contactName || "").slice(0, 30)}")` }); continue; }
    if (!dom) { skipped.push({ co: l.companyName, why: "no usable domain" }); continue; }
    if (!(await hasMx(dom))) { skipped.push({ co: l.companyName, why: `${dom} accepts no mail (no MX)` }); continue; }

    const learned = byDomain.get(dom);
    const seq = learned ? [learned, ...order.filter((p) => p !== learned)] : order;
    const cands = seq.map((p) => build(p, nm.first, nm.last, dom));
    writes.push({
      id: l.id, co: l.companyName, email: cands[0], alts: cands.slice(1, 4),
      why: learned ? `pattern known for ${dom}` : `most common pattern (${seq[0]})`,
    });
  }

  console.log(`\n── Would set ${writes.length} guessed addresses ──`);
  for (const w of writes) console.log(`  ${w.co.padEnd(34).slice(0, 34)} ${w.email.padEnd(38)} [${w.why}]  alts: ${w.alts.join(", ")}`);
  console.log(`\n── Skipped ${skipped.length} ──`);
  for (const s of skipped) console.log(`  ${s.co.padEnd(34).slice(0, 34)} ${s.why}`);

  if (!APPLY) { console.log(`\nDRY RUN — nothing written. Re-run with --apply.\n`); }
  else {
    for (const w of writes) {
      const cur = await prisma.lead.findUnique({ where: { id: w.id }, select: { commentary: true } });
      await prisma.lead.update({ where: { id: w.id }, data: {
        contactEmail: w.email,
        emailGuessed: true,
        emailAlternates: JSON.stringify(w.alts),
        commentary: `${cur?.commentary || ""}\n[Email 8/2] UNVERIFIED guess ${w.email} (${w.why}). On bounce the agent tries: ${w.alts.join(", ")}.`.trim().slice(0, 8000),
      } });
    }
    console.log(`\nApplied ${writes.length} guessed addresses (flagged unverified, with fallbacks).\n`);
  }
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
