import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Pre-press queue: two buckets
//   Rack (incoming)     → ARTWORK_RECEIVED, STRUCTURAL_DESIGN, PROOFING, PREPRESS, PLATING
//   Okay to Print       → CUSTOMER_APPROVAL (approved, waiting to be scheduled)
// 24-hour proof SLA is measured from when the job entered the rack.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ rack: [], okayToPrint: [] });

    const rackStages = ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "PREPRESS", "PLATING"] as const;
    const approvedStages = ["CUSTOMER_APPROVAL"] as const;

    const jobs = await prisma.job.findMany({
      where: { status: { in: [...rackStages, ...approvedStages] } },
      include: { order: { include: { company: true } } },
      orderBy: { updatedAt: "asc" }, // oldest first — most urgent at top
    });

    const now = Date.now();
    const SLA_MS = 24 * 60 * 60 * 1000;

    const format = (j: typeof jobs[number]) => {
      const enteredMs = j.updatedAt.getTime();
      const ageMs = now - enteredMs;
      const ageHours = ageMs / (60 * 60 * 1000);
      let slaState: "ok" | "warning" | "overdue";
      if (ageMs > SLA_MS) slaState = "overdue";
      else if (ageMs > SLA_MS * 0.5) slaState = "warning";
      else slaState = "ok";

      return {
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        customer: j.order.company.name,
        status: j.status,
        priority: j.priority,
        quantity: j.quantity,
        dueDate: j.dueDate?.toISOString().split("T")[0] || null,
        stockDescription: j.stockDescription,
        numPages: j.numPages,
        pressAssignment: j.pressAssignment,
        enteredStageAt: j.updatedAt.toISOString(),
        ageHours: Math.round(ageHours * 10) / 10,
        slaState,
      };
    };

    const rack = jobs.filter(j => (rackStages as readonly string[]).includes(j.status)).map(format);
    const okayToPrint = jobs.filter(j => (approvedStages as readonly string[]).includes(j.status)).map(format);

    return NextResponse.json({ rack, okayToPrint });
  } catch (error) {
    console.error("Pre-press GET error:", error);
    return NextResponse.json({ rack: [], okayToPrint: [] });
  }
}
