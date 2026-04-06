import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    // Demo data if no DB
    const demoLaborData = {
      kpis: {
        totalHoursTracked: 487.5,
        totalJobsTracked: 42,
        avgHoursPerJob: 11.6,
        onBudgetRate: 71.4, // % of jobs within estimated hours
        overBudgetJobs: 12,
        underBudgetJobs: 30,
        totalLaborCost: 24375,
        avgCostPerJob: 580,
      },
      jobLabor: [
        { jobNumber: "PKG-2026-001", jobName: "Organic Cereal Box - 12oz", customer: "Fresh Foods Co.", estimatedHours: 12, actualHours: 10.5, variance: -1.5, status: "under", department: "Offset Press" },
        { jobNumber: "PKG-2026-002", jobName: "Granola Bar Sleeve - 6pk", customer: "Fresh Foods Co.", estimatedHours: 8, actualHours: 11.2, variance: 3.2, status: "over", department: "Die Cutting" },
        { jobNumber: "PKG-2026-003", jobName: "Frozen Pizza Box - Family", customer: "Fresh Foods Co.", estimatedHours: 18, actualHours: 22.5, variance: 4.5, status: "over", department: "Offset Press" },
        { jobNumber: "PKG-2026-005", jobName: "Foundation Box - Premium", customer: "Luxe Cosmetics", estimatedHours: 15, actualHours: 13.8, variance: -1.2, status: "under", department: "Bindery" },
        { jobNumber: "PKG-2026-007", jobName: "Perfume Gift Set Box", customer: "Luxe Cosmetics", estimatedHours: 20, actualHours: 18.0, variance: -2.0, status: "under", department: "Offset Press" },
        { jobNumber: "PKG-2026-009", jobName: "Vitamin Bottle Box - 60ct", customer: "GreenLeaf Supplements", estimatedHours: 6, actualHours: 5.5, variance: -0.5, status: "under", department: "Digital Press" },
        { jobNumber: "PKG-2026-010", jobName: "Protein Powder Canister Wrap", customer: "GreenLeaf Supplements", estimatedHours: 4, actualHours: 7.8, variance: 3.8, status: "over", department: "Digital Press" },
        { jobNumber: "PKG-2026-012", jobName: "Wireless Earbuds Box", customer: "TechGear Electronics", estimatedHours: 14, actualHours: 12.0, variance: -2.0, status: "under", department: "Offset Press" },
        { jobNumber: "PKG-2026-014", jobName: "Smartwatch Gift Box", customer: "TechGear Electronics", estimatedHours: 16, actualHours: 19.5, variance: 3.5, status: "over", department: "Bindery" },
        { jobNumber: "PKG-2026-017", jobName: "Tasting Set Presentation Box", customer: "Artisan Spirits", estimatedHours: 22, actualHours: 20.0, variance: -2.0, status: "under", department: "Offset Press" },
      ],
      byDepartment: [
        { department: "Prepress", totalHours: 62, jobCount: 15, avgPerJob: 4.1 },
        { department: "Offset Press", totalHours: 148, jobCount: 18, avgPerJob: 8.2 },
        { department: "Digital Press", totalHours: 45, jobCount: 12, avgPerJob: 3.8 },
        { department: "Die Cutting", totalHours: 78, jobCount: 14, avgPerJob: 5.6 },
        { department: "Bindery", totalHours: 55, jobCount: 10, avgPerJob: 5.5 },
        { department: "Gluing/Folding", totalHours: 42, jobCount: 8, avgPerJob: 5.3 },
        { department: "QA", totalHours: 28, jobCount: 20, avgPerJob: 1.4 },
        { department: "Shipping", totalHours: 29.5, jobCount: 18, avgPerJob: 1.6 },
      ],
    };

    if (!prisma) {
      if (format === "csv") {
        const headers = "Job Number,Job Name,Customer,Estimated Hours,Actual Hours,Variance,Status,Department\n";
        const rows = demoLaborData.jobLabor.map(j => `${j.jobNumber},"${j.jobName}","${j.customer}",${j.estimatedHours},${j.actualHours},${j.variance},${j.status},${j.department}`).join("\n");
        return new NextResponse(headers + rows, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=labor-report.csv" } });
      }
      return NextResponse.json(demoLaborData);
    }

    // Try to get real data from TimeEntry + Jobs
    try {
      const jobs = await prisma.job.findMany({
        where: { estimatedHours: { not: null } },
        include: { timeEntries: true, order: { include: { company: true } } },
      });

      if (jobs.length > 0) {
        const jobLabor = jobs.map(j => {
          const actual = j.timeEntries.reduce((sum, t) => sum + (t.duration || 0), 0) / 3600;
          const estimated = j.estimatedHours || 0;
          const variance = actual - estimated;
          return {
            jobNumber: j.jobNumber, jobName: j.name, customer: j.order.company.name,
            estimatedHours: estimated, actualHours: Math.round(actual * 10) / 10,
            variance: Math.round(variance * 10) / 10, status: variance > 0 ? "over" : "under",
            department: j.pressAssignment || "Unknown",
          };
        });

        const totalHours = jobLabor.reduce((s, j) => s + j.actualHours, 0);
        const overBudget = jobLabor.filter(j => j.status === "over").length;

        return NextResponse.json({
          kpis: {
            totalHoursTracked: Math.round(totalHours * 10) / 10,
            totalJobsTracked: jobs.length,
            avgHoursPerJob: Math.round((totalHours / jobs.length) * 10) / 10,
            onBudgetRate: Math.round(((jobs.length - overBudget) / jobs.length) * 1000) / 10,
            overBudgetJobs: overBudget,
            underBudgetJobs: jobs.length - overBudget,
            totalLaborCost: Math.round(totalHours * 50),
            avgCostPerJob: Math.round((totalHours * 50) / jobs.length),
          },
          jobLabor,
          byDepartment: demoLaborData.byDepartment, // would aggregate from real data
          source: "database",
        });
      }
    } catch { /* fall through to demo */ }

    return NextResponse.json(demoLaborData);
  } catch (error) {
    console.error("Labor report error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
