import { NextRequest, NextResponse } from "next/server";
import { onProofApproved, onProofChanges } from "@/lib/proofs";

// Public: the customer's Approve / Request changes buttons (no login).
// GET ?t=token -> what they're approving.  POST { t, decision, name, comment }
async function load(token: string) {
  if (!token || token.length < 16) return null;
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return null;
  const proof = await prisma.proof.findUnique({ where: { approvalToken: token }, include: { job: { include: { order: { include: { company: true } } } } } }) as any;
  return proof ? { prisma, proof } : null;
}
const view = (p: any) => ({
  customer: p.job.order?.company?.name || "", jobNumber: p.job.jobNumber, jobName: p.job.name, quantity: p.job.quantity,
  version: p.version, fileUrl: p.fileUrl, fileName: p.fileName,
  answered: p.status === "APPROVED" || p.status === "REVISION_REQUESTED" || p.status === "REJECTED",
  status: p.status, respondedBy: p.respondedByName, comment: p.customerComment,
});

export async function GET(request: NextRequest) {
  const r = await load(new URL(request.url).searchParams.get("t") || "");
  if (!r) return NextResponse.json({ error: "This proof link isn't valid. Call C&D at 727-572-9999." }, { status: 404 });
  return NextResponse.json(view(r.proof));
}

export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const r = await load(String(b.t || ""));
  if (!r) return NextResponse.json({ error: "This proof link isn't valid. Call C&D at 727-572-9999." }, { status: 404 });
  const { prisma, proof } = r;
  if (view(proof).answered) return NextResponse.json({ ...view(proof), already: true });
  const name = String(b.name || "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Please type your name" }, { status: 400 });
  const sender = proof.sentToCustomerById ? await prisma.user.findUnique({ where: { id: proof.sentToCustomerById }, select: { email: true } }) : null;
  if (b.decision === "approve") {
    await onProofApproved(prisma, proof.id, { name, via: "customer clicked Approve", comment: b.comment ? String(b.comment).slice(0, 2000) : null, fromEmail: sender?.email });
  } else if (b.decision === "changes") {
    const comment = String(b.comment || "").trim();
    if (!comment) return NextResponse.json({ error: "Tell us what to change" }, { status: 400 });
    await onProofChanges(prisma, proof.id, { name, via: "customer clicked Request changes", comment: comment.slice(0, 4000), fromEmail: sender?.email });
  } else return NextResponse.json({ error: "Choose approve or request changes" }, { status: 400 });
  const fresh = await load(String(b.t));
  return NextResponse.json(view(fresh!.proof));
}
