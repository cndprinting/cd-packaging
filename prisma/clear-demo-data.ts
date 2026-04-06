import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing demo data while preserving real users...\n");

  // First, list all users so we can see who we're keeping
  const users = await prisma.user.findMany({ include: { company: true } });
  console.log(`Found ${users.length} users:`);
  users.forEach(u => console.log(`  ✓ KEEPING: ${u.name} (${u.email}) - ${u.role}`));

  // Clear demo data in order (respecting foreign keys)

  // 1. Time entries
  const timeEntries = await prisma.timeEntry.deleteMany({});
  console.log(`\nDeleted ${timeEntries.count} time entries`);

  // 2. Purchase flags
  const purchases = await prisma.purchaseFlag.deleteMany({});
  console.log(`Deleted ${purchases.count} purchase flags`);

  // 3. Proof approvals
  const proofApprovals = await prisma.proofApproval.deleteMany({});
  console.log(`Deleted ${proofApprovals.count} proof approvals`);

  // 4. Proofs
  const proofs = await prisma.proof.deleteMany({});
  console.log(`Deleted ${proofs.count} proofs`);

  // 5. Material requirements
  const matReqs = await prisma.materialRequirement.deleteMany({});
  console.log(`Deleted ${matReqs.count} material requirements`);

  // 6. Inventory lots
  const lots = await prisma.inventoryLot.deleteMany({});
  console.log(`Deleted ${lots.count} inventory lots`);

  // 7. Production schedules
  const schedules = await prisma.productionSchedule.deleteMany({});
  console.log(`Deleted ${schedules.count} production schedules`);

  // 8. Job stage updates
  const stageUpdates = await prisma.jobStageUpdate.deleteMany({});
  console.log(`Deleted ${stageUpdates.count} job stage updates`);

  // 9. Job stages
  const stages = await prisma.jobStage.deleteMany({});
  console.log(`Deleted ${stages.count} job stages`);

  // 10. Shipment items
  const shipItems = await prisma.shipmentItem.deleteMany({});
  console.log(`Deleted ${shipItems.count} shipment items`);

  // 11. Shipments
  const shipments = await prisma.shipment.deleteMany({});
  console.log(`Deleted ${shipments.count} shipments`);

  // 12. Comments
  const comments = await prisma.comment.deleteMany({});
  console.log(`Deleted ${comments.count} comments`);

  // 13. Documents
  const docs = await prisma.document.deleteMany({});
  console.log(`Deleted ${docs.count} documents`);

  // 14. Alerts
  const alerts = await prisma.alert.deleteMany({});
  console.log(`Deleted ${alerts.count} alerts`);

  // 15. Activity logs
  const logs = await prisma.activityLog.deleteMany({});
  console.log(`Deleted ${logs.count} activity logs`);

  // 16. Jobs (this cascades order items via relation)
  const jobs = await prisma.job.deleteMany({});
  console.log(`Deleted ${jobs.count} jobs`);

  // 17. Order items
  const orderItems = await prisma.orderItem.deleteMany({});
  console.log(`Deleted ${orderItems.count} order items`);

  // 18. Orders
  const orders = await prisma.order.deleteMany({});
  console.log(`Deleted ${orders.count} orders`);

  // 19. Quotes
  const quotes = await prisma.quote.deleteMany({});
  console.log(`Deleted ${quotes.count} quotes`);

  // 20. Purchase orders
  const pos = await prisma.purchaseOrder.deleteMany({});
  console.log(`Deleted ${pos.count} purchase orders`);

  // 21. Materials
  const materials = await prisma.material.deleteMany({});
  console.log(`Deleted ${materials.count} materials`);

  // 22. Machines
  const machines = await prisma.machine.deleteMany({});
  console.log(`Deleted ${machines.count} machines`);

  // 23. Work centers
  const workCenters = await prisma.workCenter.deleteMany({});
  console.log(`Deleted ${workCenters.count} work centers`);

  // 24. Contacts
  const contacts = await prisma.contact.deleteMany({});
  console.log(`Deleted ${contacts.count} contacts`);

  // 25. Companies — only delete demo companies (keep companies that real users belong to)
  const userCompanyIds = users.map(u => u.companyId).filter(Boolean) as string[];
  const demoCompanies = await prisma.company.findMany({
    where: { id: { notIn: userCompanyIds } },
  });
  for (const c of demoCompanies) {
    await prisma.company.delete({ where: { id: c.id } }).catch(() => {});
  }
  console.log(`Deleted ${demoCompanies.length} demo companies`);

  // 26. Invite tokens — clear used ones, keep pending
  const usedInvites = await prisma.inviteToken.deleteMany({ where: { usedAt: { not: null } } });
  console.log(`Deleted ${usedInvites.count} used invite tokens`);

  // Summary
  const remainingUsers = await prisma.user.findMany({ include: { company: true } });
  const remainingCompanies = await prisma.company.findMany();
  const pendingInvites = await prisma.inviteToken.findMany({ where: { usedAt: null } });

  console.log("\n════════════════════════════════════════");
  console.log("✅ Demo data cleared! Here's what remains:");
  console.log(`   ${remainingUsers.length} users (your real team)`);
  console.log(`   ${remainingCompanies.length} companies`);
  console.log(`   ${pendingInvites.length} pending invites`);
  console.log("   0 jobs, orders, quotes — ready for real data!");
  console.log("════════════════════════════════════════\n");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
