// Merge duplicate leads and delete placeholder rows (Benjy 8/2).
// Merge rule: keep the record with the most history (longest notes / furthest
// pipeline stage), fold anything the loser knows that the keeper doesn't, then
// delete the loser. Nothing is discarded silently — every merge appends a note.
//   npx tsx scripts/cleanup-duplicates.ts            → dry run
//   npx tsx scripts/cleanup-duplicates.ts --apply    → writes
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// keeper id ← loser ids
const MERGES: { keep: string; drop: string[]; label: string }[] = [
  { keep: "ld2ad06b75b1d7ea6b6aee83ab", drop: ["ld0fc34022daae937fab3f9a0e"], label: "Cafe Vico" },
  { keep: "ld0ae296c094ae3532ea028e97", drop: ["ld05a6c7e846eaa02c7f6e8e72"], label: "Cortez Conservas" },
  // Diamondback: keep the QUALIFIED record with the fullest history, drop the
  // two LOST copies of the same conversation.
  { keep: "cmrazodzp000004jx30eitclt", drop: ["cmrb0gixg000004l1ks9t7t5y", "cmrb0hn17000104l10dyag1lb"], label: "Diamondback America" },
  // "Lola" is the same person/company as "Lola The boys" (Angeli Angelios).
  { keep: "cms67ub5n000004joc8iuu693", drop: ["cmrw6dejz000004jsi33qaj28"], label: "Lola and The Boys" },
];

// Placeholder / junk rows — no company, no contact, nothing to work.
const DELETE: { id: string; label: string }[] = [
  { id: "lde33050692e35420dda7603ff", label: "Prospect (placeholder)" },
  { id: "ld8819b3f2e7d49ac01e664d2a", label: "Prospect (placeholder)" },
  { id: "ld9629c3d515326bd48801d313", label: "Company (literal template row: 'Contact Name'/'Contact Email')" },
];

const FIELDS = ["website", "city", "state", "contactName", "contactTitle", "contactEmail",
  "contactPhone", "endMarket", "productCategory", "volume", "numbers"] as const;

(async () => {
  console.log(`\n── Merges (${MERGES.length}) ──`);
  for (const m of MERGES) {
    const keep: any = await prisma.lead.findUnique({ where: { id: m.keep } });
    if (!keep) { console.log(`  keeper missing for ${m.label}`); continue; }
    const losers: any[] = [];
    for (const d of m.drop) {
      const l = await prisma.lead.findUnique({ where: { id: d } });
      if (l) losers.push(l);
    }
    if (!losers.length) { console.log(`  ${m.label}: nothing to merge`); continue; }

    const fill: Record<string, any> = {};
    const gained: string[] = [];
    for (const f of FIELDS) {
      if (keep[f]) continue;
      const donor = losers.find((l) => l[f]);
      if (donor) { fill[f] = donor[f]; gained.push(`${f}="${String(donor[f]).slice(0, 40)}"`); }
    }
    const carried = losers
      .map((l) => (l.commentary || "").trim())
      .filter((c) => c && !(keep.commentary || "").includes(c.slice(0, 60)))
      .join("\n");
    const note = `[Merged 8/2] Absorbed ${losers.length} duplicate record(s).${gained.length ? " Gained: " + gained.join(", ") + "." : ""}`;

    console.log(`  ${m.label}: keep ${m.keep.slice(-6)} ← drop ${m.drop.map((d) => d.slice(-6)).join(", ")}${gained.length ? "  | " + gained.join(", ") : ""}`);
    if (APPLY) {
      await prisma.lead.update({ where: { id: m.keep }, data: {
        ...fill,
        commentary: `${keep.commentary || ""}${carried ? "\n\n--- from duplicate ---\n" + carried : ""}\n${note}`.trim().slice(0, 8000),
      } });
      for (const l of losers) await prisma.lead.delete({ where: { id: l.id } });
    }
  }

  console.log(`\n── Deletes (${DELETE.length}) ──`);
  for (const d of DELETE) {
    const l = await prisma.lead.findUnique({ where: { id: d.id }, select: { companyName: true } });
    console.log(`  ${l ? "delete" : "already gone"}: ${d.label}`);
    if (APPLY && l) await prisma.lead.delete({ where: { id: d.id } });
  }

  const total = await prisma.lead.count();
  console.log(APPLY ? `\nDone. ${total} leads remain.\n` : `\nDRY RUN — nothing written. Re-run with --apply.\n`);
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
