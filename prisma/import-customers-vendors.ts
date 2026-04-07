import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { readFileSync } from "fs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h.trim()] = (values[i] || "").trim();
    });
    return record;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function makeSlug(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base ? `${base}-${id}` : `company-${id}`;
}

async function main() {
  console.log("=== CLEARING ALL DEMO DATA ===");

  // Clear in dependency order
  const tables = [
    "activityLog", "comment", "document", "jobStageUpdate", "jobStage",
    "proofApproval", "proof", "materialRequirement", "productionSchedule",
    "shipmentItem", "shipment", "pressRun", "jobLineItem", "purchaseFlag",
    "orderItem", "job", "order", "alert", "timeEntry",
    "inventoryLot", "quote", "contact", "inviteToken",
  ];

  for (const table of tables) {
    try {
      const count = await (prisma as any)[table].deleteMany({});
      if (count.count > 0) console.log(`  Deleted ${count.count} ${table} records`);
    } catch { /* table may not exist */ }
  }

  // Delete non-internal companies (keep C&D Packaging internal company)
  const deletedCompanies = await prisma.company.deleteMany({
    where: { type: { not: "internal" } },
  });
  console.log(`  Deleted ${deletedCompanies.count} demo companies`);

  // Also clear users except admin accounts
  // Keep users — they may have real logins

  console.log("\n=== IMPORTING CUSTOMERS ===");

  const customerCSV = readFileSync("C:/Users/benja/Downloads/Customer List.csv", "utf-8");
  const customers = parseCSV(customerCSV);
  console.log(`  Parsed ${customers.length} customer records`);

  let customerCount = 0;
  let skipCount = 0;
  const seenSlugs = new Set<string>();

  for (const row of customers) {
    const name = row["Company"]?.trim();
    if (!name || name === "C&D Printing Company") continue;

    const custNum = row["Customer #"]?.trim() || "";
    const slug = makeSlug(name, custNum);

    // Skip exact duplicate slugs
    if (seenSlugs.has(slug)) { skipCount++; continue; }
    seenSlugs.add(slug);

    try {
      await prisma.company.create({
        data: {
          name,
          slug,
          type: "customer",
          address: row["Address"] || null,
          city: row["City"] || null,
          state: row["State"] || null,
          zip: row["Zip"] || null,
          phone: row["Ph#"] || null,
        },
      });

      // Create contact if there is one
      const contactName = row["Contact"]?.trim();
      const email = row["Email"]?.trim();
      if (contactName && contactName.length > 1) {
        const company = await prisma.company.findUnique({ where: { slug } });
        if (company) {
          await prisma.contact.create({
            data: {
              companyId: company.id,
              name: contactName,
              email: email || null,
              phone: row["Cell Ph"]?.trim() || row["Ph#"]?.trim() || null,
              title: "Primary Contact",
              isPrimary: true,
            },
          });
        }
      }

      customerCount++;
    } catch (e: any) {
      if (e.code === "P2002") { skipCount++; } // duplicate slug
      else console.error(`  Error importing "${name}":`, e.message);
    }
  }
  console.log(`  Imported ${customerCount} customers (${skipCount} skipped/duplicates)`);

  console.log("\n=== IMPORTING VENDORS ===");

  const vendorCSV = readFileSync("C:/Users/benja/Downloads/Vendor List.csv", "utf-8");
  const vendors = parseCSV(vendorCSV);
  console.log(`  Parsed ${vendors.length} vendor records`);

  let vendorCount = 0;
  let vendorSkip = 0;

  for (const row of vendors) {
    const name = row["Company"]?.trim();
    if (!name) continue;

    const vendNum = row["Vendor#"]?.trim() || "";
    const slug = makeSlug(name, `v${vendNum}`);

    if (seenSlugs.has(slug)) { vendorSkip++; continue; }
    seenSlugs.add(slug);

    try {
      await prisma.company.create({
        data: {
          name,
          slug,
          type: "vendor",
          address: row["Address"] || null,
          city: row["City"] || null,
          state: row["State"] || null,
          zip: row["Zip"] || null,
          phone: row["Ph#"] || null,
        },
      });

      const contactName = row["Contact"]?.trim();
      const email = row["Email"]?.trim();
      if (contactName && contactName.length > 1) {
        const company = await prisma.company.findUnique({ where: { slug } });
        if (company) {
          await prisma.contact.create({
            data: {
              companyId: company.id,
              name: contactName,
              email: email || null,
              phone: row["Ph#"]?.trim() || null,
              title: "Vendor Contact",
              isPrimary: true,
            },
          });
        }
      }

      vendorCount++;
    } catch (e: any) {
      if (e.code === "P2002") { vendorSkip++; }
      else console.error(`  Error importing "${name}":`, e.message);
    }
  }
  console.log(`  Imported ${vendorCount} vendors (${vendorSkip} skipped/duplicates)`);

  console.log("\n=== DONE ===");
  console.log(`Total: ${customerCount} customers + ${vendorCount} vendors imported`);
  console.log("All demo data cleared. Fresh database ready for production.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Import error:", e);
    process.exit(1);
  });
