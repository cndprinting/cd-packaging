import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Darrin's equipment list (2026-04-07)
const WORK_CENTERS = [
  {
    name: "Prepress",
    code: "PP",
    type: "prepress",
    capacity: 15,
    machines: [],
  },
  {
    name: "Offset Press",
    code: "OP",
    type: "press",
    capacity: 5,
    machines: [
      { name: "Komori 29 0127", code: "KOM-0127" },
      { name: "Komori 29 0153", code: "KOM-0153" },
    ],
  },
  {
    name: "Digital Press",
    code: "DP",
    type: "press",
    capacity: 10,
    machines: [],
  },
  {
    name: "Die Cutting",
    code: "DC",
    type: "die-cutting",
    capacity: 10,
    machines: [
      { name: "Yoco85e", code: "YOCO-85E" },
      { name: "Yoco85t", code: "YOCO-85T" },
      { name: "Heidelberg", code: "HEID-01" },
      { name: "Kluge", code: "KLUGE-01" },
    ],
  },
  {
    name: "Gluing & Folding",
    code: "GF",
    type: "gluing",
    capacity: 12,
    machines: [
      { name: "Omni Fold", code: "OMNI-FOLD" },
      { name: "Vega", code: "VEGA-01" },
    ],
  },
  {
    name: "Bindery",
    code: "BN",
    type: "bindery",
    capacity: 15,
    machines: [
      { name: "Folder", code: "FOLDER-01" },
      { name: "Polar Knife", code: "POLAR-01" },
      { name: "Muller", code: "MULLER-01" },
    ],
  },
  {
    name: "Quality Assurance",
    code: "QA",
    type: "qa",
    capacity: 20,
    machines: [],
  },
  {
    name: "Shipping Dock",
    code: "SH",
    type: "shipping",
    capacity: 25,
    machines: [],
  },
];

async function seedEquipment() {
  console.log("Seeding work centers and equipment...");

  for (const wc of WORK_CENTERS) {
    const { machines, ...wcData } = wc;

    // Upsert work center
    const workCenter = await prisma.workCenter.upsert({
      where: { code: wcData.code },
      update: { name: wcData.name, type: wcData.type, capacity: wcData.capacity },
      create: wcData,
    });
    console.log(`  ${workCenter.name} (${workCenter.code})`);

    // Upsert machines
    for (const machine of machines) {
      await prisma.machine.upsert({
        where: { code: machine.code },
        update: { name: machine.name, workCenterId: workCenter.id },
        create: { ...machine, workCenterId: workCenter.id },
      });
      console.log(`    - ${machine.name} (${machine.code})`);
    }
  }

  // Deactivate the old "Press Room" if it exists and is separate from Offset Press
  const oldPR = await prisma.workCenter.findUnique({ where: { code: "PR" } });
  if (oldPR) {
    await prisma.workCenter.update({ where: { code: "PR" }, data: { isActive: false } });
    console.log("  Deactivated old 'Press Room' (PR) — replaced by Offset Press (OP) + Digital Press (DP)");
  }

  console.log("Equipment seeded successfully!");
}

seedEquipment()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  });

export { seedEquipment };
