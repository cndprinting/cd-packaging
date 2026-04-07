import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const { status } = await request.json();
    if (!status) return NextResponse.json({ error: "Status required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const job = await prisma.job.update({
      where: { id },
      data: { status },
    });

    // Log the stage change
    try {
      const order = await prisma.job.findUnique({ where: { id }, select: { orderId: true } });
      if (order?.orderId) {
        await prisma.activityLog.create({
          data: {
            orderId: order.orderId,
            userId: session.id,
            action: "STAGE_ADVANCED",
            details: `Advanced job ${job.jobNumber} to ${status}`,
          },
        });
      }
    } catch { /* ignore logging errors */ }

    return NextResponse.json({ ok: true, status: job.status });
  } catch (error) {
    console.error("Job advance error:", error);
    return NextResponse.json({ error: "Failed to advance job" }, { status: 500 });
  }
}
