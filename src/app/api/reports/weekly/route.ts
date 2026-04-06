import { NextRequest, NextResponse } from "next/server";

function getReportData() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const reportPeriod = {
    start: weekAgo.toISOString().split("T")[0],
    end: now.toISOString().split("T")[0],
  };

  const kpis = {
    openJobs: 47,
    completedJobs: 38,
    newOrders: 22,
    onTimeRate: 91.2,
    avgCycleTime: 6.8,
    totalRevenue: 112450,
    totalCosts: 78240,
    margin: 30.4,
    prevWeek: {
      openJobs: 52,
      completedJobs: 34,
      newOrders: 19,
      onTimeRate: 88.5,
      avgCycleTime: 7.2,
      totalRevenue: 98700,
      totalCosts: 70100,
      margin: 29.0,
    },
  };

  const volumeByProduct = [
    { type: "Folding Carton", jobs: 24, units: 185000, revenue: 72800 },
    { type: "Commercial Print", jobs: 14, units: 42000, revenue: 39650 },
  ];

  const volumeByCustomer = [
    { name: "Pinnacle Foods Inc.", jobs: 8, units: 62000, revenue: 28400 },
    { name: "NorthStar Beverages", jobs: 6, units: 48000, revenue: 22150 },
    { name: "Heritage Cosmetics", jobs: 5, units: 35000, revenue: 19800 },
    { name: "Greenfield Organics", jobs: 4, units: 22000, revenue: 14300 },
    { name: "Summit Supplements", jobs: 3, units: 18000, revenue: 11600 },
  ];

  const departmentMetrics = [
    { name: "Prepress", jobsProcessed: 42, avgTimePerJob: 2.4, utilization: 87 },
    { name: "Printing", jobsProcessed: 38, avgTimePerJob: 3.1, utilization: 92 },
    { name: "Die Cutting", jobsProcessed: 36, avgTimePerJob: 1.8, utilization: 78 },
    { name: "Gluing & Folding", jobsProcessed: 34, avgTimePerJob: 2.2, utilization: 84 },
    { name: "Quality Assurance", jobsProcessed: 38, avgTimePerJob: 0.9, utilization: 65 },
    { name: "Shipping", jobsProcessed: 32, avgTimePerJob: 0.6, utilization: 58 },
  ];

  const salesSummary = {
    quotesCreated: 31,
    quotesApproved: 18,
    conversionRate: 58.1,
    pipelineValue: 284500,
  };

  const costBreakdown = [
    { category: "Materials", amount: 38200 },
    { category: "Labor", amount: 24600 },
    { category: "Overhead", amount: 10440 },
    { category: "Shipping", amount: 5000 },
  ];

  const weeklyTrend = [
    { week: "W49", jobs: 31, revenue: 87200, onTimeRate: 85.0 },
    { week: "W50", jobs: 35, revenue: 94800, onTimeRate: 87.3 },
    { week: "W51", jobs: 29, revenue: 78500, onTimeRate: 82.1 },
    { week: "W52", jobs: 33, revenue: 91400, onTimeRate: 89.0 },
    { week: "W01", jobs: 37, revenue: 102300, onTimeRate: 90.5 },
    { week: "W02", jobs: 34, revenue: 98700, onTimeRate: 88.5 },
    { week: "W03", jobs: 36, revenue: 105200, onTimeRate: 86.9 },
    { week: "W04", jobs: 38, revenue: 112450, onTimeRate: 91.2 },
  ];

  return {
    reportPeriod,
    kpis,
    volumeByProduct,
    volumeByCustomer,
    departmentMetrics,
    salesSummary,
    costBreakdown,
    weeklyTrend,
  };
}

function toCSV(data: ReturnType<typeof getReportData>): string {
  const lines: string[] = [];

  lines.push("C&D Packaging - Weekly Executive Report");
  lines.push(`Period: ${data.reportPeriod.start} to ${data.reportPeriod.end}`);
  lines.push("");

  lines.push("KPI SUMMARY");
  lines.push("Metric,Value");
  lines.push(`Total Revenue,$${data.kpis.totalRevenue.toLocaleString()}`);
  lines.push(`Total Costs,$${data.kpis.totalCosts.toLocaleString()}`);
  lines.push(`Margin,${data.kpis.margin}%`);
  lines.push(`Jobs Completed,${data.kpis.completedJobs}`);
  lines.push(`Open Jobs,${data.kpis.openJobs}`);
  lines.push(`New Orders,${data.kpis.newOrders}`);
  lines.push(`On-Time Rate,${data.kpis.onTimeRate}%`);
  lines.push(`Avg Cycle Time,${data.kpis.avgCycleTime} days`);
  lines.push("");

  lines.push("VOLUME BY PRODUCT TYPE");
  lines.push("Product Type,Jobs,Units,Revenue");
  data.volumeByProduct.forEach((p) => lines.push(`${p.type},${p.jobs},${p.units},$${p.revenue.toLocaleString()}`));
  lines.push("");

  lines.push("TOP CUSTOMERS");
  lines.push("Customer,Jobs,Units,Revenue");
  data.volumeByCustomer.forEach((c) => lines.push(`${c.name},${c.jobs},${c.units},$${c.revenue.toLocaleString()}`));
  lines.push("");

  lines.push("DEPARTMENT METRICS");
  lines.push("Department,Jobs Processed,Avg Time/Job (hrs),Utilization %");
  data.departmentMetrics.forEach((d) => lines.push(`${d.name},${d.jobsProcessed},${d.avgTimePerJob},${d.utilization}%`));
  lines.push("");

  lines.push("SALES PIPELINE");
  lines.push("Metric,Value");
  lines.push(`Quotes Created,${data.salesSummary.quotesCreated}`);
  lines.push(`Quotes Approved,${data.salesSummary.quotesApproved}`);
  lines.push(`Conversion Rate,${data.salesSummary.conversionRate}%`);
  lines.push(`Pipeline Value,$${data.salesSummary.pipelineValue.toLocaleString()}`);
  lines.push("");

  lines.push("COST BREAKDOWN");
  lines.push("Category,Amount");
  data.costBreakdown.forEach((c) => lines.push(`${c.category},$${c.amount.toLocaleString()}`));
  lines.push("");

  lines.push("8-WEEK TREND");
  lines.push("Week,Jobs,Revenue,On-Time Rate");
  data.weeklyTrend.forEach((w) => lines.push(`${w.week},${w.jobs},$${w.revenue.toLocaleString()},${w.onTimeRate}%`));

  return lines.join("\n");
}

