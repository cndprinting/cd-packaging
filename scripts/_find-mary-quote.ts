import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
(async () => {
  // Anything Mary saved in the last 3 days, any table that could hold it.
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const quotes = await prisma.quote.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, quoteNumber: true, customerName: true, productName: true, totalPrice: true, status: true, createdBy: true, createdAt: true, specs: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\nQuotes since ${since.toISOString().slice(0,10)}: ${quotes.length}`);
  for (const q of quotes) {
    const specs = (q.specs || "").slice(0, 80);
    console.log(`  ${q.quoteNumber}  ${String(q.customerName).slice(0,24).padEnd(24)} ${String(q.productName).slice(0,28).padEnd(28)} $${q.totalPrice}  ${q.status}  ${q.createdAt.toISOString().slice(0,16)}`);
    if (specs) console.log(`      specs: ${specs}`);
  }
  // Classic estimates may live in their own table — check what models exist with "classic"/"estimate"
  const tables: any[] = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%estimate%' OR table_name ILIKE '%classic%')`);
  console.log("\nEstimate-ish tables:", tables.map((t) => t.table_name));
  for (const t of tables) {
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t.table_name}"`);
    console.log(`  ${t.table_name}: ${rows[0].n} rows`);
  }
  await prisma.$disconnect(); await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
