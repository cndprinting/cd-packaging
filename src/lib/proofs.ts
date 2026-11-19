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

// Mike Metroka's flow (11/19/26): ticket -> art in -> PREFLIGHT (report to the CSR,
// may loop back for new art) -> PDF proof rounds -> PDF approved -> HARD PROOF
// rounds (ImpoProof mockup / G7 color; the customer approves it if it goes to
// them, CSR + sales if it stays internal) -> hard proof approved -> plates.
// Whether a job gets a hard proof depends on the customer: set per job, with an
// optional default on the customer.
export type Stage = "art" | "preflight" | "make" | "send" | "customer" | "hard" | "okay";
export const STAGES: { key: Stage; label: string; who: string; help: string }[] = [
  { key: "art", label: "Waiting on art", who: "CSR", help: "Customer is sending artwork. Mark it in when it arrives." },
  { key: "preflight", label: "Preflight", who: "Pre-press", help: "Check the files. Problems go to the CSR as a report; new art sends it back." },
  { key: "make", label: "Make PDF proof", who: "Pre-press", help: "Files are good. 24-hour proof target. Customer changes land here too." },
  { key: "send", label: "Send to customer", who: "CSR", help: "Proof is ready. Send it for approval." },
  { key: "customer", label: "With customer", who: "Customer", help: "Waiting on the customer to approve or ask for changes." },
  { key: "hard", label: "Hard proof", who: "Pre-press / CSR", help: "PDF approved. Print and assemble the hard proof; internal ones are signed off here by CSR and sales." },
  { key: "okay", label: "Okay to plate", who: "Plant", help: "Final proof approved. Plates, then press once the deposit is in." },
];
export const HARD_PROOF_LABEL: Record<string, string> = { customer: "Hard proof to customer", internal: "Hard proof, internal check", none: "PDF only" };
export const PREFLIGHT_ISSUES = ["Missing images/graphics", "Resolution issues", "Missing fonts", "Missing bleed we can't fix", "Wrong size/dieline", "Colors (RGB, spot vs process)"];

export const newApprovalToken = () => randomBytes(18).toString("base64url");
export const proofLink = (token: string) => `${BASE_URL}/proof/${token}`;
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Hard proof setting for a job: the job's own, else the customer's default, else undecided. */
export const hardMode = (job: any): string | null => job?.hardProof || job?.order?.company?.hardProofDefault || null;
const isChanges = (p: any) => p && (p.status === "REJECTED" || p.status === "REVISION_REQUESTED");
/** Art that pre-press makes or pulls from the last run has nothing to preflight. */
const needsPreflight = (job: any) => !["design", "reprint"].includes(job.artworkStatus || "");

/** Which column a job sits in, from its art, preflight and latest PDF / hard proof. */
export function stageFor(job: any, pdf: any | null, hard: any | null = null): Stage {
  if (!pdf) {
    if (job.artworkStatus === "coming" && !job.artInAt) return "art";
    if (needsPreflight(job) && !job.preflightAt) return "preflight";
    return "make";
  }
  if (pdf.status !== "APPROVED") {
    if (isChanges(pdf)) return "make";
    return pdf.sentToCustomerAt ? "customer" : "send";
  }
  const hp = hardMode(job);
  if (hp === "none") return "okay";
  if (!hp || !hard || isChanges(hard)) return "hard";
  if (hard.status === "APPROVED") return "okay";
  if (hp === "internal") return "hard";
  return hard.sentToCustomerAt ? "customer" : "send";
}
/** What the hard proof column card needs right now. */
export function hardStep(job: any, pdf: any | null, hard: any | null): "decide" | "print" | "reprint" | "review" | null {
  if (!pdf || pdf.status !== "APPROVED") return null;
  const hp = hardMode(job);
  if (!hp) return "decide";
  if (hp === "none") return null;
  if (!hard) return "print";
  if (isChanges(hard)) return "reprint";
  if (hp === "internal" && hard.status !== "APPROVED") return "review";
  return null;
}
/** Is the proofing done (the press gate's proof half)? */
export function proofsDone(job: any, approved: { kind?: string | null }[]): boolean {
  if (approved.some((p) => p.kind === "hard")) return true;
  return approved.length > 0 && hardMode(job) === "none";
}

/** Mike's Event Management grid: one dated entry per event, numbered by round. */
export async function addPrepressEvent(prisma: any, jobId: string, ev: { t: string; by: string; loc?: string | null; target?: string | null; note?: string | null }) {
  const j = await prisma.job.findUnique({ where: { id: jobId }, select: { prepressEvents: true } });
  const list: any[] = Array.isArray(j?.prepressEvents) ? j.prepressEvents : [];
  const round = list.filter((e) => e.t === ev.t).length + 1;
  const entry = { t: ev.t, at: new Date().toISOString(), by: ev.by, round, ...(ev.loc ? { loc: String(ev.loc).slice(0, 500) } : {}), ...(ev.target ? { target: ev.target } : {}), ...(ev.note ? { note: String(ev.note).slice(0, 1000) } : {}) };
  await prisma.job.update({ where: { id: jobId }, data: { prepressEvents: [...list, entry] } });
  return entry;
}

