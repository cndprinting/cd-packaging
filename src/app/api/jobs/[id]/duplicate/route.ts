import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    // Load source job with related data
    const sourceJob = await prisma.job.findUnique({
      where: { id },
      include: {
        order: { include: { company: true } },
        lineItems: true,
        pressRuns: true,
      },
    });

    if (!sourceJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Kelsey 11/20/26: most jobs start as a copy of the customer's last one. The CSR gives
    // the new FileMaker job #, quantity and due date; everything else on the ticket carries over.
    const body = await request.json().catch(() => ({}));
    const wanted = String(body.jobNumber || "").trim().slice(0, 40);
    if (wanted && await prisma.job.findUnique({ where: { jobNumber: wanted } })) return NextResponse.json({ error: `Job ${wanted} already exists` }, { status: 409 });
    const newQty = Math.round(Number(String(body.quantity ?? "").replace(/,/g, ""))) || sourceJob.quantity;
    const newDue = body.dueDate ? new Date(body.dueDate) : null;
    // Generate new order and job numbers with collision fallback.
    const ts = Date.now().toString().slice(-6);
    const orderCount = await prisma.order.count();
    const candidateOrder = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;
    const existingOrderCollision = await prisma.order.findUnique({ where: { orderNumber: candidateOrder } });
    const orderNumber = existingOrderCollision ? `ORD-${ts}` : candidateOrder;

    const jobCount = await prisma.job.count();
    const candidateJob = `PKG-2026-${String(jobCount + 100).padStart(3, "0")}`;
    const existingJobCollision = await prisma.job.findUnique({ where: { jobNumber: candidateJob } });
    const jobNumber = wanted || (existingJobCollision ? `PKG-2026-${ts}` : candidateJob);

    // Create new order linked to the same company
    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        companyId: sourceJob.order.companyId,
        status: "ARTWORK_RECEIVED",
        priority: sourceJob.priority,
        dueDate: newDue,
      },
    });

    // Create the duplicated job
    const newJob = await prisma.job.create({
      data: {
        jobNumber,
        orderId: newOrder.id,
        name: sourceJob.name,
        description: sourceJob.description,
        priority: sourceJob.priority,
        quantity: newQty,
        dueDate: newDue,
        productType: sourceJob.productType,
        status: "ARTWORK_RECEIVED",
        csrId: session.role === "CSR" ? session.id : sourceJob.csrId,
        salesRepId: sourceJob.salesRepId,
        paymentTerms: (sourceJob as any).paymentTerms,
        hardProof: (sourceJob as any).hardProof,
        artworkStatus: "reprint",
        // FileMaker ticket fields (11/20)
        proofsNote: (sourceJob as any).proofsNote, mailDate: null, mailQty: null, mailDropCity: (sourceJob as any).mailDropCity,
        mailWeight: (sourceJob as any).mailWeight, mailPostage: null, samplesQty: (sourceJob as any).samplesQty,
        binderyValues: (sourceJob as any).binderyValues ?? undefined, stockLines: (sourceJob as any).stockLines ?? undefined,
        dueTime: null, partialQty: null, partialDue: null, repJobNumber: null,

        // Reprint linkage
        jobType: body.jobType && ["EXACT_REPRINT", "REPRINT_WITH_CHANGES", "REPRINT_NEW_FILE"].includes(body.jobType) ? body.jobType : "EXACT_REPRINT",
        lastJobNumber: sourceJob.jobNumber,

        // Contact / reference
        contactName: sourceJob.contactName,
        customerPO: null, // new job gets new PO
        estimateNumber: sourceJob.estimateNumber,
        repName: sourceJob.repName,
        numPages: sourceJob.numPages,

        // Stock & Materials
        stockDescription: sourceJob.stockDescription,
        fscCertified: sourceJob.fscCertified,
        blanketNumber: sourceJob.blanketNumber,
        dieNumber: sourceJob.dieNumber,
        paperSource: sourceJob.paperSource,

        // Size Specs
        flatSizeWidth: sourceJob.flatSizeWidth,
        flatSizeHeight: sourceJob.flatSizeHeight,
        finishedWidth: sourceJob.finishedWidth,
        finishedHeight: sourceJob.finishedHeight,
        inkFront: sourceJob.inkFront,
        inkBack: sourceJob.inkBack,
        varnish: sourceJob.varnish,
        coating: sourceJob.coating,

        // Press Info
        pressAssignment: sourceJob.pressAssignment,
        pressFormat: sourceJob.pressFormat,
        imposition: sourceJob.imposition,
        numberUp: sourceJob.numberUp,
        runningSize: sourceJob.runningSize,
        makeReadyCount: sourceJob.makeReadyCount,
        firstPassCount: null, // clear production data
        finalPressCount: null,
        pressmanInitials: null,
        pressCheck: sourceJob.pressCheck,
        ledInk: sourceJob.ledInk,

        // Bindery
        binderyScore: sourceJob.binderyScore,
        binderyPerf: sourceJob.binderyPerf,
        binderyDrill: sourceJob.binderyDrill,
        binderyPad: sourceJob.binderyPad,
        binderyFold: sourceJob.binderyFold,
        binderyCount: sourceJob.binderyCount,
        binderyStitch: sourceJob.binderyStitch,
        binderyCollate: sourceJob.binderyCollate,
        binderyPockets: sourceJob.binderyPockets,
        binderyGlue: sourceJob.binderyGlue,
        binderyWrap: sourceJob.binderyWrap,
        binderyOther: sourceJob.binderyOther,
        binderyNotes: sourceJob.binderyNotes,

        // Delivery
        deliveryQty: newQty,
        deliveryPackaging: sourceJob.deliveryPackaging,
        deliveryTo: sourceJob.deliveryTo,

        // Samples
        samplesRequired: sourceJob.samplesRequired,
        samplesTo: sourceJob.samplesTo,
        samplesChecked: false, // clear

        // Notes / misc
        vendorInfo: sourceJob.vendorInfo,
        pressNotes: sourceJob.pressNotes,
        prepressNotes: sourceJob.prepressNotes,
        generalNotes: sourceJob.generalNotes,
        softCover: sourceJob.softCover,
        plusCover: sourceJob.plusCover,
        hasBleeds: sourceJob.hasBleeds,

        // Cleared fields
        quoteRequestId: null,
        aaCharges: null,
        proofDate: null,
        enteredDate: null,
        paymentNotes: null,
        quotedPrice: Number(String(body.quotedPrice ?? "").replace(/[$,\s]/g, "")) || null, // new sell price (drives the deposit invoice)
        estimatedCost: null,
        actualCost: null,
        actualHours: null,
      },
    });

    // Copy line items (skip pressRuns — those are production data)
    if (sourceJob.lineItems.length > 0) {
      await prisma.jobLineItem.createMany({
        data: sourceJob.lineItems.map((li) => ({
          jobId: newJob.id,
          productCode: li.productCode,
          batchNumber: li.batchNumber,
          quantity: li.quantity,
          description: li.description,
          flatSize: li.flatSize,
          finishedWidth: li.finishedWidth,
          finishedHeight: li.finishedHeight,
          inkSpec: li.inkSpec,
          poNumber: li.poNumber,
          sortOrder: li.sortOrder,
        })),
      });
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        orderId: newOrder.id,
        userId: session.id,
        action: "JOB_DUPLICATED",
        details: `Duplicated job ${sourceJob.jobNumber} as reprint → ${jobNumber}`,
      },
    }).catch(() => {});

    // Same as entering a new job: Darrin's notice + the deposit invoice when the terms need one.
    try { const { notifyPlantNewJob } = await import("@/lib/routing"); await notifyPlantNewJob(prisma, newJob.id, { name: session.name, email: session.email }); } catch (e) { console.error("plant notice failed", e); }
    try { const { draftDepositInvoice } = await import("@/lib/press-gate"); await draftDepositInvoice(prisma, newJob.id, { byName: session.name, byEmail: session.email }); } catch (e) { console.error("deposit draft failed", e); }

    return NextResponse.json({ job: { id: newJob.id, jobNumber: newJob.jobNumber } });
  } catch (error) {
    console.error("Job duplicate error:", error);
    return NextResponse.json({ error: "Failed to duplicate job" }, { status: 500 });
  }
}
