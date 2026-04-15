// One-off: create / refresh Kelsey Jacobson (CSR) login.
// Resets password to ChangeMe123! on every run so it works for both
// first-time invite and password-refresh cases.
// Run: npx tsx prisma/add-kelsey.ts
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

  const email = "kjacobsen@cndprinting.com";
  const name = "Kelsey Jacobsen";
  const tempPassword = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { name, role: Role.CSR, companyId: internal.id, isActive: true, passwordHash },
    });
    console.log(`Refreshed: ${name} (${email}) — password reset to ${tempPassword}`);
  } else {
    await prisma.user.create({
      data: { email, name, passwordHash, role: Role.CSR, companyId: internal.id, isActive: true },
    });
    console.log(`Created: ${name} (${email}) — temp password ${tempPassword}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