function toTSV(data: ReturnType<typeof getReportData>): string {
  const lines: string[] = [];

  lines.push("C&D Packaging - Weekly Executive Report");
  lines.push(`Period: ${data.reportPeriod.start} to ${data.reportPeriod.end}`);
  lines.push("");

  lines.push("KPI SUMMARY");
  lines.push("Metric\tValue\tPrev Week\tChange");
  lines.push(`Total Revenue\t$${data.kpis.totalRevenue.toLocaleString()}\t$${data.kpis.prevWeek.totalRevenue.toLocaleString()}\t${(((data.kpis.totalRevenue - data.kpis.prevWeek.totalRevenue) / data.kpis.prevWeek.totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`Total Costs\t$${data.kpis.totalCosts.toLocaleString()}\t$${data.kpis.prevWeek.totalCosts.toLocaleString()}\t${(((data.kpis.totalCosts - data.kpis.prevWeek.totalCosts) / data.kpis.prevWeek.totalCosts) * 100).toFixed(1)}%`);
  lines.push(`Margin\t${data.kpis.margin}%\t${data.kpis.prevWeek.margin}%\t${(data.kpis.margin - data.kpis.prevWeek.margin).toFixed(1)}pp`);
  lines.push(`Jobs Completed\t${data.kpis.completedJobs}\t${data.kpis.prevWeek.completedJobs}\t${data.kpis.completedJobs - data.kpis.prevWeek.completedJobs}`);
  lines.push(`On-Time Rate\t${data.kpis.onTimeRate}%\t${data.kpis.prevWeek.onTimeRate}%\t${(data.kpis.onTimeRate - data.kpis.prevWeek.onTimeRate).toFixed(1)}pp`);
  lines.push(`Avg Cycle Time\t${data.kpis.avgCycleTime} days\t${data.kpis.prevWeek.avgCycleTime} days\t${(data.kpis.avgCycleTime - data.kpis.prevWeek.avgCycleTime).toFixed(1)} days`);
  lines.push("");

  lines.push("VOLUME BY PRODUCT TYPE");
  lines.push("Product Type\tJobs\tUnits\tRevenue");
  data.volumeByProduct.forEach((p) => lines.push(`${p.type}\t${p.jobs}\t${p.units.toLocaleString()}\t$${p.revenue.toLocaleString()}`));
  lines.push("");

  lines.push("TOP CUSTOMERS");
  lines.push("Customer\tJobs\tUnits\tRevenue");
  data.volumeByCustomer.forEach((c) => lines.push(`${c.name}\t${c.jobs}\t${c.units.toLocaleString()}\t$${c.revenue.toLocaleString()}`));
  lines.push("");

  lines.push("DEPARTMENT METRICS");
  lines.push("Department\tJobs Processed\tAvg Time/Job (hrs)\tUtilization %");
  data.departmentMetrics.forEach((d) => lines.push(`${d.name}\t${d.jobsProcessed}\t${d.avgTimePerJob}\t${d.utilization}%`));
  lines.push("");

  lines.push("SALES PIPELINE");
  lines.push("Metric\tValue");
  lines.push(`Quotes Created\t${data.salesSummary.quotesCreated}`);
  lines.push(`Quotes Approved\t${data.salesSummary.quotesApproved}`);
  lines.push(`Conversion Rate\t${data.salesSummary.conversionRate}%`);
  lines.push(`Pipeline Value\t$${data.salesSummary.pipelineValue.toLocaleString()}`);
  lines.push("");

  lines.push("COST BREAKDOWN");
  lines.push("Category\tAmount\t% of Total");
  const totalCost = data.costBreakdown.reduce((sum, c) => sum + c.amount, 0);
  data.costBreakdown.forEach((c) => lines.push(`${c.category}\t$${c.amount.toLocaleString()}\t${((c.amount / totalCost) * 100).toFixed(1)}%`));
  lines.push("");

  lines.push("8-WEEK TREND");
  lines.push("Week\tJobs\tRevenue\tOn-Time Rate");
  data.weeklyTrend.forEach((w) => lines.push(`${w.week}\t${w.jobs}\t$${w.revenue.toLocaleString()}\t${w.onTimeRate}%`));

  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  const data = getReportData();

  if (format === "csv") {
    const csv = toCSV(data);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="cd-weekly-report-${data.reportPeriod.end}.csv"`,
      },
    });
  }

  if (format === "excel") {
    const tsv = toTSV(data);
    return new NextResponse(tsv, {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="cd-weekly-report-${data.reportPeriod.end}.xls"`,
      },
    });
  }

  return NextResponse.json(data);
}