const shapeProof = (p: any) => p ? { id: p.id, kind: p.kind || "pdf", version: p.version, fileUrl: p.fileUrl, fileName: p.fileName, status: p.status, sentTo: p.sentTo, sentAt: p.sentToCustomerAt, comment: p.customerComment, respondedBy: p.respondedByName, respondedVia: p.respondedVia, notes: p.notes, location: p.location, deliveryMethod: p.deliveryMethod } : null;

export async function board(prisma: any, opts: { includeTest?: boolean } = {}) {
  const jobs = await prisma.job.findMany({
    where: { status: { in: PREPRESS_STATUSES as any }, ...(opts.includeTest ? {} : { createdAt: { gte: JOBS_LIVE_SINCE } }) },
    include: { order: { include: { company: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 3 } } } } }, csr: { select: { id: true, name: true } }, salesRep: { select: { id: true, name: true } }, proofs: { orderBy: { version: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  return jobs.map((j: any) => {
    const pdf = j.proofs.find((p: any) => (p.kind || "pdf") === "pdf") || null;
    const hard = j.proofs.find((p: any) => p.kind === "hard") || null;
    const stage = stageFor(j, pdf, hard);
    const step = stage === "hard" ? hardStep(j, pdf, hard) : null;
    // The proof the card acts on: the hard proof once the PDF is approved and a hard one exists.
    const current = pdf?.status === "APPROVED" && hard ? hard : pdf;
    // Clock per stage: proof SLA from art-in / preflight (or entry); otherwise time in the stage.
    const since = stage === "make" ? (pdf?.customerRejectedAt || j.preflightAt || j.artInAt || j.createdAt)
      : stage === "preflight" ? (j.artInAt || j.createdAt)
      : stage === "send" ? current?.createdAt : stage === "customer" ? (current?.remindedAt || current?.sentToCustomerAt)
      : stage === "hard" ? (hard?.customerRejectedAt || hard?.createdAt || pdf?.customerApprovedAt) : stage === "okay" ? current?.customerApprovedAt : j.createdAt;
    const hours = since ? (now - new Date(since).getTime()) / 3600e3 : 0;
    const contactEmail = current?.sentTo || pdf?.sentTo || j.order?.company?.contacts?.find((c: any) => c.email)?.email || null;
    return {
      id: j.id, jobNumber: j.jobNumber, name: j.name, status: j.status, quantity: j.quantity, dueDate: j.dueDate, priority: j.priority,
      customer: j.order?.company?.name || "", companyId: j.order?.companyId || null, contactEmail, contactName: j.contactName || j.order?.company?.contacts?.[0]?.name || null,
      csr: j.csr?.name || null, salesRep: j.salesRep?.name || j.repName || null, artworkStatus: j.artworkStatus || null, jobType: j.jobType || null,
      stage, hardStep: step, hardProof: hardMode(j), hardProofDefault: j.order?.company?.hardProofDefault || null,
      preflight: j.preflight || null, events: Array.isArray(j.prepressEvents) ? j.prepressEvents : [],
      hours: Math.round(hours * 10) / 10, slaLate: stage === "make" && hours > PROOF_SLA_HOURS, test: new Date(j.createdAt) < JOBS_LIVE_SINCE,
      proof: shapeProof(current), pdf: shapeProof(pdf), hard: shapeProof(hard),
    };
  });
}

export function proofEmailHtml(o: { firstName?: string | null; customer: string; jobNumber: string; jobName: string; version: number; fileUrl: string | null; link: string; note?: string; senderName: string; reminder?: boolean; kind?: string }) {
  const what = o.kind === "hard" ? "hard proof" : "proof";
  const btn = (href: string, label: string, bg: string) => `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px;">${label}</a>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:620px;">
<p>Hi${o.firstName ? ` ${esc(o.firstName)}` : ""},</p>
<p>${o.reminder ? `Just a reminder: your ${what} is still waiting on your approval.` : `Your ${what} is ready for review.`} We can't go to press until it's approved, so please look it over carefully: spelling, colors, dimensions and anything else that matters to you.</p>
${o.note ? `<p>${esc(o.note).replace(/\n/g, "<br>")}</p>` : ""}
<table style="border-collapse:collapse;margin:12px 0;">
<tr><td style="padding:4px 16px 4px 0;color:#666;">Job</td><td>${esc(o.jobNumber)}, ${esc(o.jobName)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#666;">Proof</td><td>${o.kind === "hard" ? "Hard proof, round" : "Version"} ${o.version}${o.fileUrl ? `, <a href="${o.fileUrl}">open the proof</a>` : ""}</td></tr>
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
  const kind = proof.kind || "pdf";
  await prisma.activityLog.create({ data: { orderId: job.orderId, action: "PROOF_APPROVED", details: `${job.jobNumber} ${kind === "hard" ? "hard proof" : "PDF proof"} v${proof.version} approved by ${by.name} (${by.via})` } }).catch(() => {});
  if (kind !== "hard" && hardMode(job) !== "none") {
    // PDF approved, hard proof next (Mike 11/19). Tell pre-press and the CSR; the plant waits for the final one.
    if (["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PREPRESS"].includes(job.status)) await prisma.job.update({ where: { id: job.id }, data: { status: "PROOFING" } });
    if (!/^QA-/i.test(job.jobNumber || "")) try {
      const { sendEmail } = await import("@/lib/email/graph-client");
      const pre = await prisma.user.findMany({ where: { isActive: true, role: "PREPRESS_MANAGER" }, select: { email: true } });
      const to = [...new Set([...pre.map((u: any) => u.email), job.csr?.email].filter(Boolean))] as string[];
      const hp = hardMode(job);
      if (to.length) await sendEmail({ from: by.fromEmail?.endsWith("@cndprinting.com") ? by.fromEmail : AR_FROM, to, subject: `PDF approved, hard proof next: ${job.jobNumber} (${job.order?.company?.name || ""})`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p><b>${esc(job.order?.company?.name)}</b> approved PDF proof v${proof.version} for job ${esc(job.jobNumber)}, ${esc(job.name)} (${esc(by.name)}, ${esc(by.via)}).</p><p>${hp ? `Next: ${esc(HARD_PROOF_LABEL[hp] || hp)}.` : "Next: decide the hard proof (to the customer, internal check, or PDF only)."} <a href="${BASE_URL}/dashboard/prepress">Open Pre-Press &amp; Proofs</a></p></div>` });
    } catch (e) { console.error("pdf approved notice failed", e); }
    return proof;
  }
  await finalizeProofs(prisma, proof.id, by);
  return proof;
}

