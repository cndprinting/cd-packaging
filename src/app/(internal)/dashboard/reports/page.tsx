"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, AlertTriangle, BarChart3, Timer, Layers, Package, Truck, Loader2, FileBarChart, ArrowRight, Building2, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REPORTS = [
  { title: "On-Time Shipment", description: "Track shipment accuracy and on-time delivery percentage.", icon: Truck, color: "text-green-600 bg-green-50", type: "on-time-shipment" },
  { title: "Late Jobs", description: "All jobs currently past due or at risk of being late.", icon: AlertTriangle, color: "text-red-600 bg-red-50", type: "late-jobs" },
  { title: "Jobs by Customer", description: "Breakdown of jobs grouped by customer account.", icon: BarChart3, color: "text-blue-600 bg-blue-50", type: "jobs-by-customer" },
  { title: "Cycle Time", description: "Average time from order creation to delivery.", icon: Timer, color: "text-purple-600 bg-purple-50", type: "cycle-time" },
  { title: "Stage Delays", description: "Identify bottlenecks by time spent at each stage.", icon: Clock, color: "text-amber-600 bg-amber-50", type: "stage-delays" },
  { title: "Blocked Jobs", description: "Currently blocked jobs with reasons and status.", icon: Layers, color: "text-orange-600 bg-orange-50", type: "blocked-jobs" },
  { title: "Material Shortage", description: "Materials below reorder point impacting production.", icon: Package, color: "text-rose-600 bg-rose-50", type: "material-shortage" },
];

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGenerate = async (type: string) => {
    setLoading(type);
    try {
      const res = await fetch(`/api/reports?type=${type}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* silent */ }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-sm text-gray-500 mt-1">Generate and export production reports</p></div>

      {/* Weekly Executive Report - Featured */}
      <Link href="/dashboard/reports/weekly">
        <Card className="bg-gradient-to-r from-brand-600 to-brand-700 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><FileBarChart className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Weekly Executive Report</h2>
                <p className="text-sm text-white/80">KPIs, volumes, sales, costs, and trends — printable PDF with Excel backup</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* WIP Report */}
      <Link href="/dashboard/reports/wip">
        <Card className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><ClipboardList className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">WIP Report</h2>
                <p className="text-sm text-white/80">Daily shop floor report — active jobs grouped by department with overdue alerts</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* Labor Report - Featured */}
      <Link href="/dashboard/reports/labor">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><Clock className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Labor Report</h2>
                <p className="text-sm text-white/80">Track labor hours per job — estimated vs actual with red/green indicators and estimating insights</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* Revenue Trends */}
      <Link href="/dashboard/reports/revenue">
        <Card className="bg-gradient-to-r from-cyan-600 to-teal-600 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><BarChart3 className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Revenue Trends</h2>
                <p className="text-sm text-white/80">Monthly quote volume, win rates, top customers — with bar charts</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* Production Efficiency */}
      <Link href="/dashboard/reports/production-efficiency">
        <Card className="bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><Layers className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Production Efficiency</h2>
                <p className="text-sm text-white/80">Throughput, cycle time, work center utilization, overdue jobs</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* Sales by Rep */}
      <Link href="/dashboard/reports/sales">
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><Timer className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Sales by Rep</h2>
                <p className="text-sm text-white/80">Quote volume, conversion rates, and revenue by team member</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* Job Costing */}
      <Link href="/dashboard/reports/job-costing">
        <Card className="bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><BarChart3 className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Job Costing</h2>
                <p className="text-sm text-white/80">Estimated vs actual costs — find which jobs went over or under budget</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      {/* Customers by Industry */}
      <Link href="/dashboard/reports/industry">
        <Card className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3"><Building2 className="h-7 w-7" /></div>
              <div>
                <h2 className="text-lg font-bold">Customers by Industry</h2>
                <p className="text-sm text-white/80">Breakdown of all customers grouped by industry — interactive chart and filterable list</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-white/70" />
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${report.color}`}><Icon className="h-5 w-5" /></div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">{report.description}</CardDescription>
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => handleGenerate(report.type)} disabled={loading === report.type}>
                  {loading === report.type ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading === report.type ? "Generating..." : "Generate CSV"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
