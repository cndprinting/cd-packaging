// Legacy state cleanup (Benjy 8/2). Older leads hold free-text states
// ("Florida", "fl ", "Fla.", "N.Y."). The pipeline's State field is now a
// 2-letter select, so those render blank and never match the region filters.
//
//   npx tsx scripts/normalize-states.ts           → dry run (default)
//   npx tsx scripts/normalize-states.ts --apply   → writes
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", fla: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto rico": "PR",
};
const VALID = new Set(Object.values(NAMES));

/** "Florida" | "fl " | "Fla." | "N.Y." -> "FL" / "NY"; "" when unrecognizable. */
function normalize(raw: string | null): string {
  const t = (raw || "").trim();
  if (!t) return "";
  const bare = t.replace(/[.\s]/g, "").toUpperCase();
  if (bare.length === 2 && VALID.has(bare)) return bare;
  const key = t.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ").trim();
  return NAMES[key] || "";
}

(async () => {
  const leads = await prisma.lead.findMany({
    where: { NOT: { state: null } },
    select: { id: true, companyName: true, state: true },
  });

  const fixes: { id: string; name: string; from: string; to: string }[] = [];
  const unknown: { name: string; raw: string }[] = [];

  for (const l of leads) {
    const raw = (l.state || "").trim();
    if (!raw) continue;
    const norm = normalize(raw);
    if (!norm) { unknown.push({ name: l.companyName, raw }); continue; }
    if (norm !== raw) fixes.push({ id: l.id, name: l.companyName, from: raw, to: norm });
  }

  console.log(`\nLeads with a state value: ${leads.length}`);
  console.log(`Already clean 2-letter:   ${leads.length - fixes.length - unknown.length}`);
  console.log(`To normalize:             ${fixes.length}`);
  console.log(`Unrecognizable:           ${unknown.length}\n`);

  if (fixes.length) {
    console.log("COMPANY                              FROM            ->  TO");
    console.log("-".repeat(70));
    for (const f of fixes) {
      console.log(`${f.name.padEnd(36).slice(0, 36)} ${f.from.padEnd(15).slice(0, 15)} ->  ${f.to}`);
    }
  }
  if (unknown.length) {
    console.log("\nLeft alone (can't tell what these are):");
    for (const u of unknown) console.log(`  ${u.name} — "${u.raw}"`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to update ${fixes.length} rows.\n`);
  } else {
    for (const f of fixes) await prisma.lead.update({ where: { id: f.id }, data: { state: f.to } });
    console.log(`\nApplied ${fixes.length} state normalizations.\n`);
  }

  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
