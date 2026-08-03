// New brush / coatings prospects (Benjy 8/3). Same vertical as the existing
// Corona Brush lead — brush and paint makers buy printed cartons and sleeves.
//   npx tsx scripts/add-brush-leads.ts            → dry run (shows dupes)
//   npx tsx scripts/add-brush-leads.ts --apply    → creates
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const LEADS = [
  { companyName: "Stinger Brush Company", city: "Vero Beach", state: "FL", endMarket: "Professional / performance brushes" },
  { companyName: "Linzer Southeast", city: "Metter", state: "GA", endMarket: "Professional brushes / distribution hub" },
  { companyName: "Brush Design & Manufacturing Inc", city: "Mableton", state: "GA", endMarket: "Custom brush layout & manufacturing" },
  { companyName: "Industrial Brush Corporation", city: "Lakeland", state: "FL", endMarket: "Industrial coating & machinery brushes" },
  { companyName: "Carolina Brush", city: "Gastonia", state: "NC", endMarket: "Industrial & specialty coating brushes" },
  { companyName: "Gordon Brush Mfg. Co.", city: "", state: "MS", endMarket: "Industrial & commercial brush manufacturing (Mississippi production facility)" },
  { companyName: "Associated Paint", city: "Medley", state: "FL", endMarket: "Regional coatings & applicators" },
];

(async () => {
  let created = 0;
  for (const l of LEADS) {
    // Dedupe on a distinctive word, not the full string — "Carolina Brush" vs
    // "Carolina Brush Co." shouldn't create a second record.
    const key = l.companyName.replace(/\b(inc|llc|co|company|mfg|corporation|southeast)\b\.?/gi, "").trim().split(/\s+/)[0];
    const existing = await prisma.lead.findFirst({
      where: { companyName: { contains: key, mode: "insensitive" } },
      select: { companyName: true, pipelineStage: true },
    });
    if (existing) {
      console.log(`  SKIP  ${l.companyName.padEnd(36)} — already in the pipeline as "${existing.companyName}" (${existing.pipelineStage})`);
      continue;
    }
    console.log(`  ADD   ${l.companyName.padEnd(36)} ${[l.city, l.state].filter(Boolean).join(", ")}`);
    if (APPLY) {
      await prisma.lead.create({
        data: {
          companyName: l.companyName,
          city: l.city || null,
          state: l.state,
          endMarket: l.endMarket,
          productCategory: "Folding Carton",
          source: "prospecting",           // cold-sourced → shows the ↑ Cold badge
          leadTypeOverride: "cold",
          pipelineStage: "LEAD",
          ownerName: "Jessica",            // agent pool: queues for outreach
          priority: 3,
          commentary: `Brush / coatings prospect added 8/3/2026.\n${l.endMarket}.\nSame vertical as Corona Brush - these manufacturers buy printed cartons, sleeves and display packaging.`,
        },
      });
      created++;
    }
  }
  console.log(APPLY ? `\nCreated ${created} leads.\n` : `\nDRY RUN — nothing written. Re-run with --apply.\n`);
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
