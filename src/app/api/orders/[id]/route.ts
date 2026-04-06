import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    if (!prisma) {
      const { demoJobs } = await import("@/lib/demo-data");
      const jobs = demoJobs.filter(j => j.orderId === id);
      if (jobs.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json({ order: { id, orderNumber: jobs[0].orderNumber, companyName: jobs[0].companyName, status: jobs[0].status, priority: jobs[0].priority, dueDate: jobs[0].dueDate }, jobs, source: "demo" });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { company: true, items: true, jobs: true, shipments: true, documents: true, comments: { include: { user: true } } },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order, source: "database" });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.priority) updateData.priority = body.priority;
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.poNumber !== undefined) updateData.poNumber = body.poNumber;

    const updated = await prisma.order.update({ where: { id }, data: updateData, include: { company: true } });
    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Order PUT error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
