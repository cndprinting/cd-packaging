// Quotes were created with a free-text customerName and no companyId, so
// nothing keyed to the customer account — artwork on file included — could
// follow a quote (Benjy 8/5). Match the historical ones back to a Company.
//   npx tsx scripts/backfill-quote-company.ts --apply
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Only exact (case/whitespace-insensitive) name matches. A fuzzy match here
// would silently hand one customer's artwork to another — not worth it.
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");

(async () => {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const byName = new Map(companies.map((c) => [norm(c.name), c.id]));

  const quotes = await prisma.quote.findMany({ where: { companyId: null }, select: { id: true, quoteNumber: true, customerName: true } });
  let matched = 0;
  const misses = new Map<string, number>();
  for (const q of quotes) {
    const id = byName.get(norm(q.customerName || ""));
    if (!id) { misses.set(q.customerName, (misses.get(q.customerName) || 0) + 1); continue; }
    matched++;
    if (APPLY) await prisma.quote.update({ where: { id: q.id }, data: { companyId: id } });
  }

  console.log(`\n${quotes.length} quotes with no company link`);
  console.log(`  matched to a customer: ${matched}`);
  console.log(`  no match:              ${quotes.length - matched}`);
  if (misses.size) {
    console.log("\nUnmatched customer names (these have no Company record):");
    [...misses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
      .forEach(([n, c]) => console.log(`  ${String(c).padStart(3)}x  ${n}`));
  }
  console.log(APPLY ? "\nApplied.\n" : "\nDRY RUN — re-run with --apply.\n");
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
