"use client";

import { useState, useEffect } from "react";
import {
  FileBarChart,
  Download,
  Loader2,
  Calendar,
  DollarSign,
  Package,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface ReportData {
  reportPeriod: { start: string; end: string };
  kpis: {
    openJobs: number;
    completedJobs: number;
    newOrders: number;
    onTimeRate: number;
    avgCycleTime: number;
    totalRevenue: number;
    totalCosts: number;
    margin: number;
    prevWeek: {
      openJobs: number;
      completedJobs: number;
      newOrders: number;
      onTimeRate: number;
      avgCycleTime: number;
      totalRevenue: number;
      totalCosts: number;
      margin: number;
    };
  };
  volumeByProduct: { type: string; jobs: number; units: number; revenue: number }[];
  volumeByCustomer: { name: string; jobs: number; units: number; revenue: number }[];
  departmentMetrics: { name: string; jobsProcessed: number; avgTimePerJob: number; utilization: number }[];
  salesSummary: { quotesCreated: number; quotesApproved: number; conversionRate: number; pipelineValue: number };
  costBreakdown: { category: string; amount: number }[];
  weeklyTrend: { week: string; jobs: number; revenue: number; onTimeRate: number }[];
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function ChangeIndicator({ current, previous, suffix = "", invert = false }: { current: number; previous: number; suffix?: string; invert?: boolean }) {
  const diff = current - previous;
  const pct = changePercent(current, previous);
  const isPositive = invert ? diff < 0 : diff > 0;
  const isNeutral = diff === 0;

  if (isNeutral) return <span className="text-xs text-gray-400">No change</span>;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%{suffix}
    </span>
  );
}

export default function WeeklyReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch("/api/reports/weekly?format=json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/reports/weekly?format=excel");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cd-weekly-report.xls`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* silent */
    }
    setDownloading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Failed to load report data.
      </div>
    );
  }

  const totalCost = data.costBreakdown.reduce((sum, c) => sum + c.amount, 0);

  return (
    <>
      <style jsx global>{`
        @media print {
          nav, aside, header, [data-sidebar], [data-topbar], .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .print-break {
            page-break-before: always;
          }
          .report-container {
            padding: 0 !important;
          }
          .shadow-sm {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
          }
        }
      `}</style>

      <div className="report-container space-y-8 max-w-7xl mx-auto">
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600 no-print">
                <FileBarChart className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Weekly Executive Report</h1>
                <p className="text-sm text-gray-500 hidden print:block">C&D Packaging</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <Calendar className="h-4 w-4" />
              {formatDateRange(data.reportPeriod.start, data.reportPeriod.end)}
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <FileBarChart className="h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="default" size="sm" onClick={handleDownloadExcel} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Excel
            </Button>
          </div>
        </div>

        {/* Section 1: KPI Summary */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-600" />
            Key Performance Indicators
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpis.totalRevenue)}</div>
                <ChangeIndicator current={data.kpis.totalRevenue} previous={data.kpis.prevWeek.totalRevenue} suffix=" vs last week" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs Completed</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{data.kpis.completedJobs}</div>
                <ChangeIndicator current={data.kpis.completedJobs} previous={data.kpis.prevWeek.completedJobs} suffix=" vs last week" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">On-Time Rate</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{data.kpis.onTimeRate}%</div>
                <ChangeIndicator current={data.kpis.onTimeRate} previous={data.kpis.prevWeek.onTimeRate} suffix=" vs last week" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cycle Time</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{data.kpis.avgCycleTime} <span className="text-sm font-normal text-gray-500">days</span></div>
                <ChangeIndicator current={data.kpis.avgCycleTime} previous={data.kpis.prevWeek.avgCycleTime} invert suffix=" vs last week" />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 2: Volume & Sales */}
        <section className="print-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600" />
            Volume & Sales
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volume by Product Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volume by Product Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.volumeByProduct}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} fontSize={12} />
                      <YAxis type="category" dataKey="type" width={120} fontSize={12} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === "revenue" ? formatCurrency(Number(value)) : Number(value).toLocaleString(),
                          name === "revenue" ? "Revenue" : "Jobs",
                        ]}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} name="revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {data.volumeByProduct.map((p) => (
                    <div key={p.type} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{p.type}</span>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{p.jobs} jobs</Badge>
                        <span className="font-medium">{formatCurrency(p.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Jobs</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.volumeByCustomer.map((c, i) => (
                      <TableRow key={c.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <span className="font-medium text-gray-900">{c.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{c.jobs}</TableCell>
                        <TableCell className="text-right">{c.units.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(c.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 3: Department Performance */}
        <section className="print-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-600" />
            Department Performance
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Jobs Processed</TableHead>
                    <TableHead className="text-right">Avg Time / Job</TableHead>
                    <TableHead className="w-[220px]">Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.departmentMetrics.map((d) => {
                    const barColor =
                      d.utilization >= 80
                        ? "bg-emerald-500"
                        : d.utilization >= 50
                        ? "bg-amber-400"
                        : "bg-red-400";
                    const badgeVariant =
                      d.utilization >= 80
                        ? "success"
                        : d.utilization >= 50
                        ? "warning"
                        : "destructive";
                    return (
                      <TableRow key={d.name}>
                        <TableCell className="font-medium text-gray-900">{d.name}</TableCell>
                        <TableCell className="text-right">{d.jobsProcessed}</TableCell>
                        <TableCell className="text-right">{d.avgTimePerJob} hrs</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${d.utilization}%` }}
                              />
                            </div>
                            <Badge variant={badgeVariant as "success" | "warning" | "destructive"} className="min-w-[48px] justify-center">
                              {d.utilization}%
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Financial Summary */}
        <section className="print-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-brand-600" />
            Financial Summary
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.costBreakdown.map((c) => {
                    const pct = (c.amount / totalCost) * 100;
                    const colors: Record<string, string> = {
                      Materials: "bg-blue-500",
                      Labor: "bg-emerald-500",
                      Overhead: "bg-amber-400",
                      Shipping: "bg-purple-500",
                    };
                    return (
                      <div key={c.category}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium text-gray-700">{c.category}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-xs">{pct.toFixed(1)}%</span>
                            <span className="font-semibold text-gray-900 min-w-[72px] text-right">{formatCurrency(c.amount)}</span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[c.category] || "bg-gray-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Total Costs</span>
                    <span className="font-bold text-gray-900 text-lg">{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Gross Margin</span>
                    <Badge variant="success">{data.kpis.margin}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sales Pipeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{data.salesSummary.quotesCreated}</div>
                    <div className="text-xs text-gray-500 mt-1">Quotes Created</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{data.salesSummary.quotesApproved}</div>
                    <div className="text-xs text-gray-500 mt-1">Quotes Approved</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-700">{data.salesSummary.conversionRate}%</div>
                    <div className="text-xs text-gray-500 mt-1">Conversion Rate</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{formatCurrency(data.salesSummary.pipelineValue)}</div>
                    <div className="text-xs text-gray-500 mt-1">Pipeline Value</div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-2">Conversion Funnel</div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Quotes Created</span>
                        <span>{data.salesSummary.quotesCreated}</span>
                      </div>
                      <div className="h-3 bg-blue-500 rounded-full" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Quotes Approved</span>
                        <span>{data.salesSummary.quotesApproved}</span>
                      </div>
                      <div
                        className="h-3 bg-emerald-500 rounded-full"
                        style={{ width: `${(data.salesSummary.quotesApproved / data.salesSummary.quotesCreated) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 5: 8-Week Trend */}
        <section className="print-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600" />
            8-Week Trend
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.weeklyTrend} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" fontSize={12} />
                    <YAxis
                      yAxisId="revenue"
                      orientation="left"
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                      fontSize={12}
                    />
                    <YAxis
                      yAxisId="ontime"
                      orientation="right"
                      tickFormatter={(v: number) => `${v}%`}
                      domain={[75, 100]}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        name === "Revenue" ? formatCurrency(Number(value)) : `${value}%`,
                        String(name),
                      ]}
                    />
                    <Area
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                      name="Revenue"
                    />
                    <Line
                      yAxisId="ontime"
                      type="monotone"
                      dataKey="onTimeRate"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", r: 4 }}
                      name="On-Time Rate"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Revenue (left axis)
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  On-Time Rate (right axis)
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-8 pt-2">
          Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} &middot; C&D Packaging &middot; Confidential
        </div>
      </div>
    </>
  );
}
