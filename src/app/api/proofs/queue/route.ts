import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Proof queue — role-aware buckets that drive the /dashboard/proofing page
 * and sales/pre-press home widgets.
 *
 * Buckets returned:
 *  - prepressToDo:  jobs in proof-prep stages without a pending proof
 *                   (pre-press needs to upload the next round)
 *  - salesToSend:   proofs uploaded by pre-press, not yet sent to customer
 *                   (sales needs to email or physically send)
 *  - awaitingCustomer: proofs sent, awaiting customer decision
 *  - recentlyApproved: last ~5 approved proofs (context for production)
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({
        prepressToDo: [], salesToSend: [], awaitingCustomer: [], recentlyApproved: [],
      });
    }

    // 1. Pre-press "to do": jobs in proof-prep stages with no PENDING proof yet.
    const proofPrepStages = ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PREPRESS"];
    const prepressJobs = await prisma.job.findMany({
      where: {
        status: { in: proofPrepStages as any },
        // No existing PENDING proof for this job
        proofs: { none: { status: "PENDING" } },
      },
      include: {
        order: { include: { company: true } },
        csr: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    });

    // 2. Sales "to send": proofs uploaded, not yet marked sent.
    const salesToSend = await prisma.proof.findMany({
      where: {
        status: "PENDING",
        sentToCustomerAt: null,
      },
      include: {
        job: {
          include: {
            order: { include: { company: true } },
            salesRep: { select: { id: true, name: true, email: true } },
            csr: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 3. Awaiting customer decision: proofs sent, still PENDING.
    const awaitingCustomer = await prisma.proof.findMany({
      where: {
        status: "PENDING",
        sentToCustomerAt: { not: null },
      },
      include: {
        job: {
          include: {
            order: { include: { company: true } },
            salesRep: { select: { id: true, name: true, email: true } },
            csr: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { sentToCustomerAt: "desc" },
      take: 50,
    });

    // 4. Recently approved — context for production scheduling
    const recentlyApproved = await prisma.proof.findMany({
      where: { status: "APPROVED" },
      include: {
        job: {
          include: { order: { include: { company: true } } },
        },
      },
      orderBy: { customerApprovedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      prepressToDo: prepressJobs.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        status: j.status,
        dueDate: j.dueDate,
        customer: j.order?.company?.name || "",
        csrName: j.csr?.name || "",
      })),
      salesToSend: salesToSend.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        version: p.version,
        fileName: p.fileName,
        fileUrl: p.fileUrl,
        notes: p.notes,
        createdAt: p.createdAt,
        jobNumber: p.job?.jobNumber,
        jobName: p.job?.name,
        customer: p.job?.order?.company?.name || "",
        salesRepName: p.job?.salesRep?.name || "",
        salesRepId: p.job?.salesRep?.id || "",
        csrName: p.job?.csr?.name || "",
        csrId: p.job?.csr?.id || "",
      })),
      awaitingCustomer: awaitingCustomer.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        version: p.version,
        fileName: p.fileName,
        fileUrl: p.fileUrl,
        sentToCustomerAt: p.sentToCustomerAt,
        deliveryMethod: p.deliveryMethod,
        jobNumber: p.job?.jobNumber,
        jobName: p.job?.name,
        customer: p.job?.order?.company?.name || "",
        salesRepName: p.job?.salesRep?.name || "",
        salesRepId: p.job?.salesRep?.id || "",
        csrName: p.job?.csr?.name || "",
        csrId: p.job?.csr?.id || "",
      })),
      recentlyApproved: recentlyApproved.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        version: p.version,
        jobNumber: p.job?.jobNumber,
        jobName: p.job?.name,
        customer: p.job?.order?.company?.name || "",
        customerApprovedAt: p.customerApprovedAt,
      })),
      currentUser: { id: session.id, name: session.name, role: session.role },
    });
  } catch (error) {
    console.error("Proof queue error:", error);
    return NextResponse.json({ error: "Failed to fetch proof queue" }, { status: 500 });
  }
}
