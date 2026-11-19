// Pre-Press & Proofs (remade 11/17/26, Benjy: "a complete mess"). One board,
// columns by whose turn it is. Proofs go to the customer from Godzilla with
// Approve / Request changes buttons, and the answer moves the job by itself.
import { randomBytes } from "crypto";
import { AR_FROM } from "@/lib/ar";
import { JOBS_LIVE_SINCE } from "@/lib/press-gate";

export const BASE_URL = process.env.NEXTAUTH_URL || "https://packaging.cndprinting.com";
export const PROOF_SLA_HOURS = 24;
// Jobs in these statuses belong on the board; anything later has left pre-press.
export const PREPRESS_STATUSES = ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL", "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED"];
export const PROOF_ACT_ROLES = ["CSR", "OWNER", "GM", "ADMIN", "PREPRESS_MANAGER", "DIGITAL_PRESS", "SALES_REP", "SALES_MANAGER"];
export const PROOF_MAKE_ROLES = ["PREPRESS_MANAGER", "DIGITAL_PRESS", "OWNER", "GM", "ADMIN", "CSR"];

export type Stage = "art" | "make" | "send" | "customer" | "okay";
export const STAGES: { key: Stage; label: string; who: string; help: string }[] = [
  { key: "art", label: "Waiting on art", who: "CSR", help: "Customer is sending artwork. Mark it in when it arrives." },
  { key: "make", label: "Make proof", who: "Pre-press", help: "Art is in hand. 24-hour proof target. Customer changes land here too." },
  { key: "send", label: "Send to customer", who: "CSR", help: "Proof is ready. Send it for approval." },
  { key: "customer", label: "With customer", who: "Customer", help: "Waiting on the customer to approve or ask for changes." },
  { key: "okay", label: "Okay to print", who: "Plant", help: "Approved. Schedules once the deposit is in." },
];

export const newApprovalToken = () => randomBytes(18).toString("base64url");
export const proofLink = (token: string) => `${BASE_URL}/proof/${token}`;
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Which column a job sits in, from its art status and latest proof. */
export function stageFor(job: any, latest: any | null): Stage {
  if (latest?.status === "APPROVED") return "okay";
  if (latest && (latest.status === "REJECTED" || latest.status === "REVISION_REQUESTED")) return "make";
  if (latest && latest.sentToCustomerAt) return "customer";
  if (latest) return "send";
  if (job.artworkStatus === "coming" && !job.artInAt) return "art";
  return "make";
}

export async function board(prisma: any, opts: { includeTest?: boolean } = {}) {
  const jobs = await prisma.job.findMany({
    where: { status: { in: PREPRESS_STATUSES as any }, ...(opts.includeTest ? {} : { createdAt: { gte: JOBS_LIVE_SINCE } }) },
    include: { order: { include: { company: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 3 } } } } }, csr: { select: { id: true, name: true } }, salesRep: { select: { id: true, name: true } }, proofs: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  return jobs.map((j: any) => {
    const latest = j.proofs[0] || null;
    const stage = stageFor(j, latest);
    // Clock per stage: proof SLA from art-in (or entry); otherwise time in the stage.
    const since = stage === "make" ? (latest?.customerRejectedAt || j.artInAt || j.createdAt)
      : stage === "send" ? latest?.createdAt : stage === "customer" ? (latest?.remindedAt || latest?.sentToCustomerAt) : stage === "okay" ? latest?.customerApprovedAt : j.createdAt;
    const hours = since ? (now - new Date(since).getTime()) / 3600e3 : 0;
    const contactEmail = latest?.sentTo || j.order?.company?.contacts?.find((c: any) => c.email)?.email || null;
    return {
      id: j.id, jobNumber: j.jobNumber, name: j.name, status: j.status, quantity: j.quantity, dueDate: j.dueDate, priority: j.priority,
      customer: j.order?.company?.name || "", companyId: j.order?.companyId || null, contactEmail, contactName: j.contactName || j.order?.company?.contacts?.[0]?.name || null,
      csr: j.csr?.name || null, salesRep: j.salesRep?.name || j.repName || null, artworkStatus: j.artworkStatus || null, jobType: j.jobType || null,
      stage, hours: Math.round(hours * 10) / 10, slaLate: stage === "make" && hours > PROOF_SLA_HOURS, test: new Date(j.createdAt) < JOBS_LIVE_SINCE,
      proof: latest ? { id: latest.id, version: latest.version, fileUrl: latest.fileUrl, fileName: latest.fileName, status: latest.status, sentTo: latest.sentTo, sentAt: latest.sentToCustomerAt, comment: latest.customerComment, respondedBy: latest.respondedByName, respondedVia: latest.respondedVia, notes: latest.notes } : null,
    };
  });
}

export function proofEmailHtml(o: { firstName?: string | null; customer: string; jobNumber: string; jobName: string; version: number; fileUrl: string | null; link: string; note?: string; senderName: string; reminder?: boolean }) {
  const btn = (href: string, label: string, bg: string) => `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px;">${label}</a>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:620px;">
<p>Hi${o.firstName ? ` ${esc(o.firstName)}` : ""},</p>
<p>${o.reminder ? "Just a reminder: your proof is still waiting on your approval." : "Your proof is ready for review."} We can't go to press until it's approved, so please look it over carefully: spelling, colors, dimensions and anything else that matters to you.</p>
${o.note ? `<p>${esc(o.note).replace(/\n/g, "<br>")}</p>` : ""}
<table style="border-collapse:collapse;margin:12px 0;">
<tr><td style="padding:4px 16px 4px 0;color:#666;">Job</td><td>${esc(o.jobNumber)}, ${esc(o.jobName)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#666;">Proof</td><td>Version ${o.version}${o.fileUrl ? `, <a href="${o.fileUrl}">open the proof</a>` : ""}</td></tr>
</table>
<p style="margin:20px 0;">${btn(`${o.link}?d=approve`, "Approve proof", "#15803d")}${btn(`${o.link}?d=changes`, "Request changes", "#b45309")}</p>
<p style="color:#666;font-size:12px;">Or reply to this email with any questions.</p>
<p>Thanks,<br>${esc(o.senderName)}<br>C&amp;D Printing &amp; Packaging<br>(727) 572-9999</p>
</div>`;
}

