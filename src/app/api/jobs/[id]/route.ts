import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkPressGate } from "@/lib/press-gate";

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
      include: { order: { include: { company: true } }, stages: true, proofs: true, lineItems: { orderBy: { sortOrder: "asc" } }, pressRuns: { orderBy: { sortOrder: "asc" } }, purchases: true, csr: { select: { name: true } }, salesRep: { select: { name: true } } },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // 11/22/26 lock-down: this used to answer anyone with no login. Staff see any job;
    // a customer login sees only its own company's jobs; vendors and visitors see none.
    const viewer = await getSession();
    if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (viewer.role === "VENDOR" || (viewer.role === "CUSTOMER" && (!viewer.companyId || job.order.companyId !== viewer.companyId))) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

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
    // One gate for every route (Benjy 11/17): proof approved, and for deposit or
    // prepaid terms, the money in on the job's invoice. See src/lib/press-gate.ts.
    void GATED_STAGES;
    const checkPrepressGate = (jobId: string, nextStatus: string) => checkPressGate(prisma, jobId, nextStatus);

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
      "paymentNotes", "prepressNotes", "generalNotes", "plantLocation", "artworkStatus",
      // FileMaker ticket fields (Darrin 11/20)
      "repJobNumber", "dueTime", "proofsNote", "mailDate", "mailDropCity", "mailWeight", "mailPostage",
    ];
    const boolFields = [
      "fscCertified", "pressCheck", "ledInk", "binderyScore", "binderyPerf",
      "binderyDrill", "binderyPad", "binderyFold", "binderyCount", "binderyStitch",
      "binderyCollate", "binderyPockets", "binderyGlue", "binderyWrap",
      "samplesRequired", "samplesChecked", "softCover", "plusCover", "hasBleeds",
    ];
    const intFields = ["numPages", "numberUp", "makeReadyCount", "firstPassCount", "finalPressCount", "deliveryQty", "partialQty", "mailQty", "samplesQty"];
    const floatFields = ["flatSizeWidth", "flatSizeHeight", "finishedWidth", "finishedHeight", "aaCharges"];

    // The job page sends "packaging"; the column is deliveryPackaging (it never saved before 11/20).
    if (updates.packaging !== undefined && updates.deliveryPackaging === undefined) updates.deliveryPackaging = updates.packaging;
    for (const f of stringFields) { if (updates[f] !== undefined) updateData[f] = typeof updates[f] === "boolean" ? null : updates[f] === null ? null : String(updates[f]).slice(0, 2000) || null; }
    if (updates.partialDue !== undefined) updateData.partialDue = updates.partialDue ? new Date(updates.partialDue) : null;
    // Bindery lines: text next to each box, like FileMaker ("Wrap: 100'S").
    const BIND = ["score", "perf", "drill", "pad", "fold", "count", "stitch", "collate", "pockets", "glue", "wrap", "other"];
    if (updates.binderyValues !== undefined) {
      const bv: Record<string, string> = {};
      for (const k of BIND) { const v = String(updates.binderyValues?.[k] ?? "").trim().slice(0, 400); if (v) bv[k] = v; }
      updateData.binderyValues = bv;
    }
    // Stock rows: Size / Quantity / Stock Description (+ a second line, e.g. the price).
    if (updates.stockLines !== undefined) {
      const rows = Array.isArray(updates.stockLines) ? updates.stockLines : [];
      updateData.stockLines = rows.slice(0, 10).map((r: any) => ({ size: String(r?.size ?? "").slice(0, 40), qty: String(r?.qty ?? "").slice(0, 20), description: String(r?.description ?? "").slice(0, 300), detail: String(r?.detail ?? "").slice(0, 300) })).filter((r: any) => r.size || r.qty || r.description || r.detail);
    }
    // CSR / Sales picked by name on the job page (they never saved before 11/20).
    for (const [k, col] of [["csrName", "csrId"], ["salesRepName", "salesRepId"]] as const) {
      if (updates[k] === undefined) continue;
      const nm = String(updates[k] || "").trim();
      if (!nm || nm === "Unassigned") { updateData[col] = null; continue; }
      const u = await prisma.user.findFirst({ where: { name: nm, isActive: true }, select: { id: true } });
      if (u) updateData[col] = u.id;
    }
    // Customer # lives on the customer (it prints on every ticket).
    if (updates.customerNumber !== undefined) {
      const j0 = await prisma.job.findUnique({ where: { id }, select: { order: { select: { companyId: true } } } });
      if (j0?.order?.companyId) await prisma.company.update({ where: { id: j0.order.companyId }, data: { customerNumber: String(updates.customerNumber || "").trim().slice(0, 40) || null } as any });
    }
    for (const f of boolFields) { if (updates[f] !== undefined) updateData[f] = Boolean(updates[f]); }
    for (const f of intFields) { if (updates[f] !== undefined) updateData[f] = parseInt(updates[f]) || null; }
    for (const f of floatFields) { if (updates[f] !== undefined) updateData[f] = parseFloat(updates[f]) || null; }

    if (updates.quantity) updateData.quantity = parseInt(updates.quantity);
    if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
    if (updates.priority) updateData.priority = updates.priority;
    if (updates.proofDate) updateData.proofDate = new Date(updates.proofDate);
    if (updates.quotedPrice !== undefined) updateData.quotedPrice = parseFloat(updates.quotedPrice) || null;
    if (updates.paymentTerms !== undefined && ["deposit50", "prepaid", "net30", "cod"].includes(updates.paymentTerms)) updateData.paymentTerms = updates.paymentTerms;

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
