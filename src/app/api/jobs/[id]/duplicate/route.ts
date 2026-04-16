import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Generate new order and job numbers
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;

    const jobCount = await prisma.job.count();
    const jobNumber = `PKG-2026-${String(jobCount + 100).padStart(3, "0")}`;

    // Create new order linked to the same company
    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        companyId: sourceJob.order.companyId,
        status: "QUOTE",
        priority: sourceJob.priority,
        dueDate: sourceJob.dueDate,
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
        quantity: sourceJob.quantity,
        dueDate: sourceJob.dueDate,
        productType: sourceJob.productType,
        status: "QUOTE",

        // Reprint linkage
        jobType: "EXACT_REPRINT",
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
        deliveryQty: sourceJob.quantity, // copy quantity
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
        softCover: sourceJob.softCover,
        plusCover: sourceJob.plusCover,
        hasBleeds: sourceJob.hasBleeds,

        // Cleared fields
        quoteRequestId: null,
        aaCharges: null,
        proofDate: null,
        enteredDate: null,
        paymentNotes: null,
        quotedPrice: null,
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

    return NextResponse.json({ job: { id: newJob.id, jobNumber: newJob.jobNumber } });
  } catch (error) {
    console.error("Job duplicate error:", error);
    return NextResponse.json({ error: "Failed to duplicate job" }, { status: 500 });
  }
}
