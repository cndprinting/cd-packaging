"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, TrendingUp, TrendingDown, DollarSign, Users, Target, AlertTriangle, Download, Loader2, ArrowLeft, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface LaborData {
  kpis: { totalHoursTracked: number; totalJobsTracked: number; avgHoursPerJob: number; onBudgetRate: number; overBudgetJobs: number; underBudgetJobs: number; totalLaborCost: number; avgCostPerJob: number };
  jobLabor: { jobNumber: string; jobName: string; customer: string; estimatedHours: number; actualHours: number; variance: number; status: string; department: string }[];
  byDepartment: { department: string; totalHours: number; jobCount: number; avgPerJob: number }[];
}

export default function LaborReportPage() {
  const [data, setData] = useState<LaborData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/labor")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  if (!data) return <div className="text-center py-12 text-gray-400">Failed to load report</div>;

  const { kpis, jobLabor, byDepartment } = data;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Labor Report</h1>
            <p className="text-sm text-gray-500">Track labor hours, efficiency, and costs per job</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Download className="h-4 w-4" />Print PDF</Button>
          <Button variant="outline" className="gap-1.5" onClick={() => { window.open("/api/reports/labor?format=csv"); }}><Download className="h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1"><Clock className="h-4 w-4" /><span className="text-xs uppercase">Total Hours</span></div>
            <p className="text-2xl font-bold">{kpis.totalHoursTracked}h</p>
            <p className="text-xs text-gray-400">{kpis.totalJobsTracked} jobs tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1"><Target className="h-4 w-4" /><span className="text-xs uppercase">On Budget Rate</span></div>
            <p className={`text-2xl font-bold ${kpis.onBudgetRate >= 70 ? "text-emerald-600" : "text-red-600"}`}>{kpis.onBudgetRate}%</p>
            <p className="text-xs text-gray-400">{kpis.underBudgetJobs} under, {kpis.overBudgetJobs} over</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1"><BarChart3 className="h-4 w-4" /><span className="text-xs uppercase">Avg Hours/Job</span></div>
            <p className="text-2xl font-bold">{kpis.avgHoursPerJob}h</p>
            <p className="text-xs text-gray-400">Use to refine estimates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs uppercase">Total Labor Cost</span></div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.totalLaborCost)}</p>
            <p className="text-xs text-gray-400">{formatCurrency(kpis.avgCostPerJob)} avg/job</p>
          </CardContent>
        </Card>
      </div>

      {/* Hours by Department Chart */}
      <Card>
        <CardHeader><CardTitle>Hours by Department</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="totalHours" fill="#15803d" radius={[4, 4, 0, 0]} name="Total Hours" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Job Labor Table — Estimated vs Actual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Estimated vs Actual Hours by Job</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" /> Under Budget</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Over Budget</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Job Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobLabor.map((j) => (
                <TableRow key={j.jobNumber} className={j.status === "over" ? "bg-red-50/50" : ""}>
                  <TableCell className="font-mono font-medium">{j.jobNumber}</TableCell>
                  <TableCell>{j.jobName}</TableCell>
                  <TableCell className="text-gray-500">{j.customer}</TableCell>
                  <TableCell><Badge className="bg-gray-100 text-gray-700">{j.department}</Badge></TableCell>
                  <TableCell className="text-right">{j.estimatedHours}h</TableCell>
                  <TableCell className="text-right font-medium">{j.actualHours}h</TableCell>
                  <TableCell className="text-right">
                    <span className={`flex items-center justify-end gap-1 font-medium ${j.variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {j.variance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {j.variance > 0 ? "+" : ""}{j.variance}h
                    </span>
                  </TableCell>
                  <TableCell>
                    {j.status === "over" ? (
                      <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Over</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">Under</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader><CardTitle>Estimating Insights</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm font-semibold text-emerald-800">Jobs Coming In Under Budget</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{kpis.underBudgetJobs} jobs</p>
              <p className="text-xs text-emerald-600 mt-1">Estimates may be too generous for these job types — opportunity to tighten quotes</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-semibold text-red-800">Jobs Over Budget</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{kpis.overBudgetJobs} jobs</p>
              <p className="text-xs text-red-600 mt-1">Review these jobs to identify why actuals exceeded estimates — update estimating accordingly</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-800">Recommendation for Estimating Updates</p>
            <p className="text-xs text-blue-600 mt-1">Based on tracked data, average hours per job is <strong>{kpis.avgHoursPerJob}h</strong>. Consider using department-level averages from the chart above to update your estimating templates. As more jobs are tracked, this data will become more accurate.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
