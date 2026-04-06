import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Creating complete sample job for GM demo...\n");

  // 1. Customer
  const company = await prisma.company.create({
    data: {
      name: "Sunshine Bakery", slug: "sunshine-bakery", type: "customer",
      industry: "Food & Beverage", phone: "(561) 555-8800",
      address: "1200 Palm Beach Blvd", city: "West Palm Beach", state: "FL", zip: "33401",
    },
  });
  console.log("✓ Customer: Sunshine Bakery");

  // 2. Contact
  await prisma.contact.create({
    data: { companyId: company.id, name: "Maria Santos", email: "maria@sunshinebakery.com", phone: "(561) 555-8801", title: "Owner", isPrimary: true },
  });
  console.log("✓ Contact: Maria Santos (Owner)");

  // 3. Order
  const order = await prisma.order.create({
    data: {
      orderNumber: "ORD-30001", poNumber: "PO-SB-2026-001", companyId: company.id,
      status: "PRINTING", priority: "HIGH",
      dueDate: new Date("2026-04-18"), requestedShipDate: new Date("2026-04-16"),
      notes: "Rush order — bakery grand opening April 19th",
    },
  });
  console.log("✓ Order: ORD-30001");

  // 4. Job with full ticket
  const job = await prisma.job.create({
    data: {
      jobNumber: "PKG-2026-100", orderId: order.id,
      name: "Cookie Box — Dozen Size",
      description: "Full color printed folding carton with window die-cut, matte lamination outside, food-safe coating inside. 4-color process + 1 PMS (Sunshine Yellow). Window patch: clear acetate.",
      status: "PRINTING", priority: "HIGH", quantity: 15000,
      dueDate: new Date("2026-04-18"), requestedShipDate: new Date("2026-04-16"),
      plantLocation: "Plant A - Main",
      productType: "FOLDING_CARTON", jobType: "NEW_ORDER",
      customerPO: "PO-SB-2026-001", estimateNumber: "QT-2026-100",
      repName: "David Chen", contactName: "Maria Santos",
      stockDescription: "18pt C1S SBS Paperboard", fscCertified: false,
      blanketNumber: "BL-442", dieNumber: "DIE-1087",
      flatSizeWidth: 14.5, flatSizeHeight: 11.0,
      finishedWidth: 7.0, finishedHeight: 5.5,
      inkFront: "4/1 CMYK + PMS 116", inkBack: "1/0 Food-Safe",
      varnish: "Matte Lamination", coating: "Die Cut + Window Patch + Glue",
      pressAssignment: "Offset Press #2", pressFormat: "28x40",
      imposition: "4-Up Work & Turn", numberUp: 4, runningSize: "28x40",
      ledInk: false, pressCheck: true,
      binderyScore: true, binderyFold: true, binderyGlue: true,
      binderyNotes: "Window patch application after folding. Glue tabs per die layout.",
      deliveryQty: 15000, deliveryPackaging: "Shrink-wrapped on skids, 250/carton",
      deliveryTo: "Sunshine Bakery — 1200 Palm Beach Blvd, WPB FL 33401",
      samplesRequired: true, samplesTo: "Darrin Blackburn",
      estimatedHours: 14.0,
    },
  });
  console.log("✓ Job: PKG-2026-100 — Cookie Box (Dozen)");

  // 5. Purchase flags
  const purchases = [
    { category: "paper", description: "18pt C1S SBS Paperboard — 16,500 sheets (15K + 10% overs)", vendor: "Clearwater Paper", estimatedCost: 1850, status: "ordered" },
    { category: "ink", description: "PMS 116 Sunshine Yellow spot ink — 5 lbs", vendor: "Sun Chemical", estimatedCost: 285, status: "received" },
    { category: "cutting_die", description: "Cookie box die with window cutout — DIE-1087", vendor: "National Die Co.", estimatedCost: 1200, status: "ordered" },
    { category: "outside_service", description: "Window patch application — clear acetate", vendor: "Patch Pro LLC", estimatedCost: 450, status: "needed" },
  ];
  for (const p of purchases) {
    await prisma.purchaseFlag.create({ data: { jobId: job.id, ...p } });
  }
  console.log("✓ 4 outside purchases flagged");

  // 6. Materials + Inventory
  const materials = [
    { name: "18pt C1S SBS Paperboard", sku: "PB-18-C1S", category: "substrate", unit: "sheets", reorderPoint: 10000, onHand: 50000, allocated: 16500 },
    { name: "PMS 116 Yellow Ink", sku: "INK-PMS116", category: "ink", unit: "lbs", reorderPoint: 3, onHand: 12, allocated: 5 },
    { name: "Matte Lamination Film", sku: "LAM-MATTE-01", category: "coating", unit: "feet", reorderPoint: 1000, onHand: 5000, allocated: 2000 },
    { name: "Clear Acetate Window Patch", sku: "WIN-CLR-01", category: "substrate", unit: "sheets", reorderPoint: 2000, onHand: 8000, allocated: 3000 },
    { name: "CMYK Process Inks (Set)", sku: "INK-CMYK-SET", category: "ink", unit: "lbs", reorderPoint: 30, onHand: 200, allocated: 50 },
    { name: "Hot Melt Adhesive", sku: "ADH-HM-01", category: "adhesive", unit: "lbs", reorderPoint: 25, onHand: 150, allocated: 20 },
  ];
  for (const m of materials) {
    const { onHand, allocated, ...matData } = m;
    const mat = await prisma.material.upsert({
      where: { sku: matData.sku! },
      create: matData,
      update: { name: matData.name },
    });
    await prisma.inventoryLot.create({
      data: { materialId: mat.id, lotNumber: `LOT-${matData.sku}`, quantityOnHand: onHand, quantityAllocated: allocated },
    });
  }
  console.log("✓ 6 materials + inventory lots");

  // 7. Production schedule
  const wc = await prisma.workCenter.findFirst({ where: { code: "OP" } });
  if (wc) {
    await prisma.productionSchedule.create({
      data: { jobId: job.id, workCenterId: wc.id, scheduledDate: new Date("2026-04-12"), estimatedHours: 8.0, status: "running", notes: "Currently on press — Offset #2, 4-up work & turn" },
    });
    console.log("✓ Scheduled on Offset Press");
  }

  // 8. Activity log
  const admin = await prisma.user.findFirst({ where: { email: "admin@cndpackaging.com" } });
  if (admin) {
    await prisma.activityLog.create({
      data: { orderId: order.id, userId: admin.id, action: "JOB_CREATED", details: "Created PKG-2026-100: Sunshine Bakery Cookie Box — rush for grand opening" },
    });
  }
  console.log("✓ Activity log");

  console.log("\n══════════════════════════════════════════");
  console.log("✅ Complete sample job ready for GM demo!");
  console.log("");
  console.log("  Customer:   Sunshine Bakery");
  console.log("  Contact:    Maria Santos (Owner)");
  console.log("  Order:      ORD-30001 (PO: PO-SB-2026-001)");
  console.log("  Job:        PKG-2026-100 — Cookie Box (Dozen)");
  console.log("  Status:     PRINTING (on Offset Press #2)");
  console.log("  Quantity:   15,000");
  console.log("  Due:        April 18, 2026");
  console.log("  Est Hours:  14h");
  console.log("  Purchases:  4 flags (paper, ink, die, window patch)");
  console.log("  Materials:  6 items with inventory levels");
  console.log("  Schedule:   On press today");
  console.log("");
  console.log("  → View at: packaging.cndprinting.com/dashboard/jobs");
  console.log("  → Print ticket from the job detail page");
  console.log("══════════════════════════════════════════");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
