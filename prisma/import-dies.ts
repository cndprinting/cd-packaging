import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import xlsx from "xlsx";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function importDies() {
  console.log("Importing cutting die inventory...");

  const wb = xlsx.readFile("C:/Users/benja/OneDrive/Desktop/Waxman Ventures/Companies/C&D Printing/cutting die inventory.xlsx");
  const sheet = wb.Sheets["Cutting Dies"];
  const rows: Record<string, any>[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`  Parsed ${rows.length} rows`);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const dieNumber = String(row["Die Number"] || "").trim();
    if (!dieNumber) { skipped++; continue; }

    try {
      await prisma.cuttingDie.upsert({
        where: { dieNumber },
        update: {
          originalJobNumber: String(row["Original Job Number"] || "").trim() || null,
          customerName: String(row["Customer Name"] || "").trim() || null,
          item: String(row["Item"] || "").trim() || null,
          description: String(row["Description"] || "").trim() || null,
          length: row["Length"] ? parseFloat(row["Length"]) || null : null,
          width: row["Width"] ? parseFloat(row["Width"]) || null : null,
          height: row["Height"] ? parseFloat(row["Height"]) || null : null,
          notes: String(row["Notes"] || "").trim() || null,
        },
        create: {
          dieNumber,
          originalJobNumber: String(row["Original Job Number"] || "").trim() || null,
          customerName: String(row["Customer Name"] || "").trim() || null,
          item: String(row["Item"] || "").trim() || null,
          description: String(row["Description"] || "").trim() || null,
          length: row["Length"] ? parseFloat(row["Length"]) || null : null,
          width: row["Width"] ? parseFloat(row["Width"]) || null : null,
          height: row["Height"] ? parseFloat(row["Height"]) || null : null,
          notes: String(row["Notes"] || "").trim() || null,
        },
      });
      imported++;
    } catch (e: any) {
      if (e.code === "P2002") skipped++;
      else console.error(`  Error on ${dieNumber}:`, e.message);
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}`);
  console.log("Die inventory import complete!");
  process.exit(0);
}

importDies().catch((e) => { console.error(e); process.exit(1); });
