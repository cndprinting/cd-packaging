import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Standard waste curve used by most C&D presses (flat 5.0% / 0.0% addl)
const flatWasteCurve = JSON.stringify([
  { min: 1, max: 2500, pctFirst: 5.0, pctAddl: 0.0 },
  { min: 2501, max: 5000, pctFirst: 5.0, pctAddl: 0.0 },
  { min: 5001, max: 10000, pctFirst: 5.0, pctAddl: 0.0 },
  { min: 10001, max: 20000, pctFirst: 5.0, pctAddl: 0.0 },
  { min: 20001, max: 40000, pctFirst: 5.0, pctAddl: 0.0 },
  { min: 40001, max: 999999999, pctFirst: 5.0, pctAddl: 0.0 },
]);

// Graduated waste curve (uncoated) — used by 228, Phantom press
const graduatedWasteUncoated = JSON.stringify([
  { min: 1, max: 2500, pctFirst: 6.0, pctAddl: 2.0 },
  { min: 2501, max: 5000, pctFirst: 5.0, pctAddl: 2.0 },
  { min: 5001, max: 10000, pctFirst: 4.0, pctAddl: 1.5 },
  { min: 10001, max: 20000, pctFirst: 3.0, pctAddl: 1.0 },
  { min: 20001, max: 40000, pctFirst: 2.0, pctAddl: 1.0 },
  { min: 40001, max: 999999999, pctFirst: 1.0, pctAddl: 0.5 },
]);

// Graduated waste curve (coated) — slightly higher than uncoated
const graduatedWasteCoated = JSON.stringify([
  { min: 1, max: 2500, pctFirst: 7.0, pctAddl: 2.0 },
  { min: 2501, max: 5000, pctFirst: 6.0, pctAddl: 2.0 },
  { min: 5001, max: 10000, pctFirst: 5.0, pctAddl: 1.5 },
  { min: 10001, max: 20000, pctFirst: 4.0, pctAddl: 1.0 },
  { min: 20001, max: 40000, pctFirst: 3.0, pctAddl: 1.0 },
  { min: 40001, max: 999999999, pctFirst: 2.0, pctAddl: 0.5 },
]);

// High-waste curve — used by 4AQU and MILLE presses
const highWasteUncoated = JSON.stringify([
  { min: 1, max: 2500, pctFirst: 22.0, pctAddl: 3.0 },
  { min: 2501, max: 5000, pctFirst: 7.0, pctAddl: 3.0 },
  { min: 5001, max: 10000, pctFirst: 5.0, pctAddl: 1.5 },
  { min: 10001, max: 20000, pctFirst: 4.0, pctAddl: 1.0 },
  { min: 20001, max: 40000, pctFirst: 1.5, pctAddl: 1.0 },
  { min: 40001, max: 999999999, pctFirst: 1.1, pctAddl: 0.7 },
]);

const highWasteCoated = highWasteUncoated; // Same for these presses

// ─── Press data from C&D Plant Standards ────────────────────────────────────

interface PressData {
  pressNumber: number;
  name: string;
  costPerHour: number;
  helperCostPerHour: number;
  blanketCost: number;
  maxSheetWidth: number;
  maxSheetHeight: number;
  minSheetWidth: number;
  minSheetHeight: number;
  plateChangeMinutes: number;
  inkChangeMinutes: number;
  canPrintSolids: boolean;
  minFormMinutes: number;
  configs: ConfigData[];
}

interface ConfigData {
  configNumber: number;
  name: string;
  setupMinutes: number;
  speedUncoated: number;
  speedCoated: number;
  gripperEighths: number;
  numColors: number;
  coatingType: string | null;
  coatingCostPerLb: number;
  perfectorColorsPerSide: number;
  addToHourlyRate: number;
  numHelpers: number;
  maxImpressions: number;
  plateCost: number;
  plateDevelopMinutes: number;
  strippingMaterialCost: number;
  setupWasteUncoated: number;
  setupWasteCoated: number;
  plateChangeWasteUncoated: number;
  plateChangeWasteCoated: number;
  wasteCurveUncoated: string;
  wasteCurveCoated: string;
}

