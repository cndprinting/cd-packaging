// Spot-check helper (Benjy 11/19): role switch, DB lookups, cleanup of QA-SPOT data.
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const p: any = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL })) });
const E = "claude-test@cndprinting.com";
(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  const out = (v: unknown) => console.log("DB " + (typeof v === "string" ? v : JSON.stringify(v)));
  if (cmd === "role") { await p.user.update({ where: { email: E }, data: { role: a, pipelineAccess: b === "pipe" } }); out("ok"); }
  if (cmd === "token") { const x = await p.proof.findUnique({ where: { id: a }, select: { approvalToken: true } }); let t = x?.approvalToken; if (!t) { t = "qa" + Math.random().toString(36).slice(2) + Date.now().toString(36); await p.proof.update({ where: { id: a }, data: { approvalToken: t } }); } out(t); }
  if (cmd === "job") { const j = await p.job.findUnique({ where: { id: a } }); out({ status: j.status, routed: !!j.routedAt, plantNotified: !!j.plantNotifiedAt, cleared: !!j.clearedNotifiedAt, terms: j.paymentTerms }); }
  if (cmd === "inv") { const i = await p.invoice.findUnique({ where: { id: a } }); out({ status: i.status, shipping: i.shipping, total: i.total, payToken: i.payToken }); }
  if (cmd === "ship") { const s = await p.shipment.findUnique({ where: { id: a } }); out({ billing: !!s.billingNotifiedAt, freightBilled: s.freightBilled, partial: s.isPartial }); }
  if (cmd === "lead") { const l = await p.lead.findUnique({ where: { id: a } }); out({ stage: l.pipelineStage, companyId: l.companyId }); }
  if (cmd === "mklead") { const l = await p.lead.create({ data: { companyName: "QA Spot Lead Co", city: "Tampa", state: "FL", pipelineStage: "QUALIFIED", agentHold: true, ownerName: "TBD" } }); out(l.id); }
  if (cmd === "terms") { const c = await p.company.findUnique({ where: { id: a } }); out({ terms: c.paymentTerms }); }
  if (cmd === "clean") {
    const jobs = await p.job.findMany({ where: { jobNumber: { startsWith: "QA-SPOT" } }, select: { id: true, orderId: true } });
    const ids = jobs.map((j: any) => j.id);
    const r: any = {};
    r.shipments = (await p.shipment.deleteMany({ where: { OR: [{ jobId: { in: ids } }, { jobNumber: { startsWith: "QA-SPOT" } }] } })).count;
    r.invoices = (await p.invoice.deleteMany({ where: { jobId: { in: ids } } })).count;
    r.proofs = (await p.proof.deleteMany({ where: { jobId: { in: ids } } })).count;
    await p.scheduleOrder.deleteMany({ where: { jobId: { in: ids } } }); await p.platePick.deleteMany({ where: { jobId: { in: ids } } });
    r.protos = (await p.prototype.deleteMany({ where: { OR: [{ request: { startsWith: "QA spot" } }, { jobId: { in: ids } }] } })).count;
    const leads = await p.lead.findMany({ where: { companyName: { startsWith: "QA Spot" } }, select: { id: true } });
    r.handoffs = (await p.jobHandoff.deleteMany({ where: { OR: [{ jobName: { startsWith: "QA spot" } }, { leadId: { in: leads.map((l: any) => l.id) } }] } })).count;
    r.leads = (await p.lead.deleteMany({ where: { id: { in: leads.map((l: any) => l.id) } } })).count;
    for (const j of jobs) { await p.purchaseFlag.deleteMany({ where: { jobId: j.id } }); await p.activityLog.deleteMany({ where: { orderId: j.orderId } }); await p.job.delete({ where: { id: j.id } }); await p.order.delete({ where: { id: j.orderId } }).catch(() => {}); }
    r.jobs = jobs.length;
    r.companies = (await p.company.deleteMany({ where: { name: { startsWith: "QA Spot" } } })).count;
    r.notices = (await p.notification.deleteMany({ where: { OR: [{ title: { contains: "QA-SPOT" } }, { title: { contains: "QA Spot" } }, { title: { contains: "QA spot" } }] } })).count;
    // Aspen was the test customer: put its terms back the way they were (none).
    await p.company.updateMany({ where: { name: "ASPEN KAY NATURALS" }, data: { paymentTerms: null, paymentTermsBy: null, paymentTermsAt: null } });
    await p.user.update({ where: { email: E }, data: { role: "ESTIMATOR", pipelineAccess: false } });
    out(r);
  }
  await p.$disconnect();
})();
