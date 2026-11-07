import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
(async () => { const u = await prisma.user.update({ where: { email: "claude-test@cndprinting.com" }, data: { role: process.argv[2] as any }, select: { role: true } }); console.log("ROLE", u.role); await prisma.$disconnect(); })();
