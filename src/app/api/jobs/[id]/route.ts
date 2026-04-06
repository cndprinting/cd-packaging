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
      const { demoJobs } = await import("@/lib/demo-data");
      const job = demoJobs.find((j) => j.id === id);
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      return NextResponse.json({ job, source: "demo" });
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: { order: { include: { company: true } }, stages: true, proofs: true },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job, source: "database" });
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

    // Advance to next stage
    if (action === "advance") {
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const currentIndex = STAGES.indexOf(job.status as typeof STAGES[number]);
      if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
        return NextResponse.json({ error: "Cannot advance past final stage" }, { status: 400 });
      }

      const nextStatus = STAGES[currentIndex + 1];
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
      const updated = await prisma.job.update({
        where: { id },
        data: { status: updates.status },
        include: { order: { include: { company: true } } },
      });
      await prisma.order.update({ where: { id: updated.orderId }, data: { status: updates.status } });
      return NextResponse.json({ job: updated });
    }

    // General update
    const updateData: Record<string, unknown> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.quantity) updateData.quantity = parseInt(updates.quantity);
    if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
    if (updates.priority) updateData.priority = updates.priority;

    const updated = await prisma.job.update({
      where: { id },
      data: updateData,
      include: { order: { include: { company: true } } },
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    console.error("Job PUT error:", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "PRODUCTION_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Job DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