const presses: PressData[] = [
  {
    pressNumber: 1,
    name: "KOMII",
    costPerHour: 215,
    helperCostPerHour: 0,
    blanketCost: 57.85,
    maxSheetWidth: 26,
    maxSheetHeight: 32,
    minSheetWidth: 11,
    minSheetHeight: 17,
    plateChangeMinutes: 15,
    inkChangeMinutes: 10,
    canPrintSolids: true,
    minFormMinutes: 10,
    configs: [
      {
        configNumber: 1,
        name: "6 Color Sheetfed",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 6,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 350000,
        plateCost: 16.00,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 2,
        name: "5C KOMORI",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 6,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: -30,
        numHelpers: 0,
        maxImpressions: 1000000,
        plateCost: 19.00,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 3,
        name: "Kom LED",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 6,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 150000,
        plateCost: 16.00,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
    ],
  },
  {
    pressNumber: 2,
    name: "KOMOR",
    costPerHour: 180,
    helperCostPerHour: 0,
    blanketCost: 57.85,
    maxSheetWidth: 20,
    maxSheetHeight: 26,
    minSheetWidth: 11,
    minSheetHeight: 16.5,
    plateChangeMinutes: 20,
    inkChangeMinutes: 15,
    canPrintSolids: true,
    minFormMinutes: 15,
    configs: [
      {
        configNumber: 1,
        name: "4 Color Sheetfed",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 4,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 0,
        plateCost: 8.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 2,
        name: "3C KOMORI",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 4,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: -30,
        numHelpers: 0,
        maxImpressions: 0,
        plateCost: 8.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 3,
        name: "2C KOMORI",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 4,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: -60,
        numHelpers: 0,
        maxImpressions: 0,
        plateCost: 8.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 4,
        name: "1 Color",
        setupMinutes: 8,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 4,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: -75,
        numHelpers: 0,
        maxImpressions: 0,
        plateCost: 8.50,
        plateDevelopMinutes: 3,
        strippingMaterialCost: 1.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
    ],
  },
  {
    pressNumber: 3,
    name: "SMALL",
    costPerHour: 33.35,
    helperCostPerHour: 0,
    blanketCost: 24.15,
    maxSheetWidth: 12.5,
    maxSheetHeight: 18.5,
    minSheetWidth: 2,
    minSheetHeight: 4.25,
    plateChangeMinutes: 5,
    inkChangeMinutes: 5,
    canPrintSolids: true,
    minFormMinutes: 5,
    configs: [
      {
        configNumber: 1,
        name: "2 Color Small",
        setupMinutes: 5,
        speedUncoated: 4500,
        speedCoated: 4500,
        gripperEighths: 3,
        numColors: 2,
        coatingType: "Varnish",
        coatingCostPerLb: 6.35,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 125000,
        plateCost: 10.00,
        plateDevelopMinutes: 3,
        strippingMaterialCost: 1.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 2,
        name: "4C Small",
        setupMinutes: 5,
        speedUncoated: 2500,
        speedCoated: 2500,
        gripperEighths: 3,
        numColors: 4,
        coatingType: "Varnish",
        coatingCostPerLb: 6.35,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 25000,
        plateCost: 5.06,
        plateDevelopMinutes: 3,
        strippingMaterialCost: 1.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
    ],
  },
  {
    pressNumber: 6,
    name: "4AQU",
    costPerHour: 120,
    helperCostPerHour: 0,
    blanketCost: 57.85,
    maxSheetWidth: 20,
    maxSheetHeight: 26,
    minSheetWidth: 11,
    minSheetHeight: 17,
    plateChangeMinutes: 20,
    inkChangeMinutes: 30,
    canPrintSolids: true,
    minFormMinutes: 15,
    configs: [
      {
        configNumber: 1,
        name: "4-Color w/Aqueous",
        setupMinutes: 30,
        speedUncoated: 8000,
        speedCoated: 8000,
        gripperEighths: 3,
        numColors: 4,
        coatingType: "Aqueous",
        coatingCostPerLb: 35.00,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 80000,
        plateCost: 8.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 100,
        setupWasteCoated: 100,
        plateChangeWasteUncoated: 50,
        plateChangeWasteCoated: 50,
        wasteCurveUncoated: highWasteUncoated,
        wasteCurveCoated: highWasteCoated,
      },
    ],
  },
  {
    pressNumber: 7,
    name: "6AQU",
    costPerHour: 180,
    helperCostPerHour: 0,
    blanketCost: 57.85,
    maxSheetWidth: 20,
    maxSheetHeight: 28.5,
    minSheetWidth: 11,
    minSheetHeight: 17,
    plateChangeMinutes: 15,
    inkChangeMinutes: 20,
    canPrintSolids: true,
    minFormMinutes: 10,
    configs: [
      {
        configNumber: 1,
        name: "6-Color w/Aqueous",
        setupMinutes: 5,
        speedUncoated: 12500,
        speedCoated: 12500,
        gripperEighths: 3,
        numColors: 6,
        coatingType: "Aqueous",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 350000,
        plateCost: 8.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 2,
        name: "5-Color w/Aqueous",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 6,
        coatingType: "Aqueous",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: -30,
        numHelpers: 0,
        maxImpressions: 350000,
        plateCost: 8.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
    ],
  },
  {
    pressNumber: 8,
    name: "228",
    costPerHour: 60,
    helperCostPerHour: 17.50,
    blanketCost: 57.85,
    maxSheetWidth: 20.5,
    maxSheetHeight: 29,
    minSheetWidth: 9.125,
    minSheetHeight: 12,
    plateChangeMinutes: 20,
    inkChangeMinutes: 15,
    canPrintSolids: true,
    minFormMinutes: 15,
    configs: [
      {
        configNumber: 1,
        name: "2 Color Sheetfed",
        setupMinutes: 5,
        speedUncoated: 8000,
        speedCoated: 8000,
        gripperEighths: 3,
        numColors: 2,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 175000,
        plateCost: 16.00,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: graduatedWasteUncoated,
        wasteCurveCoated: graduatedWasteCoated,
      },
    ],
  },
  {
    pressNumber: 9,
    name: "228P",
    costPerHour: 60,
    helperCostPerHour: 17.50,
    blanketCost: 57.85,
    maxSheetWidth: 20,
    maxSheetHeight: 28.25,
    minSheetWidth: 11.125,
    minSheetHeight: 12,
    plateChangeMinutes: 0,
    inkChangeMinutes: 0,
    canPrintSolids: false,
    minFormMinutes: 0,
    configs: [],
  },
  {
    pressNumber: 10,
    name: "628",
    costPerHour: 180,
    helperCostPerHour: 0,
    blanketCost: 57.85,
    maxSheetWidth: 24,
    maxSheetHeight: 40, // Corrected from 8290 in source (likely data entry error)
    minSheetWidth: 9.125,
    minSheetHeight: 12,
    plateChangeMinutes: 15,
    inkChangeMinutes: 10,
    canPrintSolids: true,
    minFormMinutes: 10,
    configs: [
      {
        configNumber: 1,
        name: "6 Color Sheetfed",
        setupMinutes: 5,
        speedUncoated: 12500,
        speedCoated: 12500,
        gripperEighths: 3,
        numColors: 6,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 5,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 350000,
        plateCost: 11.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 2,
        name: "5 Color Sheetfed",
        setupMinutes: 5,
        speedUncoated: 10000,
        speedCoated: 10000,
        gripperEighths: 3,
        numColors: 5,
        coatingType: "Varnish",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: -30,
        numHelpers: 0,
        maxImpressions: 250000,
        plateCost: 11.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
      {
        configNumber: 3,
        name: "6 Color w/Aqueous",
        setupMinutes: 5,
        speedUncoated: 12500,
        speedCoated: 12500,
        gripperEighths: 3,
        numColors: 7,
        coatingType: "Aqueous",
        coatingCostPerLb: 5.50,
        perfectorColorsPerSide: 0,
        addToHourlyRate: 0,
        numHelpers: 0,
        maxImpressions: 175000,
        plateCost: 11.50,
        plateDevelopMinutes: 5,
        strippingMaterialCost: 2.00,
        setupWasteUncoated: 200,
        setupWasteCoated: 200,
        plateChangeWasteUncoated: 100,
        plateChangeWasteCoated: 100,
        wasteCurveUncoated: flatWasteCurve,
        wasteCurveCoated: flatWasteCurve,
      },
    ],
  },
];

async function seedPlantStandards() {
  console.log("Seeding plant standards...");

  // Upsert the single PlantStandard settings row
  const existing = await prisma.plantStandard.findFirst();
  if (existing) {
    console.log("  PlantStandard row already exists, skipping (use settings UI to update)");
  } else {
    await prisma.plantStandard.create({ data: {} }); // All defaults from schema
    console.log("  Created PlantStandard settings row with C&D defaults");
  }

  // Upsert presses and their configurations
  for (const pressData of presses) {
    const { configs, ...pressFields } = pressData;

    const press = await prisma.press.upsert({
      where: { pressNumber: pressFields.pressNumber },
      update: pressFields,
      create: pressFields,
    });

    console.log(`  Press ${press.pressNumber} ${press.name}: $${press.costPerHour}/hr (${press.maxSheetWidth}x${press.maxSheetHeight})`);

    for (const configData of configs) {
      await prisma.pressConfig.upsert({
        where: {
          pressId_configNumber: {
            pressId: press.id,
            configNumber: configData.configNumber,
          },
        },
        update: { ...configData, pressId: press.id },
        create: { ...configData, pressId: press.id },
      });
      const effectiveRate = pressData.costPerHour + configData.addToHourlyRate;
      console.log(`    Config ${configData.configNumber}: ${configData.name} — ${configData.numColors}C, ${configData.speedUncoated} sph, $${effectiveRate}/hr, plate $${configData.plateCost}`);
    }
  }

  console.log("Plant standards seeded successfully!");
}

// Run directly if called as a script
seedPlantStandards()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  });

export { seedPlantStandards };
