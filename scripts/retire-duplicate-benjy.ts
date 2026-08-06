// Retire the two placeholder "Benjy Waxman" accounts (Benjy 8/6).
//
// Three users were named "Benjy Waxman" with pipeline access, so Shimmie's
// "@Benjy" resolved to all three: one notification/email each. Only
// bwaxman@cndprinting.com is a real mailbox, so the other two silently went
// nowhere — and the autocomplete showed three identical "Benjy" entries.
//
// Deactivating (not deleting) is deliberate: it is fully reversible, and it
// already removes them everywhere that matters — the SSO callback rejects
// inactive users, and the @mention roster filters on isActive + pipelineAccess.
//   npx tsx scripts/retire-duplicate-benjy.ts --apply
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const KEEP = "bwaxman@cndprinting.com";
const RETIRE = ["admin@cndpackaging.com", "benjy@cndprinting.com"];

(async () => {
  const keeper = await prisma.user.findUnique({ where: { email: KEEP } });
  if (!keeper) throw new Error(`${KEEP} not found — refusing to retire anything.`);
  console.log(`\nKeeping ${keeper.email}: role=${keeper.role} pipelineAccess=${keeper.pipelineAccess} active=${keeper.isActive}`);

  // The real account must be fully privileged BEFORE anything is switched off.
  if (keeper.role !== "OWNER" || !keeper.pipelineAccess || !keeper.isActive) {
    console.log("  -> restoring full owner access on the real account");
    if (APPLY) await prisma.user.update({ where: { id: keeper.id }, data: { role: "OWNER", pipelineAccess: true, isActive: true } });
  } else {
    console.log("  -> already OWNER with full access; nothing to migrate");
  }

  for (const email of RETIRE) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) { console.log(`\n${email}: not found`); continue; }
    // Anything created by or assigned to the placeholder moves to the real
    // account first, so no history is orphaned by the deactivation.
    const moved = {
      leadsOwned: await prisma.lead.updateMany({ where: { ownerId: u.id }, data: { ownerId: keeper.id } }),
      leadsCreated: await prisma.lead.updateMany({ where: { createdBy: u.id }, data: { createdBy: keeper.id } }),
      quotes: await prisma.quote.updateMany({ where: { createdBy: u.id }, data: { createdBy: keeper.id } }),
      notes: await prisma.leadNote.updateMany({ where: { authorId: u.id }, data: { authorId: keeper.id } }),
      attachments: await prisma.attachment.updateMany({ where: { uploadedBy: u.id }, data: { uploadedBy: keeper.id } }),
    };
    console.log(`\n${email}: reassigning ` + Object.entries(moved).map(([k, v]) => `${k}=${(v as any).count}`).join(" "));
    console.log(`  -> deactivate + remove pipeline access (drops it from @mention autocomplete)`);
    if (APPLY) {
      await prisma.user.update({ where: { id: u.id }, data: {
        isActive: false,
        pipelineAccess: false,
        name: "Benjy Waxman (retired duplicate)",
      } });
      // Pings that landed on the dead account would never be read.
      await prisma.notification.deleteMany({ where: { userId: u.id } });
    }
  }

  console.log(APPLY ? "\nApplied.\n" : "\nDRY RUN — re-run with --apply.\n");
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
