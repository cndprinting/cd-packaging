import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ proofs: [], source: "demo" });

    const where = jobId ? { jobId } : {};
    const proofs = await prisma.proof.findMany({
      where,
      include: { job: { include: { order: { include: { company: true } } } }, approvals: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ proofs, source: "database" });
  } catch (error) {
    console.error("Proofs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch proofs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { jobId, action, proofId, comments } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    // Approve or reject a proof
    if (action === "approve" || action === "reject") {
      if (!proofId) return NextResponse.json({ error: "Proof ID required" }, { status: 400 });

      const status = action === "approve" ? "APPROVED" : "REJECTED";
      await prisma.proofApproval.create({
        data: { proofId, userId: session.id, status, comments },
      });
      await prisma.proof.update({ where: { id: proofId }, data: { status } });

      // If approved, advance job to next stage
      if (action === "approve") {
        const proof = await prisma.proof.findUnique({ where: { id: proofId } });
        if (proof) {
          await prisma.job.update({ where: { id: proof.jobId }, data: { status: "CUSTOMER_APPROVAL" } });
        }
      }

      return NextResponse.json({ ok: true, status });
    }

    // Create new proof
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const existingProofs = await prisma.proof.count({ where: { jobId } });
    const proof = await prisma.proof.create({
      data: {
        jobId,
        version: existingProofs + 1,
        status: "PENDING",
        fileName: body.fileName || `proof-v${existingProofs + 1}.pdf`,
        fileUrl: body.fileUrl || null,
        sentDate: new Date(),
        notes: body.notes,
      },
    });

    // Update job status to PROOFING
    await prisma.job.update({ where: { id: jobId }, data: { status: "PROOFING" } });

    return NextResponse.json({ proof });
  } catch (error) {
    console.error("Proofs POST error:", error);
    return NextResponse.json({ error: "Failed to process proof" }, { status: 500 });
  }
}
