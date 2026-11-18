import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { similarRecords } from "../src/lib/lead-company";
const p: any = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL })) });
(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "role") { await p.user.update({ where: { email: "claude-test@cndprinting.com" }, data: { role: a } }); console.log("DB role", a); }
  if (cmd === "co") { const c = await p.company.findUnique({ where: { id: a }, select: { paymentTerms: true, paymentTermsBy: true } }); console.log("DB co", JSON.stringify(c)); }
  if (cmd === "coreset") { await p.company.update({ where: { id: a }, data: { paymentTerms: null, paymentTermsBy: null, paymentTermsAt: null } }); console.log("DB reset"); }
  if (cmd === "inv") { const i = await p.invoice.findMany({ where: { jobId: a }, select: { invoiceNumber: true, status: true } }); console.log("DB inv", JSON.stringify(i)); }
  if (cmd === "sim") { const r = await similarRecords(p, a); console.log("DB sim", JSON.stringify({ l: r.leads.map((x: any) => x.companyName), c: r.companies.map((x: any) => x.name) })); }
  if (cmd === "lead") { const l = await p.lead.findMany({ where: { companyName: { contains: a, mode: "insensitive" } }, select: { companyName: true, companyId: true, pipelineStage: true } }); console.log("DB lead", JSON.stringify(l)); }
  if (cmd === "clean") { const jobs = await p.job.findMany({ where: { jobNumber: { startsWith: "QA-TERMS" } }, select: { id: true, orderId: true } }); for (const j of jobs) { await p.invoice.deleteMany({ where: { jobId: j.id } }); await p.purchaseFlag.deleteMany({ where: { jobId: j.id } }); await p.activityLog.deleteMany({ where: { orderId: j.orderId } }); await p.job.delete({ where: { id: j.id } }); await p.order.delete({ where: { id: j.orderId } }).catch(() => {}); } console.log("DB cleaned", jobs.length); }
  await p.$disconnect();
})();
