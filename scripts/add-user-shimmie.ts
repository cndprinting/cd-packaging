// Onboard Shimmie Jacoby — new salesman working alongside Benjy/Nitay/Albert,
// gets Sales Funnel access (Benjy 8/4). Login is Microsoft SSO, so the password
// hash is deliberately unusable (same pattern as the other SSO-only accounts).
//   npx tsx scripts/add-user-shimmie.ts --apply
import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const EMAIL = "sjacoby@cndprinting.com";

(async () => {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`Exists: ${existing.name} (${existing.role}) pipelineAccess=${existing.pipelineAccess} active=${existing.isActive}`);
    if (APPLY && (!existing.pipelineAccess || !existing.isActive)) {
      await prisma.user.update({ where: { id: existing.id }, data: { pipelineAccess: true, isActive: true } });
      console.log("Updated -> pipelineAccess true, active.");
    }
  } else {
    console.log(`Create: Shimmie Jacoby <${EMAIL}> role=SALES_REP pipelineAccess=true`);
    if (APPLY) {
      const u = await prisma.user.create({
        data: {
          email: EMAIL,
          name: "Shimmie Jacoby",
          // No password login — SSO only. Random bytes so no hash can match.
          passwordHash: crypto.randomBytes(48).toString("hex"),
          role: "SALES_REP",
          pipelineAccess: true,
          isActive: true,
        },
      });
      console.log(`Created ${u.id}`);
    }
  }
  console.log(APPLY ? "\nApplied.\n" : "\nDRY RUN — re-run with --apply.\n");
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