/** Everything that happens when a proof is approved, by the customer's click or recorded by staff. */
export async function onProofApproved(prisma: any, proofId: string, by: { name: string; via: string; comment?: string | null; fromEmail?: string | null }) {
  const proof = await prisma.proof.update({ where: { id: proofId }, data: { status: "APPROVED", customerApprovedAt: new Date(), respondedByName: by.name, respondedVia: by.via, customerComment: by.comment || null }, include: { job: { include: { order: { include: { company: true } }, csr: { select: { email: true } }, salesRep: { select: { email: true } } } } } });
  const job = proof.job;
  if (["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "PREPRESS"].includes(job.status)) await prisma.job.update({ where: { id: job.id }, data: { status: "CUSTOMER_APPROVAL" } });
  await prisma.activityLog.create({ data: { orderId: job.orderId, action: "PROOF_APPROVED", details: `${job.jobNumber} proof v${proof.version} approved by ${by.name} (${by.via})` } }).catch(() => {});
  if (!proof.productionAlertSentAt && !/^QA-/i.test(job.jobNumber || "")) { // test jobs never email the plant
    try {
      const { sendEmail } = await import("@/lib/email/graph-client");
      const plant = await prisma.user.findMany({ where: { isActive: true, role: { in: ["PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "PREPRESS_MANAGER"] } }, select: { email: true } });
      const to = [...new Set([...plant.map((u: any) => u.email), job.csr?.email, job.salesRep?.email].filter(Boolean))] as string[];
      if (to.length) await sendEmail({ from: by.fromEmail?.endsWith("@cndprinting.com") ? by.fromEmail : AR_FROM, to, subject: `Proof approved: ${job.jobNumber} (${job.order?.company?.name || ""})`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p><b>${esc(job.order?.company?.name)}</b> approved proof v${proof.version} for job ${esc(job.jobNumber)}, ${esc(job.name)}.</p><p>Approved by ${esc(by.name)} (${esc(by.via)})${by.comment ? `: "${esc(by.comment)}"` : ""}.</p><p>It schedules once the deposit is in. <a href="${BASE_URL}/dashboard/jobs/${job.id}">Open the job</a></p></div>` });
      await prisma.proof.update({ where: { id: proofId }, data: { productionAlertSentAt: new Date() } });
    } catch (e) { console.error("proof approved alert failed", e); }
  }
  try { const { notifyIfCleared } = await import("@/lib/press-gate"); await notifyIfCleared(prisma, job.id); } catch (e) { console.error("cleared notice failed", e); }
  return proof;
}

/** Customer asked for changes: back to pre-press with their notes. */
export async function onProofChanges(prisma: any, proofId: string, by: { name: string; via: string; comment: string; fromEmail?: string | null }) {
  const proof = await prisma.proof.update({ where: { id: proofId }, data: { status: "REVISION_REQUESTED", customerRejectedAt: new Date(), respondedByName: by.name, respondedVia: by.via, customerComment: by.comment }, include: { job: { include: { order: { include: { company: true } }, csr: { select: { email: true } }, salesRep: { select: { email: true } } } } } });
  const job = proof.job;
  if (job.status === "CUSTOMER_APPROVAL") await prisma.job.update({ where: { id: job.id }, data: { status: "PROOFING" } });
  await prisma.activityLog.create({ data: { orderId: job.orderId, action: "PROOF_CHANGES", details: `${job.jobNumber} proof v${proof.version}: changes requested by ${by.name} (${by.via}): ${by.comment}`.slice(0, 1000) } }).catch(() => {});
  if (!/^QA-/i.test(job.jobNumber || "")) try { // test jobs never email pre-press
    const { sendEmail } = await import("@/lib/email/graph-client");
    const pre = await prisma.user.findMany({ where: { isActive: true, role: "PREPRESS_MANAGER" }, select: { email: true } });
    const to = [...new Set([...pre.map((u: any) => u.email), job.csr?.email, job.salesRep?.email].filter(Boolean))] as string[];
    if (to.length) await sendEmail({ from: by.fromEmail?.endsWith("@cndprinting.com") ? by.fromEmail : AR_FROM, to, subject: `Proof changes requested: ${job.jobNumber} (${job.order?.company?.name || ""})`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p><b>${esc(job.order?.company?.name)}</b> asked for changes to proof v${proof.version} on job ${esc(job.jobNumber)}, ${esc(job.name)}:</p><blockquote style="border-left:3px solid #b45309;margin:0;padding:4px 12px;">${esc(by.comment).replace(/\n/g, "<br>")}</blockquote><p>From ${esc(by.name)} (${esc(by.via)}). It's back in Make proof. <a href="${BASE_URL}/dashboard/prepress">Open Pre-Press & Proofs</a></p></div>` });
  } catch (e) { console.error("proof changes alert failed", e); }
  return proof;
}
