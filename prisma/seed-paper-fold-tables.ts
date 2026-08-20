// Paper Caliper Master + Fold Types — Mary's two spec emails, 8/20/2026.
// Run: npx tsx prisma/seed-paper-fold-tables.ts   (idempotent upserts)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── 1. Paper Caliper Master, exactly as Mary tabulated it ──
type Cal = [string, string | null, number, string, boolean, string | null, string];
const CALIPERS: Cal[] = [
  // stockName, basisWeight, caliperMil, paperCategory, coated, coating, scoreRequired
  ["50# Uncoated Text", "50#", 3.5, "Text", false, null, "No"],
  ["60# Uncoated Text", "60#", 4.0, "Text", false, null, "No"],
  ["70# Uncoated Text", "70#", 4.5, "Text", false, null, "No"],
  ["80# Uncoated Text", "80#", 5.0, "Text", false, null, "No"],
  ["90# Uncoated Text", "90#", 5.8, "Text", false, null, "No"],
  ["100# Uncoated Text", "100#", 6.5, "Text", false, null, "Conditional"],
  ["110# Uncoated Text", "110#", 7.0, "Text", false, null, "Conditional"],
  ["120# Uncoated Text", "120#", 8.0, "Text", false, null, "Conditional"],
  ["60# Coated Text", "60#", 3.8, "Text", true, "C2S", "No"],
  ["70# Coated Text", "70#", 4.5, "Text", true, "C2S", "No"],
  ["80# Coated Text", "80#", 5.0, "Text", true, "C2S", "No"],
  ["100# Coated Text", "100#", 6.5, "Text", true, "C2S", "Conditional"],
  ["110# Coated Text", "110#", 7.2, "Text", true, "C2S", "Conditional"],
  ["120# Coated Text", "120#", 8.0, "Text", true, "C2S", "Conditional"],
  ["60# Uncoated Cover", "60#", 6.0, "Cover", false, null, "Conditional"],
  ["65# Uncoated Cover", "65#", 6.5, "Cover", false, null, "Conditional"],
  ["80# Uncoated Cover", "80#", 8.0, "Cover", false, null, "Yes"],
  ["90# Uncoated Cover", "90#", 9.0, "Cover", false, null, "Yes"],
  ["100# Uncoated Cover", "100#", 10.0, "Cover", false, null, "Yes"],
  ["110# Uncoated Cover", "110#", 11.0, "Cover", false, null, "Yes"],
  ["120# Uncoated Cover", "120#", 12.0, "Cover", false, null, "Yes"],
];
for (let pt = 8; pt <= 28; pt += 2) {
  CALIPERS.push([`${pt} pt C1S`, null, pt, "Board", true, "C1S", pt >= 12 ? "Yes" : "Conditional"]);
}
const categoryOf = (name: string) =>
  name.includes("C1S") ? "C1S / Coated Cover"
  : name.includes("Uncoated Text") ? "Uncoated Text"
  : name.includes("Coated Text") ? "Coated Text"
  : "Uncoated Cover";

// ── 2. Fold Types — Mary's step 1 (common) then step 2 (specialty) ──
// Her worked example pins the model: Letter fold on the MBO B306/4/4 =
// 15 min setup, 8,000 sheets/hr, 2% waste  ->  25,000 x 1.02 / 8,000 = 3.19
// run hrs, + 0.25 setup = 3.44 total. Everything else uses the Baum-26x40 at
// 6,500/hr (derived from her own quotes) and is flagged for her to confirm.
type Fold = [string, number, string, string, number, number, number, string, boolean];
const FOLDS: Fold[] = [
  // name, numFolds, configuration, machine, setupMin, speed, wastePct, scoring, specialty
  ["Half fold", 1, "1 fold, sheet in half", "Baum-26x40", 15, 6500, 2, "No", false],
  ["Letter fold", 2, "1st Pocket / 2nd Pocket", "MBO B306/4/4", 15, 8000, 2, "No", false],
  ["Tri-fold", 2, "1st Pocket / 2nd Pocket", "Baum-26x40", 15, 6500, 2, "No", false],
  ["Double parallel", 2, "two parallel folds", "Baum-26x40", 20, 6000, 2, "No", false],
  ["Right-angle", 2, "fold then cross-fold", "Baum-26x40", 25, 5500, 3, "No", false],
  ["Open gate", 3, "both edges fold in, no final fold", "Baum-26x40", 30, 4500, 3, "Conditional", true],
  ["Closed gate", 4, "gate then folded closed", "Baum-26x40", 35, 4000, 3, "Conditional", true],
  ["Accordion", 3, "zig-zag, equal panels", "Baum-26x40", 30, 5000, 3, "No", true],
  ["8-page signature", 3, "8pp sig", "Baum-26x40", 25, 5500, 3, "No", true],
  ["12-page signature", 4, "12pp sig", "Baum-26x40", 30, 5000, 3, "No", true],
];

async function main() {
  let n = 0;
  for (const [i, c] of CALIPERS.entries()) {
    const [stockName, basisWeight, caliperMil, paperCategory, coated, coating, scoreRequired] = c;
    await (prisma as any).paperCaliper.upsert({
      where: { stockName },
      update: { caliperMil, paperCategory, coated, coating, scoreRequired, category: categoryOf(stockName), sortOrder: i },
      create: { stockName, basisWeight, caliperMil, paperCategory, coated, coating, scoreRequired, category: categoryOf(stockName), sortOrder: i },
    });
    n++;
  }
  console.log(`paper calipers: ${n}`);

  let f = 0;
  for (const [i, x] of FOLDS.entries()) {
    const [name, numFolds, configuration, machineName, setupMinutes, speedPerHour, wastePct, scoringRequired, isSpecialty] = x;
    const notes = name === "Letter fold"
      ? "Mary's worked example: 25,000 x 1.02 waste / 8,000 = 3.19 run hrs + 0.25 setup = 3.44 total."
      : "Seeded default - confirm setup, speed and waste with Mary.";
    await (prisma as any).foldType.upsert({
      where: { name },
      update: { numFolds, configuration, machineName, setupMinutes, speedPerHour, wasteSheets: wastePct, scoringRequired, isSpecialty, sortOrder: i, specialNotes: notes },
      create: { name, numFolds, configuration, machineName, setupMinutes, speedPerHour, wasteSheets: wastePct, scoringRequired, isSpecialty, sortOrder: i, specialNotes: notes },
    });
    f++;
  }
  console.log(`fold types: ${f}`);
}

main().then(async () => { await prisma.$disconnect(); await pool.end(); })
  .catch(async (e) => { console.error("seed error", e); await prisma.$disconnect(); process.exit(1); });
