// FlexPack reference data — lifted from HP's Indigo Wide Web Job Estimator
// v2.9.7.8 as supplied to C&D. Benjy 8/20: the machine economics in that
// workbook are C&D's ACTUALS (real press cost, real lease, real shift pattern),
// so these seed as authoritative rates, not placeholders.
//
// Source extraction: validation/flexpack/seed-data.json
// Run: npx tsx prisma/seed-flexpack.ts   (idempotent upserts)
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Any = Record<string, any>;
const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "validation", "flexpack", "seed-data.json"), "utf-8")
) as { materials: Any[]; structures: Any[]; formats: Any[]; machines: Any[] };

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s && s !== "None" && s !== "N/A" ? s : null;
};

async function main() {
  // ── Materials ──
  let n = 0;
  for (const [i, m] of DATA.materials.entries()) {
    const name = String(m.name).trim();
    if (!name) continue;
    const data = {
      category: str(m.category), description: str(m.description),
      micron: typeof m.micron === "number" ? m.micron : null,
      yieldIn2PerLb: typeof m.yieldIn2PerLb === "number" ? m.yieldIn2PerLb : null,
      cost: num(m.cost), unitOfMeasure: String(m.unitOfMeasure || "MSI"),
      costPerMsi: num(m.costPerMsi), mil: typeof m.mil === "number" ? m.mil : null,
      sortOrder: i,
    };
    await (prisma as any).flexMaterial.upsert({ where: { name }, update: data, create: { name, ...data } });
    n++;
  }
  console.log(`materials: ${n}`);

  // ── Structures (the film stacks, incl. C&D's own gloss and matte specs) ──
  let s = 0;
  for (const [i, x] of DATA.structures.entries()) {
    const name = String(x.name).trim();
    if (!name) continue;
    const data = {
      primer: str(x.primer) || "DigiPrime 050",
      primerCostMsi: 0.015,
      layers: JSON.stringify(x.layers || []),
      thicknessMil: typeof x.thicknessMil === "number" ? x.thicknessMil : null,
      sortOrder: i,
    };
    await (prisma as any).flexStructure.upsert({ where: { name }, update: data, create: { name, ...data } });
    s++;
  }
  console.log(`structures: ${s}`);

  // ── Machines — C&D's real economics ──
  let mc = 0;
  for (const [i, m] of DATA.machines.entries()) {
    const name = String(m.name).trim();
    if (!name) continue;
    const data = {
      role: String(m.role),
      investment: num(m.investment), leaseRateFactor: 0.01708,
      shiftsPerDay: num(m.shiftsPerDay, 1), hoursPerShift: num(m.hoursPerShift, 8),
      workingDaysMonth: num(m.workingDaysMonth, 22), productivity: num(m.productivity, 0.75),
      operatorRatePerHr: num(m.operatorRatePerHr), overheadPct: 15,
      costPerHourOverride: num(m.costPerHourOverride),
      mrMinutes: num(m.mrMinutes), mrMinutesPerSku: num(m.mrMinutesPerSku),
      mrLinFt: num(m.mrLinFt), mrLinFtPerSku: num(m.mrLinFtPerSku),
      speedFpm: num(m.speedFpm), sortOrder: i,
    };
    await (prisma as any).flexMachine.upsert({ where: { name }, update: data, create: { name, ...data } });
    mc++;
  }
  console.log(`machines: ${mc}`);

  // ── Outsourced pouch formats ──
  let f = 0;
  for (const [i, x] of DATA.formats.entries()) {
    const format = String(x.format).trim();
    if (!format) continue;
    const data = {
      style: str(x.style), sizeBand: str(x.sizeBand), zipper: !!x.zipper,
      breaks: JSON.stringify(x.breaks || []), sortOrder: i,
    };
    await (prisma as any).flexPouchFormat.upsert({ where: { format }, update: data, create: { format, ...data } });
    f++;
  }
  console.log(`pouch formats: ${f}`);

  // ── Settings (click rates + outsourcing constants) ──
  await (prisma as any).flexSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  console.log("settings: ok");
}

main().then(async () => { await prisma.$disconnect(); await pool.end(); })
  .catch(async (e) => { console.error("seed error", e); await prisma.$disconnect(); process.exit(1); });
