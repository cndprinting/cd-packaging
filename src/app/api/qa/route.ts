import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER" || session.role === "SALES_REP") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { jobId, action, notes } = await request.json();
    if (!jobId || !action) return NextResponse.json({ error: "Job ID and action required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    let newStatus: string;
    if (action === "pass") {
      newStatus = "PACKED";
    } else if (action === "hold") {
      newStatus = "QA"; // stays in QA
      // Create alert for QA hold
      await prisma.alert.create({
        data: { jobId, type: "QA_HOLD", severity: "WARNING", message: `${job.jobNumber} placed on QA hold${notes ? ': ' + notes : ''}`, userId: session.id },
      });
    } else if (action === "fail") {
      newStatus = "PRINTING"; // sent back to production
      await prisma.alert.create({
        data: { jobId, type: "QA_HOLD", severity: "CRITICAL", message: `${job.jobNumber} failed QA${notes ? ': ' + notes : ''} - sent back to production`, userId: session.id },
      });
    } else {
      return NextResponse.json({ error: "Invalid action. Use: pass, hold, fail" }, { status: 400 });
    }

    const JobStatus = (await import("@/generated/prisma")).JobStatus;
    const statusEnum = newStatus as keyof typeof JobStatus;
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus[statusEnum] },
      include: { order: { include: { company: true } } },
    });

    await prisma.order.update({ where: { id: updated.orderId }, data: { status: JobStatus[statusEnum] } });

    return NextResponse.json({ job: updated, action, newStatus });
  } catch (error) {
    console.error("QA POST error:", error);
    return NextResponse.json({ error: "Failed to process QA action" }, { status: 500 });
  }
}
