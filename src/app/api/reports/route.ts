import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "late-jobs";

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    if (!prisma) {
      return new NextResponse("No data available\n", {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${type}-report.csv"` },
      });
    }

    const jobs = await prisma.job.findMany({
      include: { order: { include: { company: true } } },
      orderBy: { dueDate: "asc" },
    });

    let filtered = jobs;
    if (type === "late-jobs") {
      filtered = jobs.filter(j => j.dueDate && j.dueDate < new Date() && !["SHIPPED", "DELIVERED", "INVOICED"].includes(j.status));
    } else if (type === "blocked-jobs") {
      // For now, return jobs in QA (would need blocker flag in real implementation)
      filtered = jobs.filter(j => j.status === "QA");
    }

    const headers = "Job Number,Name,Customer,Status,Priority,Quantity,Due Date\n";
    const rows = filtered.map(j =>
      `${j.jobNumber},"${j.name}","${j.order.company.name}",${j.status},${j.priority},${j.quantity},${j.dueDate?.toISOString().split("T")[0] || ""}`
    ).join("\n");

    return new NextResponse(headers + rows, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${type}-report.csv"` },
    });
  } catch (error) {
    console.error("Reports GET error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
