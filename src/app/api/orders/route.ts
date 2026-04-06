import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ orders: [], source: "empty" });
    }

    const orders = await prisma.order.findMany({
      include: { company: true, items: true, jobs: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orders: orders.map(o => ({
      id: o.id, orderNumber: o.orderNumber, companyName: o.company.name, companyId: o.companyId,
      status: o.status, priority: o.priority, dueDate: o.dueDate?.toISOString().split("T")[0] || "",
      itemCount: o.items.length, poNumber: o.poNumber, notes: o.notes,
    })), source: "database" });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { companyId, customerName, poNumber, dueDate, priority, notes, items } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && customerName) {
      const slug = customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      let company = await prisma.company.findUnique({ where: { slug } });
      if (!company) company = await prisma.company.create({ data: { name: customerName, slug } });
      resolvedCompanyId = company.id;
    }
    if (!resolvedCompanyId) return NextResponse.json({ error: "Customer is required" }, { status: 400 });

    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderNumber, companyId: resolvedCompanyId, poNumber, status: "QUOTE",
        priority: priority || "NORMAL", dueDate: dueDate ? new Date(dueDate) : undefined, notes,
      },
      include: { company: true },
    });

    // Create jobs for each item
    if (items && Array.isArray(items)) {
      const jobCount = await prisma.job.count();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const jobNumber = `PKG-2026-${String(jobCount + i + 100).padStart(3, "0")}`;
        await prisma.job.create({
          data: {
            jobNumber, orderId: order.id, name: item.name || `Item ${i + 1}`,
            description: item.description, status: "QUOTE", priority: priority || "NORMAL",
            quantity: parseInt(item.quantity) || 1, dueDate: dueDate ? new Date(dueDate) : null,
          },
        });
      }
    }

    await prisma.activityLog.create({ data: { orderId: order.id, userId: session.id, action: "ORDER_CREATED", details: `Created order ${order.orderNumber}` } }).catch(() => {});
    return NextResponse.json({ order: { id: order.id, orderNumber: order.orderNumber, companyName: order.company.name } });
  } catch (error) {
    console.error("Orders POST error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
