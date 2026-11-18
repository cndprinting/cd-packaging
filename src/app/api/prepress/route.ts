import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { PROOF_ACT_ROLES, PROOF_MAKE_ROLES, STAGES, board, newApprovalToken, onProofApproved, onProofChanges, proofEmailHtml, proofLink } from "@/lib/proofs";

// Pre-Press & Proofs board (remade 11/17/26).
// GET ?test=1 -> { stages, jobs }  (test jobs hidden unless asked)
// POST actions: art_in, upload_proof, no_proof, send_proof (preview / reminder), mark_sent, record
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ stages: STAGES, jobs: [] });
  const includeTest = new URL(request.url).searchParams.get("test") === "1";
  return NextResponse.json({
    stages: STAGES, jobs: await board(prisma, { includeTest }),
    me: { role: session.role, canAct: PROOF_ACT_ROLES.includes(session.role), canMake: PROOF_MAKE_ROLES.includes(session.role) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !PROOF_ACT_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json().catch(() => ({}));
  const log = (orderId: string, details: string) => prisma.activityLog.create({ data: { orderId, userId: session.id, action: "PREPRESS", details } }).catch(() => {});

  if (b.action === "art_in" || b.action === "upload_proof" || b.action === "no_proof") {
    const job = await prisma.job.findUnique({ where: { id: String(b.jobId || "") }, select: { id: true, jobNumber: true, orderId: true, artInAt: true, status: true } as any }) as any;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (b.action === "art_in") {
      await prisma.job.update({ where: { id: job.id }, data: { artInAt: new Date(), artworkStatus: "ready" } as any });
      await log(job.orderId, `${job.jobNumber}: artwork in, marked by ${session.name}`);
      return NextResponse.json({ ok: true });
    }
    if (!PROOF_MAKE_ROLES.includes(session.role)) return NextResponse.json({ error: "Pre-press or CSRs make proofs" }, { status: 403 });
    if (b.action === "upload_proof") {
      if (!b.fileUrl) return NextResponse.json({ error: "Attach the proof file" }, { status: 400 });
      const version = (await prisma.proof.count({ where: { jobId: job.id } })) + 1;
      const proof = await prisma.proof.create({ data: { jobId: job.id, version, status: "PENDING", fileUrl: String(b.fileUrl), fileName: String(b.fileName || `proof-v${version}.pdf`).slice(0, 200), sentDate: new Date(), notes: b.notes ? String(b.notes).slice(0, 1000) : null } });
      await prisma.job.update({ where: { id: job.id }, data: { status: ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PREPRESS", "CUSTOMER_APPROVAL"].includes(job.status) ? "PROOFING" : job.status, ...(job.artInAt ? {} : { artInAt: new Date() }) } as any });
      await log(job.orderId, `${job.jobNumber}: proof v${version} uploaded by ${session.name}`);
      return NextResponse.json({ ok: true, proof });
    }
    // no_proof: exact reprint or customer waived the proof. Logged as an internal approval.
    const reason = String(b.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Say why no proof is needed" }, { status: 400 });
    const version = (await prisma.proof.count({ where: { jobId: job.id } })) + 1;
    const proof = await prisma.proof.create({ data: { jobId: job.id, version, status: "PENDING", fileName: "No proof needed", notes: reason.slice(0, 500), sentDate: new Date() } });
    await onProofApproved(prisma, proof.id, { name: session.name, via: "no proof needed", comment: reason, fromEmail: session.email });
    return NextResponse.json({ ok: true });
  }

  const proof = await prisma.proof.findUnique({ where: { id: String(b.proofId || "") }, include: { job: { include: { order: { include: { company: true } } } } } }) as any;
  if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  const job = proof.job;

  if (b.action === "send_proof") {
    const to = String(b.to || proof.sentTo || "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const token = proof.approvalToken || newApprovalToken();
    const first = String(b.firstName || job.contactName || "").trim().split(/\s+/)[0] || null;
    const html = proofEmailHtml({ firstName: first, customer: job.order?.company?.name || "", jobNumber: job.jobNumber, jobName: job.name, version: proof.version, fileUrl: proof.fileUrl, link: proofLink(token), note: b.note ? String(b.note).slice(0, 2000) : undefined, senderName: session.name, reminder: !!b.reminder });
    const subject = `${b.reminder ? "Reminder: " : ""}Proof ready for approval: ${job.name} (job ${job.jobNumber}) | C&D Printing`;
    if (b.preview) return NextResponse.json({ to: to.join(", "), subject, html });
    if (!to.length || to.some((e) => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e))) return NextResponse.json({ error: "Add the customer's email" }, { status: 400 });
    if (!proof.fileUrl) return NextResponse.json({ error: "This proof has no file to send" }, { status: 400 });
    const { sendEmail } = await import("@/lib/email/graph-client");
    const r = await sendEmail({ from: session.email, to, subject, body: html });
    if (!r.success) return NextResponse.json({ error: r.error || "Email failed" }, { status: 502 });
    await prisma.proof.update({ where: { id: proof.id }, data: { approvalToken: token, sentTo: to.join(", "), deliveryMethod: "email", ...(b.reminder ? { remindedAt: new Date() } : { sentToCustomerAt: new Date(), sentToCustomerById: session.id, status: "SENT" }) } });
    await log(job.orderId, `${job.jobNumber}: proof v${proof.version} ${b.reminder ? "reminder" : "sent"} to ${to.join(", ")} by ${session.name}`);
    return NextResponse.json({ ok: true, to: to.join(", ") });
  }

  if (b.action === "mark_sent") {
    const method = b.method === "physical" ? "physical" : "email";
    await prisma.proof.update({ where: { id: proof.id }, data: { deliveryMethod: method, sentToCustomerAt: new Date(), sentToCustomerById: session.id, status: "SENT", sentTo: b.to ? String(b.to).slice(0, 300) : proof.sentTo } });
    await log(job.orderId, `${job.jobNumber}: proof v${proof.version} marked sent (${method}) by ${session.name}`);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "record") {
    const name = String(b.name || "").trim() || "the customer";
    const via = `recorded by ${session.name}${b.how ? `, ${String(b.how).slice(0, 40)}` : ""}`;
    if (b.decision === "approve") await onProofApproved(prisma, proof.id, { name, via, comment: b.comment || null, fromEmail: session.email });
    else if (b.decision === "changes") {
      if (!String(b.comment || "").trim()) return NextResponse.json({ error: "What does the customer want changed?" }, { status: 400 });
      await onProofChanges(prisma, proof.id, { name, via, comment: String(b.comment).slice(0, 4000), fromEmail: session.email });
    } else return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
