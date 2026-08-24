// Press master restructure per Mary + Darrin 8/24/2026: C&D has exactly TWO
// real presses -- both Komori LSX629 6-color, #0172 LED UV and #0153
// Conventional. Everything else in the E&M seed was a cost center, not a
// machine. Keep SMALL / MILLE / Press 40 active as digital/carrier billing
// conventions (12 of the 45 validated quotes bill digital through them).
// Speeds: Darrin says top speed is 12,000 -- and the 45 validated quotes
// never keyed above 12,500 -- so 12,000 is the standard estimating speed
// (NOT the 15,000/14,000 from Mary's GPT table). Rates + plate costs are the
// validated ones: LED UV $215/hr + $16 plates, Conventional $188.50 + $19.
// Run: npx tsx scripts/restructure-presses.ts   (idempotent)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  const sheet = { minSheetWidth: 12.5, minSheetHeight: 19, maxSheetWidth: 23.25, maxSheetHeight: 23.75 };

  // #1 -> Komori LSX629 LED UV #0172
  const led = await db.press.update({
    where: { pressNumber: 1 },
    data: { name: "Komori LSX629 LED UV (#0172)", costPerHour: 215, ...sheet },
    include: { configurations: true },
  });
  for (const c of led.configurations) {
    if (c.name === "Kom LED") {
      await db.pressConfig.update({ where: { id: c.id }, data: {
        speedUncoated: 12000, speedCoated: 12000, numColors: 6, plateCost: 16, isActive: true } });
    } else {
      await db.pressConfig.update({ where: { id: c.id }, data: { isActive: false } });
    }
  }

  // #2 -> Komori LSX629 Conventional #0153
  const conv = await db.press.update({
    where: { pressNumber: 2 },
    data: { name: "Komori LSX629 Conventional (#0153)", costPerHour: 188.5, ...sheet },
    include: { configurations: true },
  });
  let kept = false;
  for (const c of conv.configurations) {
    if (!kept) {
      await db.pressConfig.update({ where: { id: c.id }, data: {
        name: "6C Conventional", numColors: 6, speedUncoated: 12000, speedCoated: 12000, plateCost: 19, isActive: true } });
      kept = true;
    } else {
      await db.pressConfig.update({ where: { id: c.id }, data: { isActive: false } });
    }
  }

  // Deactivate the E&M cost centers that are not physical machines.
  const gone = await db.press.updateMany({
    where: { pressNumber: { in: [6, 7, 8, 9, 10] } },
    data: { isActive: false },
  });
  console.log("LED UV + Conventional updated; deactivated", gone.count, "cost-center presses");

  const left = await db.press.findMany({ where: { isActive: true }, orderBy: { pressNumber: "asc" },
    include: { configurations: { where: { isActive: true }, select: { name: true, speedUncoated: true, plateCost: true } } } });
  for (const p of left) console.log(`#${p.pressNumber} ${p.name} $${p.costPerHour}/hr`, JSON.stringify(p.configurations));
  await db.$disconnect(); pool.end();
})();