/** Proofing is done (final proof approved): job to approved, plant alert, press-gate check. */
export async function finalizeProofs(prisma: any, proofId: string, by: { name: string; via: string; comment?: string | null; fromEmail?: string | null }) {
  const proof = await prisma.proof.findUnique({ where: { id: proofId }, include: { job: { include: { order: { include: { company: true } }, csr: { select: { email: true } }, salesRep: { select: { email: true } } } } } });
  const job = proof.job;
  if (["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "PREPRESS"].includes(job.status)) await prisma.job.update({ where: { id: job.id }, data: { status: "CUSTOMER_APPROVAL" } });
  if (!proof.productionAlertSentAt && !/^QA-/i.test(job.jobNumber || "")) { // test jobs never email the plant
    try {
      const { sendEmail } = await import("@/lib/email/graph-client");
      const plant = await prisma.user.findMany({ where: { isActive: true, role: { in: ["PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "PREPRESS_MANAGER"] } }, select: { email: true } });
      const to = [...new Set([...plant.map((u: any) => u.email), job.csr?.email, job.salesRep?.email].filter(Boolean))] as string[];
      if (to.length) await sendEmail({ from: by.fromEmail?.endsWith("@cndprinting.com") ? by.fromEmail : AR_FROM, to, subject: `Proof approved: ${job.jobNumber} (${job.order?.company?.name || ""})`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p><b>${esc(job.order?.company?.name)}</b> approved the final proof (${proof.kind === "hard" ? `hard proof v${proof.version}` : `PDF v${proof.version}, PDF only`}) for job ${esc(job.jobNumber)}, ${esc(job.name)}.</p><p>Approved by ${esc(by.name)} (${esc(by.via)})${by.comment ? `: "${esc(by.comment)}"` : ""}.</p><p>It schedules once the deposit is in. <a href="${BASE_URL}/dashboard/jobs/${job.id}">Open the job</a></p></div>` });
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
    if (to.length) await sendEmail({ from: by.fromEmail?.endsWith("@cndprinting.com") ? by.fromEmail : AR_FROM, to, subject: `${proof.kind === "hard" ? "Hard proof" : "Proof"} changes requested: ${job.jobNumber} (${job.order?.company?.name || ""})`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p><b>${esc(job.order?.company?.name)}</b> asked for changes to proof v${proof.version} on job ${esc(job.jobNumber)}, ${esc(job.name)}:</p><blockquote style="border-left:3px solid #b45309;margin:0;padding:4px 12px;">${esc(by.comment).replace(/\n/g, "<br>")}</blockquote><p>From ${esc(by.name)} (${esc(by.via)}). It's back in ${proof.kind === "hard" ? "Hard proof for another round" : "Make PDF proof"}. <a href="${BASE_URL}/dashboard/prepress">Open Pre-Press & Proofs</a></p></div>` });
  } catch (e) { console.error("proof changes alert failed", e); }
  return proof;
}
