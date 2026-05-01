import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const STAGES = [
  "QUOTE", "ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL",
  "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED",
  "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA",
  "PACKED", "SHIPPED", "DELIVERED", "INVOICED",
] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    if (!prisma) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: { order: { include: { company: true } }, stages: true, proofs: true, lineItems: { orderBy: { sortOrder: "asc" } }, pressRuns: { orderBy: { sortOrder: "asc" } }, purchases: true },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Lazy-load the originating quote request so the job ticket can render
    // the full QR menu (proofs, foil, mailing, etc.) as a read-only card.
    const quoteRequest = job.quoteRequestId
      ? await prisma.quoteRequest.findUnique({
          where: { id: job.quoteRequestId },
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        }).catch(() => null)
      : null;

    return NextResponse.json({ job, quoteRequest, source: "database" });
  } catch (error) {
    console.error("Job GET error:", error);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...updates } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    // Pre-press gate: block entry to PRINTING and beyond unless proof is approved.
    // Stages that require sign-off to enter.
    const GATED_STAGES = new Set([
      "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING",
      "QA", "PACKED", "SHIPPED", "DELIVERED", "INVOICED",
    ]);
    const checkPrepressGate = async (jobId: string, nextStatus: string): Promise<string | null> => {
      if (!GATED_STAGES.has(nextStatus)) return null;
      const approved = await prisma.proof.count({
        where: { jobId, status: "APPROVED" },
      });
      if (approved === 0) {
        return "Pre-press gate: cannot move into printing until at least one proof is approved. Upload and approve a proof first.";
      }
      return null;
    };

    // Advance to next stage
    if (action === "advance") {
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const currentIndex = STAGES.indexOf(job.status as typeof STAGES[number]);
      if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
        return NextResponse.json({ error: "Cannot advance past final stage" }, { status: 400 });
      }

      const nextStatus = STAGES[currentIndex + 1];
      const gateError = await checkPrepressGate(id, nextStatus);
      if (gateError) return NextResponse.json({ error: gateError }, { status: 409 });
      const updated = await prisma.job.update({
        where: { id },
        data: { status: nextStatus },
        include: { order: { include: { company: true } } },
      });

      await prisma.order.update({ where: { id: updated.orderId }, data: { status: nextStatus } });
      await prisma.activityLog.create({ data: { orderId: updated.orderId, userId: session.id, action: "STAGE_ADVANCED", details: `${updated.jobNumber} advanced to ${nextStatus}` } }).catch(() => {});

      return NextResponse.json({ job: updated });
    }

    // Set specific status
    if (action === "setStatus" && updates.status) {
      const gateError = await checkPrepressGate(id, updates.status);
      if (gateError) return NextResponse.json({ error: gateError }, { status: 409 });
      const updated = await prisma.job.update({
        where: { id },
        data: { status: updates.status },
        include: { order: { include: { company: true } } },
      });
      await prisma.order.update({ where: { id: updated.orderId }, data: { status: updates.status } });
      return NextResponse.json({ job: updated });
    }

    // General update — supports all job ticket fields
    const updateData: Record<string, unknown> = {};
    const stringFields = [
      "name", "description", "jobType", "subStatus", "lastJobNumber", "customerPO", "estimateNumber",
      "repName", "contactName", "stockDescription", "blanketNumber", "dieNumber",
      "inkFront", "inkBack", "varnish", "coating", "pressAssignment", "pressFormat", "paperSource",
      "imposition", "runningSize", "pressmanInitials", "binderyOther", "binderyNotes",
      "deliveryPackaging", "deliveryTo", "samplesTo", "vendorInfo", "pressNotes",
      "paymentNotes", "prepressNotes", "generalNotes", "plantLocation",
    ];
    const boolFields = [
      "fscCertified", "pressCheck", "ledInk", "binderyScore", "binderyPerf",
      "binderyDrill", "binderyPad", "binderyFold", "binderyCount", "binderyStitch",
      "binderyCollate", "binderyPockets", "binderyGlue", "binderyWrap",
      "samplesRequired", "samplesChecked", "softCover", "plusCover", "hasBleeds",
    ];
    const intFields = ["numPages", "numberUp", "makeReadyCount", "firstPassCount", "finalPressCount", "deliveryQty"];
    const floatFields = ["flatSizeWidth", "flatSizeHeight", "finishedWidth", "finishedHeight", "aaCharges"];

    for (const f of stringFields) { if (updates[f] !== undefined) updateData[f] = updates[f]; }
    for (const f of boolFields) { if (updates[f] !== undefined) updateData[f] = Boolean(updates[f]); }
    for (const f of intFields) { if (updates[f] !== undefined) updateData[f] = parseInt(updates[f]) || null; }
    for (const f of floatFields) { if (updates[f] !== undefined) updateData[f] = parseFloat(updates[f]) || null; }

    if (updates.quantity) updateData.quantity = parseInt(updates.quantity);
    if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
    if (updates.priority) updateData.priority = updates.priority;
    if (updates.proofDate) updateData.proofDate = new Date(updates.proofDate);

    const updated = await prisma.job.update({
      where: { id },
      data: updateData,
      include: { order: { include: { company: true } } },
    });

    // Audit trail — log what changed
    const changedFields = Object.keys(updateData).join(", ");
    await prisma.activityLog.create({
      data: { orderId: updated.orderId, userId: session.id, action: "JOB_UPDATED", details: `${updated.jobNumber} updated: ${changedFields}` },
    }).catch(() => {});

    return NextResponse.json({ job: updated });
  } catch (error) {
    console.error("Job PUT error:", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const deleteRoles = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"];
    if (!session || !deleteRoles.includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const job = await prisma.job.findUnique({ where: { id } });
    await prisma.activityLog.create({
      data: { orderId: job?.orderId, userId: session.id, action: "JOB_DELETED", details: `Deleted job ${job?.jobNumber}: ${job?.name}` },
    }).catch(() => {});
    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Job DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
