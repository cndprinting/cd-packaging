"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface JobCostData {
  id: string;
  jobNumber: string;
  name: string;
  companyName: string;
  quantity: number;
  status: string;
  estimatedCost: number;
  actualCost: number;
  variance: number;
  variancePct: number;
  dueDate: string;
  completedDate: string;
}

export default function JobCostingPage() {
  const [jobs, setJobs] = useState<JobCostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/jobs").then(r => r.json()),
      fetch("/api/paper-usage").then(r => r.json()),
    ]).then(([jd, pd]) => {
      const allJobs = jd.jobs || [];
      const paperRecords = pd.records || [];

      // Build map of actual paper costs by job number
      const paperCostByJob = new Map<string, number>();
      for (const p of paperRecords) {
        if (p.jobNumber && p.totalOut > 0) {
          paperCostByJob.set(p.jobNumber, (paperCostByJob.get(p.jobNumber) || 0) + p.totalOut);
        }
      }

      const costData: JobCostData[] = allJobs
        .filter((j: any) => ["DELIVERED", "INVOICED", "SHIPPED", "PACKED"].includes(j.status))
        .map((j: any) => {
          const estimatedCost = j.quotedPrice || j.estimatedCost || 0;
          // Actual cost from real paper usage data
          const actualPaperCost = paperCostByJob.get(j.jobNumber) || 0;
          const actualCost = actualPaperCost;
          const variance = estimatedCost - actualCost;
          const variancePct = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;

          return {
            id: j.id,
            jobNumber: j.jobNumber,
            name: j.name,
            companyName: j.companyName || "",
            quantity: j.quantity,
            status: j.status,
            estimatedCost: Math.round(estimatedCost * 100) / 100,
            actualCost: Math.round(actualCost * 100) / 100,
            variance: Math.round(variance * 100) / 100,
            variancePct: Math.round(variancePct * 10) / 10,
            dueDate: j.dueDate || "",
            completedDate: j.deliveredAt || j.updatedAt || "",
          };
        });
      setJobs(costData);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalEstimated = jobs.reduce((s, j) => s + j.estimatedCost, 0);
  const totalActual = jobs.reduce((s, j) => s + j.actualCost, 0);
  const totalVariance = totalEstimated - totalActual;
  const overBudget = jobs.filter((j) => j.variance < 0).length;
  const underBudget = jobs.filter((j) => j.variance > 0).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Costing</h1>
            <p className="text-sm text-gray-500">Estimated vs actual costs on completed jobs</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>Print Report</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalEstimated)}</p>
          <p className="text-xs text-gray-500">Total Estimated</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalActual)}</p>
          <p className="text-xs text-gray-500">Total Actual</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={`text-2xl font-bold ${totalVariance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(Math.abs(totalVariance))}</p>
          <p className="text-xs text-gray-500">{totalVariance >= 0 ? "Under Budget" : "Over Budget"}</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex justify-center gap-4">
            <div><p className="text-xl font-bold text-emerald-600">{underBudget}</p><p className="text-[10px] text-gray-500">Under</p></div>
            <div><p className="text-xl font-bold text-red-600">{overBudget}</p><p className="text-[10px] text-gray-500">Over</p></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Budget Status</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Estimated</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/jobs/${j.id}`}>
                <TableCell className="font-mono text-brand-600">{j.jobNumber}</TableCell>
                <TableCell className="font-medium">{j.name}</TableCell>
                <TableCell className="text-gray-600">{j.companyName}</TableCell>
                <TableCell className="text-right">{formatCurrency(j.estimatedCost)}</TableCell>
                <TableCell className="text-right">{formatCurrency(j.actualCost)}</TableCell>
                <TableCell className={`text-right font-medium ${j.variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {j.variance >= 0 ? "+" : ""}{formatCurrency(j.variance)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge className={j.variancePct >= 0 ? "bg-emerald-100 text-emerald-700" : j.variancePct < -10 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                    {j.variancePct >= 0 ? "+" : ""}{j.variancePct}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={j.status === "INVOICED" ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-700"}>
                    {j.status === "INVOICED" ? "Invoiced" : "Delivered"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {jobs.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400">No completed jobs with cost data yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
