import { NextResponse } from "next/server";
import { analyzeReorders, generateInsights } from "@/lib/smart-features";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ insights: [], reorderAlerts: [] });

    const [companies, orders, jobs, quotes, materials] = await Promise.all([
      prisma.company.findMany({ where: { type: "customer" }, select: { id: true, name: true } }),
      prisma.order.findMany({ select: { id: true, companyId: true, createdAt: true } }),
      prisma.job.findMany({ select: { id: true, status: true, dueDate: true } }),
      prisma.quote.findMany({ where: { status: "SENT" }, select: { id: true } }),
      prisma.material.findMany({ select: { id: true, reorderPoint: true } }),
    ]);

    const now = new Date();
    const overdueJobs = jobs.filter(j => j.dueDate && new Date(j.dueDate) < now && !["DELIVERED", "INVOICED", "SHIPPED"].includes(j.status)).length;
    const blockedJobs = 0; // Would need a blocked status
    const lowStockItems = 0; // Would need inventory lots
    const pendingQuotes = quotes.length;

    // Reorder analysis
    const reorderAlerts = analyzeReorders(
      companies,
      orders.map(o => ({ companyId: o.companyId, createdAt: o.createdAt.toISOString() }))
    );

    // Count inactive customers (no order in 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const customersWithRecentOrders = new Set(
      orders.filter(o => new Date(o.createdAt) > ninetyDaysAgo).map(o => o.companyId)
    );
    const inactiveCustomers90Days = companies.filter(c => orders.some(o => o.companyId === c.id) && !customersWithRecentOrders.has(c.id)).length;

    // Jobs completed this week
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const jobsCompletedThisWeek = jobs.filter(j => j.status === "DELIVERED" || j.status === "INVOICED").length; // Simplified

    const insights = generateInsights({
      overdueJobs,
      blockedJobs,
      lowStockItems,
      pendingQuotes,
      reorderAlerts: reorderAlerts.filter(r => r.isOverdue).length,
      inactiveCustomers90Days,
      jobsCompletedThisWeek,
      revenueThisMonth: 0,
    });

    return NextResponse.json({ insights, reorderAlerts: reorderAlerts.slice(0, 20) });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json({ insights: [], reorderAlerts: [] });
  }
}
