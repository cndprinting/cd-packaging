import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding C&D Packaging database...");

  const passwordHash = await hash("demo123", 12);

  // Create internal company
  const internal = await prisma.company.create({
    data: { name: "C&D Packaging", slug: "cnd-packaging", type: "internal", industry: "Packaging Manufacturing" },
  });

  // Create customer companies
  const companies = await Promise.all([
    prisma.company.create({ data: { name: "Fresh Foods Co.", slug: "fresh-foods", industry: "Food & Beverage", phone: "(561) 555-1001" } }),
    prisma.company.create({ data: { name: "Luxe Cosmetics", slug: "luxe-cosmetics", industry: "Beauty & Personal Care", phone: "(561) 555-1002" } }),
    prisma.company.create({ data: { name: "GreenLeaf Supplements", slug: "greenleaf", industry: "Health & Wellness", phone: "(561) 555-1003" } }),
    prisma.company.create({ data: { name: "TechGear Electronics", slug: "techgear", industry: "Consumer Electronics", phone: "(561) 555-1004" } }),
    prisma.company.create({ data: { name: "Artisan Spirits Distillery", slug: "artisan-spirits", industry: "Beverages / Spirits", phone: "(561) 555-1005" } }),
  ]);
  console.log(`Created ${companies.length + 1} companies`);

  // Create users
  const users = await Promise.all([
    prisma.user.create({ data: { email: "admin@cndpackaging.com", name: "Sarah Johnson", passwordHash, role: Role.ADMIN, companyId: internal.id } }),
    prisma.user.create({ data: { email: "mike@cndpackaging.com", name: "Mike Torres", passwordHash, role: Role.PRODUCTION_MANAGER, companyId: internal.id } }),
    prisma.user.create({ data: { email: "rachel@cndpackaging.com", name: "Rachel Kim", passwordHash, role: Role.CSR, companyId: internal.id } }),
    prisma.user.create({ data: { email: "david@cndpackaging.com", name: "David Chen", passwordHash, role: Role.SALES_REP, companyId: internal.id } }),
    prisma.user.create({ data: { email: "tom@freshfoods.com", name: "Tom Richards", passwordHash, role: Role.CUSTOMER, companyId: companies[0].id } }),
    prisma.user.create({ data: { email: "nina@luxecosmetics.com", name: "Nina Patel", passwordHash, role: Role.CUSTOMER, companyId: companies[1].id } }),
  ]);
  console.log(`Created ${users.length} users`);

  // Create work centers
  await prisma.workCenter.createMany({
    data: [
      { name: "Prepress", code: "PP", type: "prepress", capacity: 15 },
      { name: "Press Room", code: "PR", type: "press", capacity: 8 },
      { name: "Die Cutting", code: "DC", type: "die-cutting", capacity: 10 },
      { name: "Gluing & Folding", code: "GF", type: "gluing", capacity: 12 },
      { name: "Quality Assurance", code: "QA", type: "qa", capacity: 20 },
      { name: "Shipping Dock", code: "SH", type: "shipping", capacity: 25 },
    ],
  });
  console.log("Created work centers");

  // Create materials
  await prisma.material.createMany({
    data: [
      { name: "18pt C1S Paperboard", sku: "PB-18-C1S", category: "substrate", unit: "sheets" },
      { name: "24pt SBS Folding Board", sku: "FB-24-SBS", category: "substrate", unit: "sheets" },
      { name: "E-Flute Corrugated", sku: "CF-E-FLT", category: "substrate", unit: "sheets", reorderPoint: 5000 },
      { name: "Aqueous Coating - Gloss", sku: "CT-AQ-GL", category: "coating", unit: "gallons" },
      { name: "UV Spot Varnish", sku: "CT-UV-SP", category: "coating", unit: "gallons", reorderPoint: 10 },
      { name: "CMYK Process Inks", sku: "INK-CMYK", category: "ink", unit: "lbs" },
    ],
  });
  console.log("Created materials");

  console.log("Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
