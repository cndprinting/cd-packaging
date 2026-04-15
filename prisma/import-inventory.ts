// @ts-nocheck — one-off seed script, xlsx dependency removed in security cleanup
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import xlsx from "xlsx";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseNumber(val: any): number {
  if (!val) return 0;
  const s = String(val).replace(/[$,]/g, "").trim();
  return parseFloat(s) || 0;
}

async function importInventory() {
  console.log("Importing C&D inventory...");

  const wb = xlsx.readFile("C:/Users/benja/OneDrive/Desktop/Waxman Ventures/Companies/C&D Printing/C&D INVENTORY 11_3_25.xlsx");
  const sheet = wb.Sheets["INVENTORY_DO NOT ALTER"];
  const csv = xlsx.utils.sheet_to_csv(sheet);
  const lines = csv.split("\n").filter(l => l.trim());

  // Skip header rows (row 0 is "INVENTORY", row 1 is column headers)
  let imported = 0;
  let skipped = 0;

  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const itemNum = cols[0]?.trim();
    const weight = cols[1]?.trim();
    const coating = cols[2]?.trim(); // C/1/S, C/2/S, Dull, Gloss, etc.
    const type = cols[3]?.trim(); // Cover, Text, Board
    const size = cols[4]?.trim();
    const description = cols[5]?.trim();
    const onHand = parseNumber(cols[6]);
    const pricePerM = parseNumber(cols[7]);
    const caliper = cols[12]?.trim();

    if (!itemNum || !description) { skipped++; continue; }

    const sku = `INV-${itemNum}`;
    const name = `${description}${weight ? ` ${weight}` : ""}`;
    const category = type?.toLowerCase() === "board" ? "board" : type?.toLowerCase() === "cover" ? "cover" : type?.toLowerCase() === "text" ? "text" : "substrate";

    try {
      // Check if material already exists
      const existing = await prisma.material.findUnique({ where: { sku } });
      if (existing) {
        // Update on-hand quantity
        await prisma.material.update({
          where: { sku },
          data: { name, category },
        });
        // Update or create inventory lot
        const lots = await prisma.inventoryLot.findMany({ where: { materialId: existing.id } });
        if (lots.length > 0) {
          await prisma.inventoryLot.update({
            where: { id: lots[0].id },
            data: { quantityOnHand: onHand, cost: pricePerM },
          });
        } else {
          await prisma.inventoryLot.create({
            data: { materialId: existing.id, lotNumber: `LOT-${itemNum}`, quantityOnHand: onHand, cost: pricePerM },
          });
        }
      } else {
        // Create new material
        const material = await prisma.material.create({
          data: {
            name,
            sku,
            category,
            unit: "sheets",
            reorderPoint: Math.max(Math.round(onHand * 0.2), 50), // 20% of on-hand or 50 minimum
          },
        });

        // Create inventory lot with quantity
        if (onHand > 0) {
          await prisma.inventoryLot.create({
            data: {
              materialId: material.id,
              lotNumber: `LOT-${itemNum}`,
              quantityOnHand: onHand,
              cost: pricePerM,
            },
          });
        }
      }
      imported++;
    } catch (e: any) {
      if (e.code === "P2002") skipped++;
      else console.error(`  Error on item ${itemNum}:`, e.message);
    }
  }

  // Now update the materials API to include inventory lot data
  // Get summary
  const totalMaterials = await prisma.material.count();
  const totalLots = await prisma.inventoryLot.count();

  console.log(`\nImported: ${imported} materials`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total materials in DB: ${totalMaterials}`);
  console.log(`Total inventory lots: ${totalLots}`);
  console.log("Inventory import complete!");
  process.exit(0);
}

importInventory().catch((e) => { console.error(e); process.exit(1); });
