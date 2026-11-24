import { NextRequest, NextResponse } from "next/server";
import { repScope } from "@/lib/rep-scope";
import { getSession } from "@/lib/session";
import { PROOF_ACT_ROLES, PROOF_MAKE_ROLES, STAGES, PREFLIGHT_ISSUES, HARD_PROOF_LABEL, BASE_URL, addPrepressEvent, board, finalizeProofs, newApprovalToken, onProofApproved, onProofChanges, proofEmailHtml, proofLink } from "@/lib/proofs";
import { isTestJob, tSubj } from "@/lib/test-mode";

// Pre-Press & Proofs board (remade 11/17/26).
// GET ?test=1 -> { stages, jobs }  (test jobs hidden unless asked)
// POST actions: art_in, preflight, new_file, imposed, upload_proof (pdf | hard), hard_mode (proof type on the ticket),
//   send_proof (preview / reminder), mark_sent, record
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ stages: STAGES, jobs: [] });
  const includeTest = new URL(request.url).searchParams.get("test") === "1";
  return NextResponse.json({
    stages: STAGES, jobs: await (async () => { const sc = await repScope(prisma, session); const all: any[] = await board(prisma, { includeTest }); return sc ? all.filter((j) => sc.jobIds.includes(j.id)) : all; })(), // sales reps: own jobs (11/24/26) preflightIssues: PREFLIGHT_ISSUES, hardLabels: HARD_PROOF_LABEL,
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

  const JOB_ACTIONS = ["art_in", "upload_proof", "preflight", "new_file", "imposed", "hard_mode"];
  if (JOB_ACTIONS.includes(b.action)) {
    const job = await prisma.job.findUnique({ where: { id: String(b.jobId || "") }, include: { order: { include: { company: true } }, csr: { select: { id: true, email: true, name: true } }, proofs: { where: { kind: "pdf" }, orderBy: { version: "desc" }, take: 1 } } as any }) as any;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const loc = b.location ? String(b.location).trim().slice(0, 500) : null;
    if (b.action === "art_in") {
      await prisma.job.update({ where: { id: job.id }, data: { artInAt: new Date(), artworkStatus: "ready" } as any });
      await addPrepressEvent(prisma, job.id, { t: "new_file", by: session.name, loc, note: b.note || null });
      await log(job.orderId, `${job.jobNumber}: artwork in, marked by ${session.name}${loc ? ` (${loc})` : ""}`);
      return NextResponse.json({ ok: true });
    }
    // Proof type is part of the ticket (Mike 11/19): CSR, sales or owners set it, not pre-press.
    if (b.action === "hard_mode") {
      if (["PREPRESS_MANAGER", "DIGITAL_PRESS"].includes(session.role)) return NextResponse.json({ error: "The CSR sets the proof type on the ticket" }, { status: 403 });
      const mode = ["customer", "internal", "none"].includes(b.mode) ? b.mode : null;
      if (!mode) return NextResponse.json({ error: "Pick PDF only, hard proof to customer, or internal check" }, { status: 400 });
      await prisma.job.update({ where: { id: job.id }, data: { hardProof: mode } as any });
      if (b.always && job.order?.companyId && !isTestJob(job)) await prisma.company.update({ where: { id: job.order.companyId }, data: { hardProofDefault: mode } as any });
      await log(job.orderId, `${job.jobNumber}: proof type ${HARD_PROOF_LABEL[mode]} set by ${session.name}${b.always ? " (customer default)" : ""}`);
      // PDF-only and the PDF is already approved: proofing is done now.
      const pdf = job.proofs?.[0];
      if (mode === "none" && pdf?.status === "APPROVED") await finalizeProofs(prisma, pdf.id, { name: pdf.respondedByName || "customer", via: `PDF only, set by ${session.name}`, fromEmail: session.email });
      return NextResponse.json({ ok: true });
    }
    if (!PROOF_MAKE_ROLES.includes(session.role)) return NextResponse.json({ error: "Pre-press or CSRs do this" }, { status: 403 });

    // Mike: new files can come in at any round (changes, customer resends).
    if (b.action === "new_file") {
      await addPrepressEvent(prisma, job.id, { t: "new_file", by: session.name, loc, note: b.note || null });
      await log(job.orderId, `${job.jobNumber}: new file in, logged by ${session.name}${loc ? ` (${loc})` : ""}`);
      return NextResponse.json({ ok: true });
    }
    // Moved into XMF (offset) or sent to the Konica (digital).
    if (b.action === "imposed") {
      const target = b.target === "Konica" ? "Konica" : "XMF";
      await addPrepressEvent(prisma, job.id, { t: "imposition", by: session.name, loc, target, note: b.note || null });
      await log(job.orderId, `${job.jobNumber}: ${target === "XMF" ? "moved into XMF" : "file sent to the Konica"} by ${session.name}`);
      return NextResponse.json({ ok: true });
    }
    // Preflight report (Mike 11/19): goes to the CSR, who handles the customer.
    if (b.action === "preflight") {
      const result = ["ok", "fixed", "new_art"].includes(b.result) ? b.result : "ok";
      const issues = (Array.isArray(b.issues) ? b.issues : []).map((i: unknown) => String(i).slice(0, 120)).slice(0, 20);
      const note = String(b.note || "").trim().slice(0, 2000);
      if (result !== "ok" && !issues.length && !note) return NextResponse.json({ error: "Say what's wrong with the files" }, { status: 400 });
      const report = { issues, note, result, by: session.name, at: new Date().toISOString() };
      await prisma.job.update({ where: { id: job.id }, data: result === "new_art" ? { preflight: report, preflightAt: null, artInAt: null, artworkStatus: "coming" } : { preflight: report, preflightAt: new Date() } } as any);
      await addPrepressEvent(prisma, job.id, { t: "preflight", by: session.name, note: [result === "ok" ? "Files good" : result === "fixed" ? "Fixed by pre-press" : "New files needed", issues.join(", "), note].filter(Boolean).join(": ") });
      await log(job.orderId, `${job.jobNumber}: preflight ${result === "ok" ? "passed" : result === "fixed" ? "fixed by pre-press" : "needs new art"} (${session.name})${issues.length ? `: ${issues.join(", ")}` : ""}`);
      let told: string | null = null;
      if ((result !== "ok" || issues.length || note) && job.csr && !/^QA-/i.test(job.jobNumber || "")) {
        const title0 = result === "new_art" ? `New art needed: ${job.jobNumber} (${job.order?.company?.name || ""})` : `Preflight report: ${job.jobNumber} (${job.order?.company?.name || ""})`;
        const title = tSubj(job, title0);
        const e = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        try {
          const { sendEmail } = await import("@/lib/email/graph-client");
          await sendEmail({ from: session.email, to: [job.csr.email], subject: title, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${e(job.csr.name?.split(" ")[0] || "Hi")},</p><p>Preflight on job ${e(job.jobNumber)}, ${e(job.name)} for <b>${e(job.order?.company?.name)}</b>:</p>${issues.length ? `<ul>${issues.map((i: string) => `<li>${e(i)}</li>`).join("")}</ul>` : ""}${note ? `<p>${e(note).replace(/\n/g, "<br>")}</p>` : ""}<p><b>${result === "new_art" ? "We need new files from the customer. The job is back in Waiting on art." : result === "fixed" ? "We fixed these ourselves. Please let the customer know exactly what we changed." : "Files are usable, but please pass this along to the customer."}</b></p><p><a href="${BASE_URL}/dashboard/prepress">Open Pre-Press &amp; Proofs</a></p><p>${e(session.name)}</p></div>` });
          told = job.csr.name;
        } catch (err) { console.error("preflight email failed", err); }
        await prisma.notification.create({ data: { userId: job.csr.id, type: "prepress", actorName: session.name, title, body: [issues.join(", "), note].filter(Boolean).join(" - ").slice(0, 500), url: "/dashboard/prepress" } }).catch(() => {});
      }
      return NextResponse.json({ ok: true, told });
    }
    if (b.action === "upload_proof") {
      const kind = b.kind === "hard" ? "hard" : "pdf";
      // A hard proof is physical: a photo or scan is optional.
      if (kind === "pdf" && !b.fileUrl) return NextResponse.json({ error: "Attach the proof file" }, { status: 400 });
      const version = (await prisma.proof.count({ where: { jobId: job.id, kind } })) + 1;
      const proof = await prisma.proof.create({ data: { jobId: job.id, kind, version, status: "PENDING", fileUrl: b.fileUrl ? String(b.fileUrl) : null, fileName: String(b.fileName || (kind === "hard" ? `Hard proof ${version}` : `proof-v${version}.pdf`)).slice(0, 200), location: loc, sentDate: new Date(), notes: b.notes ? String(b.notes).slice(0, 1000) : null } as any });
      await prisma.job.update({ where: { id: job.id }, data: { status: ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PREPRESS", "CUSTOMER_APPROVAL"].includes(job.status) ? "PROOFING" : job.status, ...(job.artInAt ? {} : { artInAt: new Date() }) } as any });
      if (kind === "hard") await addPrepressEvent(prisma, job.id, { t: "physical", by: session.name, loc, note: b.notes || null });
      await log(job.orderId, `${job.jobNumber}: ${kind === "hard" ? "hard proof" : "PDF proof"} v${version} ${kind === "hard" ? "printed" : "uploaded"} by ${session.name}`);
      return NextResponse.json({ ok: true, proof });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const proof = await prisma.proof.findUnique({ where: { id: String(b.proofId || "") }, include: { job: { include: { order: { include: { company: true } } } } } }) as any;
  if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  const job = proof.job;

  if (b.action === "send_proof") {
    const to = String(b.to || proof.sentTo || "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const token = proof.approvalToken || newApprovalToken();
    const first = String(b.firstName || job.contactName || "").trim().split(/\s+/)[0] || null;
    const html = proofEmailHtml({ firstName: first, customer: job.order?.company?.name || "", jobNumber: job.jobNumber, jobName: job.name, version: proof.version, fileUrl: proof.fileUrl, link: proofLink(token), note: b.note ? String(b.note).slice(0, 2000) : undefined, senderName: session.name, reminder: !!b.reminder, kind: proof.kind });
    const subject = `${isTestJob(job) ? "[TEST] " : ""}${b.reminder ? "Reminder: " : ""}${proof.kind === "hard" ? "Hard proof" : "Proof"} ready for approval: ${job.name} (job ${job.jobNumber}) | C&D Printing`;
    if (b.preview) return NextResponse.json({ to: to.join(", "), subject, html });
    if (!to.length || to.some((e) => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e))) return NextResponse.json({ error: "Add the customer's email" }, { status: 400 });
    if (isTestJob(job) && !to.every((e) => /@cndprinting\.com$/i.test(e))) return NextResponse.json({ error: "This is a TEST job: send the proof to your own @cndprinting.com email. Customers never get test emails." }, { status: 400 });
    if (!proof.fileUrl) return NextResponse.json({ error: proof.kind === "hard" ? "No photo of this hard proof to email. Use \"Sent / handed over\" instead." : "This proof has no file to send" }, { status: 400 });
    const { sendEmail } = await import("@/lib/email/graph-client");
    const r = await sendEmail({ from: session.email, to, subject, body: html });
    if (!r.success) return NextResponse.json({ error: r.error || "Email failed" }, { status: 502 });
    await prisma.proof.update({ where: { id: proof.id }, data: { approvalToken: token, sentTo: to.join(", "), deliveryMethod: "email", ...(b.reminder ? { remindedAt: new Date() } : { sentToCustomerAt: new Date(), sentToCustomerById: session.id, status: "SENT" }) } });
    if (!b.reminder && proof.kind !== "hard") await addPrepressEvent(prisma, job.id, { t: "eproof", by: session.name, loc: proof.location || proof.fileUrl, note: `v${proof.version} to ${to.join(", ")}` });
    await log(job.orderId, `${job.jobNumber}: proof v${proof.version} ${b.reminder ? "reminder" : "sent"} to ${to.join(", ")} by ${session.name}`);
    return NextResponse.json({ ok: true, to: to.join(", ") });
  }

  if (b.action === "mark_sent") {
    const method = b.method === "physical" ? "physical" : "email";
    await prisma.proof.update({ where: { id: proof.id }, data: { deliveryMethod: method, sentToCustomerAt: new Date(), sentToCustomerById: session.id, status: "SENT", sentTo: b.to ? String(b.to).slice(0, 300) : proof.sentTo } });
    if (proof.kind !== "hard") await addPrepressEvent(prisma, job.id, { t: "eproof", by: session.name, loc: proof.location || proof.fileUrl, note: `v${proof.version} sent another way` });
    await log(job.orderId, `${job.jobNumber}: proof v${proof.version} marked sent (${method}) by ${session.name}`);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "record") {
    // Internal hard proof check: CSR / sales sign off themselves (Mike 11/19).
    const name = b.internal ? session.name : (String(b.name || "").trim() || "the customer");
    const via = b.internal ? "internal check" : `recorded by ${session.name}${b.how ? `, ${String(b.how).slice(0, 40)}` : ""}`;
    if (b.decision === "approve") await onProofApproved(prisma, proof.id, { name, via, comment: b.comment || null, fromEmail: session.email });
    else if (b.decision === "changes") {
      if (!String(b.comment || "").trim()) return NextResponse.json({ error: "What does the customer want changed?" }, { status: 400 });
      await onProofChanges(prisma, proof.id, { name, via, comment: String(b.comment).slice(0, 4000), fromEmail: session.email });
    } else return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
