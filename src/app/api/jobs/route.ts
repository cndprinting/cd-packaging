import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      // Demo mode - return demo jobs
      const { demoJobs } = await import("@/lib/demo-data");
      return NextResponse.json({ jobs: demoJobs, source: "demo" });
    }

    const jobs = await prisma.job.findMany({
      include: { order: { include: { company: true } } },
      orderBy: { createdAt: "desc" },
    });

    const formatted = jobs.map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      orderId: j.orderId,
      orderNumber: j.order.orderNumber,
      name: j.name,
      description: j.description,
      companyId: j.order.companyId,
      companyName: j.order.company.name,
      status: j.status,
      priority: j.priority,
      quantity: j.quantity,
      dueDate: j.dueDate?.toISOString().split("T")[0] || "",
      csrName: "",
      salesRepName: "",
      productionOwnerName: "",
      isLate: j.dueDate ? j.dueDate < new Date() && !["SHIPPED", "DELIVERED", "INVOICED"].includes(j.status) : false,
      isBlocked: false,
    }));

    return NextResponse.json({ jobs: formatted, source: "database" });
  } catch (error) {
    console.error("Jobs GET error:", error);
    const { demoJobs } = await import("@/lib/demo-data");
    return NextResponse.json({ jobs: demoJobs, source: "demo" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role === "CUSTOMER") {
      return NextResponse.json({ error: "Customers cannot create jobs" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, quantity, dueDate, priority, companyId, customerName, productType, estimatedHours } = body;

    if (!name || !quantity) {
      return NextResponse.json({ error: "Job name and quantity are required" }, { status: 400 });
    }

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Find or create company
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && customerName) {
      const slug = customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      let company = await prisma.company.findUnique({ where: { slug } });
      if (!company) {
        company = await prisma.company.create({ data: { name: customerName, slug } });
      }
      resolvedCompanyId = company.id;
    }

    if (!resolvedCompanyId) {
      // Use first customer company as default
      const defaultCompany = await prisma.company.findFirst({ where: { type: "customer" } });
      resolvedCompanyId = defaultCompany?.id;
      if (!resolvedCompanyId) {
        return NextResponse.json({ error: "No customer company found. Create one first." }, { status: 400 });
      }
    }

    // Generate job number
    const jobCount = await prisma.job.count();
    const jobNumber = `PKG-2026-${String(jobCount + 100).padStart(3, "0")}`;

    // Generate order number and create order
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        companyId: resolvedCompanyId,
        status: "QUOTE",
        priority: priority || "NORMAL",
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
    });

    const job = await prisma.job.create({
      data: {
        jobNumber,
        orderId: order.id,
        name,
        description: description || null,
        status: "QUOTE",
        priority: priority || "NORMAL",
        quantity: parseInt(quantity),
        dueDate: dueDate ? new Date(dueDate) : null,
        productType: productType === "COMMERCIAL_PRINT" ? "COMMERCIAL_PRINT" : "FOLDING_CARTON",
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      },
      include: { order: { include: { company: true } } },
    });

    // Activity log
    await prisma.activityLog.create({
      data: { orderId: order.id, userId: session.id, action: "JOB_CREATED", details: `Created job ${jobNumber}: ${name}` },
    }).catch(() => {});

    // Auto-flag outside purchases based on job type
    const autoFlags = [];
    // Every job needs paper/substrate
    autoFlags.push({ jobId: job.id, category: "paper", description: `Substrate for ${name} - ${quantity} units`, status: "needed" });
    // Every job needs ink
    autoFlags.push({ jobId: job.id, category: "ink", description: `Process inks for ${name}`, status: "needed" });
    // Folding cartons need cutting dies
    if (productType !== "COMMERCIAL_PRINT") {
      autoFlags.push({ jobId: job.id, category: "cutting_die", description: `Cutting die for ${name}`, status: "needed" });
    }
    // Create all purchase flags
    if (autoFlags.length > 0) await prisma.purchaseFlag.createMany({ data: autoFlags }).catch(() => {});

    return NextResponse.json({
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        orderId: job.orderId,
        orderNumber: order.orderNumber,
        name: job.name,
        description: job.description,
        companyId: resolvedCompanyId,
        companyName: job.order.company.name,
        status: job.status,
        priority: job.priority,
        quantity: job.quantity,
        dueDate: job.dueDate?.toISOString().split("T")[0] || "",
        isLate: false,
        isBlocked: false,
      },
    });
  } catch (error) {
    console.error("Jobs POST error:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
