import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Fast-track a quote request into a placeholder job, bypassing the estimator.
// Purpose: let CSRs test the downstream job ticket / production flow without
// waiting for Mary to finish estimating. The resulting job is a stub (no real
// cost data) and is flagged in its description so it's obvious.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const qr = await prisma.quoteRequest.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!qr) return NextResponse.json({ error: "Quote request not found" }, { status: 404 });

    // Resolve company
    let companyId = qr.companyId;
    if (!companyId && qr.customerName) {
      const slug = qr.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      let company = await prisma.company.findUnique({ where: { slug } });
      if (!company) company = await prisma.company.create({ data: { name: qr.customerName, slug } });
      companyId = company.id;
    }
    if (!companyId) {
      const defaultCompany = await prisma.company.findFirst({ where: { type: "customer" } });
      companyId = defaultCompany?.id || null;
    }
    if (!companyId) return NextResponse.json({ error: "No customer company available" }, { status: 400 });

    // Generate order + job numbers
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;
    const jobCount = await prisma.job.count();
    const jobNumber = `PKG-2026-${String(jobCount + 100).padStart(3, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        companyId,
        status: "QUOTE",
        priority: "NORMAL",
        dueDate: qr.dateNeeded || undefined,
      },
    });

    const totalQty = qr.lineItems.reduce((s, li) => s + (li.quantity || 0), 0) || (qr.quantity1 || 0) || 1;
    const jobName = qr.jobTitle || qr.descriptionType || `Fast-track from ${qr.requestNumber}`;

    const job = await prisma.job.create({
      data: {
        jobNumber,
        orderId: order.id,
        name: jobName,
        description: `[Fast-tracked from ${qr.requestNumber}] ${qr.specialInstructions || ""}`.trim(),
        status: "QUOTE",
        priority: "NORMAL",
        quantity: totalQty,
        dueDate: qr.dateNeeded || null,
        productType: qr.descriptionType === "folding_carton" ? "FOLDING_CARTON" : "COMMERCIAL_PRINT",
      },
    });

    // Copy line items to job line items
    if (qr.lineItems.length > 0) {
      await prisma.jobLineItem.createMany({
        data: qr.lineItems.map((li, idx) => ({
          jobId: job.id,
          description: li.version,
          quantity: li.quantity,
          sortOrder: idx,
        })),
      }).catch(() => {});
    }

    // Mark quote request as completed so it moves out of the active queue
    await prisma.quoteRequest.update({
      where: { id },
      data: { status: "completed" },
    });

    await prisma.activityLog.create({
      data: {
        orderId: order.id,
        userId: session.id,
        action: "JOB_CREATED",
        details: `Fast-tracked job ${jobNumber} from quote request ${qr.requestNumber}`,
      },
    }).catch(() => {});

    return NextResponse.json({ job: { id: job.id, jobNumber: job.jobNumber } });
  } catch (error) {
    console.error("Fast-track error:", error);
    return NextResponse.json({ error: "Failed to fast-track" }, { status: 500 });
  }
}
