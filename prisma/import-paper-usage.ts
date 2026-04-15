// @ts-nocheck — one-off seed script, xlsx dependency removed in security cleanup
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import xlsx from "xlsx";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseNum(val: any): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[$,]/g, "").trim()) || 0;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function importPaperUsage() {
  const wb = xlsx.readFile("C:/Users/benja/OneDrive/Desktop/Waxman Ventures/Companies/C&D Printing/C&D INVENTORY 11_3_25.xlsx");

  // Paper OUT
  console.log("Importing Paper Usage (INV Paper OUT FORM)...");
  const outSheet = wb.Sheets["INV Paper OUT FORM"];
  const outCsv = xlsx.utils.sheet_to_csv(outSheet);
  const outLines = outCsv.split("\n").filter(l => l.trim());

  let outCount = 0;
  for (let i = 2; i < outLines.length; i++) {
    const cols = outLines[i].split(",");
    const itemNum = cols[0]?.trim();
    const jobNum = cols[1]?.trim();
    if (!jobNum && !itemNum) continue;

    try {
      await prisma.paperUsage.create({
        data: {
          itemNumber: itemNum || null,
          jobNumber: jobNum || null,
          wipStatus: cols[2]?.trim() || null,
          date: parseDate(cols[3]?.trim()),
          source: cols[4]?.trim() || null,
          direction: cols[5]?.trim() || null,
          quantityIn: Math.round(parseNum(cols[6])),
          quantityOut: Math.round(parseNum(cols[7])),
          weight: cols[8]?.trim() || null,
          coating: cols[9]?.trim() || null,
          stockType: cols[10]?.trim() || null,
          size: cols[11]?.trim() || null,
          description: cols[12]?.trim() || null,
          pricePerM: parseNum(cols[13]),
          totalOut: parseNum(cols[14]),
          totalIn: parseNum(cols[15]),
        },
      });
      outCount++;
    } catch { /* skip errors */ }
  }
  console.log(`  Imported ${outCount} paper usage records`);

  // Vendor Purchases
  console.log("Importing Vendor Purchases...");
  const vpSheet = wb.Sheets["Vendor Purchases"];
  const vpCsv = xlsx.utils.sheet_to_csv(vpSheet);
  const vpLines = vpCsv.split("\n").filter(l => l.trim());

  let vpCount = 0;
  for (let i = 2; i < vpLines.length; i++) {
    const cols = vpLines[i].split(",");
    const jobNum = cols[1]?.trim();
    const vendor = cols[4]?.trim();
    if (!jobNum && !vendor) continue;

    try {
      await prisma.vendorPurchase.create({
        data: {
          itemNumber: cols[0]?.trim() || null,
          jobNumber: jobNum || null,
          wipStatus: cols[2]?.trim() || null,
          date: parseDate(cols[3]?.trim()),
          vendor: vendor || null,
          quantity: Math.round(parseNum(cols[5])),
          weight: cols[6]?.trim() || null,
          size: cols[7]?.trim() || null,
          description: cols[8]?.trim() || null,
          pricePerM: parseNum(cols[9]),
          total: parseNum(cols[10]),
          quotedPricePerM: parseNum(cols[11]),
          quotedTotal: parseNum(cols[12]),
          savings: parseNum(cols[13]),
        },
      });
      vpCount++;
    } catch { /* skip errors */ }
  }
  console.log(`  Imported ${vpCount} vendor purchase records`);
  console.log("Done!");
  process.exit(0);
}

importPaperUsage().catch((e) => { console.error(e); process.exit(1); });
