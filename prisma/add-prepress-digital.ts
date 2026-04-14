// One-off script: add Michael Metroka (Pre-Press Lead) and Randy Schulz
// (Digital Press Manager, moved from Pre-Press). Run with: npx tsx prisma/add-prepress-digital.ts
import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const internal = await prisma.company.findFirst({ where: { slug: "cnd-packaging" } })
    || await prisma.company.findFirst({ where: { name: { contains: "C&D", mode: "insensitive" } } });
  if (!internal) throw new Error("Internal C&D company not found");

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const users = [
    { email: "michael.metroka@cndprinting.com", name: "Michael Metroka", role: Role.PRODUCTION_MANAGER },
    { email: "randy.schulz@cndprinting.com", name: "Randy Schulz", role: Role.PRODUCTION_MANAGER },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: { name: u.name, role: u.role, companyId: internal.id, isActive: true },
      });
      console.log(`Updated: ${u.name} (${u.email})`);
    } else {
      await prisma.user.create({
        data: { email: u.email, name: u.name, passwordHash, role: u.role, companyId: internal.id, isActive: true },
      });
      console.log(`Created: ${u.name} (${u.email})`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
