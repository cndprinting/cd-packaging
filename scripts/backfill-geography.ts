// Backfill Lead.state (and, for FL, nothing more than the state) from the
// contact phone's area code — Benjy 8/2, so the new region filters on the sales
// pipeline actually have data to work with.
//
//   npx tsx scripts/backfill-geography.ts            → DRY RUN, prints a table
//   npx tsx scripts/backfill-geography.ts --apply     → writes the changes
//
// Rules (see src/lib/lead-view.ts for the shared maps):
//   1. Only leads with NO state are touched. city is never overwritten and is
//      never invented — an area code tells you the state, not the city.
//   2. FL area codes also report which FL region the number sits in, purely so
//      the dry-run summary is readable.
//   3. Any other US area code maps to its state via a compact NANP table.
//      Unknown / missing / non-US → left blank.

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { config } from "dotenv";
import { AREA_CODE_STATE, FL_AREA_CODES, areaCodeOf } from "../src/lib/lead-view";

config();

const APPLY = process.argv.includes("--apply");

type Row = { id: string; companyName: string; phone: string | null; areaCode: string | null; state: string; hint: string };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set."); process.exit(1); }
  const prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: url })) });

  const leads = await prisma.lead.findMany({
    select: { id: true, companyName: true, city: true, state: true, contactPhone: true, numbers: true },
    orderBy: { companyName: "asc" },
  });

  const missing = leads.filter((l) => !(l.state || "").trim());
  const changes: Row[] = [];
  const skipped: Row[] = [];

  for (const l of missing) {
    // Prefer the structured phone; fall back to the first number in the
    // free-text "numbers" scratchpad.
    const phone = (l.contactPhone || "").trim() || (l.numbers || "").trim() || null;
    const ac = areaCodeOf(phone);
    const state = ac ? AREA_CODE_STATE[ac] : undefined;
    const hint = ac && FL_AREA_CODES[ac] ? FL_AREA_CODES[ac] : (state ? "Out of state" : "");
    const row: Row = { id: l.id, companyName: l.companyName, phone, areaCode: ac, state: state || "", hint };
    (state ? changes : skipped).push(row);
  }

  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
  console.log(`\nLeads total: ${leads.length}   with a state already: ${leads.length - missing.length}   missing a state: ${missing.length}`);
  console.log(`Resolvable from an area code: ${changes.length}   unresolvable (left blank): ${skipped.length}\n`);

  if (changes.length) {
    console.log(`${pad("COMPANY", 34)} ${pad("PHONE", 18)} ${pad("AC", 4)} ${pad("→ STATE", 8)} REGION HINT`);
    console.log("-".repeat(90));
    for (const c of changes) console.log(`${pad(c.companyName, 34)} ${pad(c.phone || "", 18)} ${pad(c.areaCode || "", 4)} ${pad(c.state, 8)} ${c.hint}`);
  }

  const byState = changes.reduce<Record<string, number>>((a, c) => { a[c.state] = (a[c.state] || 0) + 1; return a; }, {});
  console.log("\nBy state:", Object.entries(byState).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}=${n}`).join("  ") || "(none)");
  const byRegion = changes.filter((c) => c.state === "FL").reduce<Record<string, number>>((a, c) => { a[c.hint] = (a[c.hint] || 0) + 1; return a; }, {});
  console.log("FL by region:", Object.entries(byRegion).map(([s, n]) => `${s}=${n}`).join("  ") || "(none)");

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing was written. Re-run with --apply to write ${changes.length} state values.\n`);
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (const c of changes) {
    await prisma.lead.update({ where: { id: c.id }, data: { state: c.state } });
    done++;
  }
  console.log(`\nAPPLIED — set state on ${done} leads. city was not touched.\n`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
