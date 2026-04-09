"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Factory, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  companyName: string;
  status: string;
  quantity: number;
  dueDate: string;
  createdAt: string;
  estimatedHours?: number;
}

interface WorkCenter {
  id: string;
  name: string;
  code: string;
  type: string;
  capacity: number;
}

export default function ProductionEfficiencyPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/jobs").then(r => r.json()),
      fetch("/api/schedule/work-centers").then(r => r.json()),
    ]).then(([jd, wd]) => {
      setJobs(jd.jobs || []);
      setWorkCenters(wd.workCenters || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const activeJobs = jobs.filter(j => !["DELIVERED", "INVOICED"].includes(j.status));
    const completedJobs = jobs.filter(j => ["DELIVERED", "INVOICED"].includes(j.status));
    const overdueJobs = activeJobs.filter(j => j.dueDate && new Date(j.dueDate) < now);
    const onTimeJobs = completedJobs.filter(j => {
      if (!j.dueDate) return true;
      return new Date(j.dueDate) >= new Date(j.createdAt);
    });

    // Average cycle time (days from creation to current/completed)
    const cycleTimes = completedJobs.map(j => {
      const created = new Date(j.createdAt);
      const end = now;
      return Math.floor((end.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    });
    const avgCycleTime = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((s, d) => s + d, 0) / cycleTimes.length) : 0;

    // Jobs by stage
    const stageMap = new Map<string, number>();
    for (const j of activeJobs) {
      stageMap.set(j.status, (stageMap.get(j.status) || 0) + 1);
    }

    return {
      total: jobs.length,
      active: activeJobs.length,
      completed: completedJobs.length,
      overdue: overdueJobs.length,
      onTimeRate: completedJobs.length > 0 ? Math.round((onTimeJobs.length / completedJobs.length) * 100) : 100,
      avgCycleTime,
      byStage: Array.from(stageMap.entries()).sort((a, b) => b[1] - a[1]),
      overdueJobs,
    };
  }, [jobs]);

  const wcUtilization = useMemo(() => {
    const stageMap: Record<string, string> = {
      prepress: "PREPRESS", press: "PRINTING", "die-cutting": "DIE_CUTTING",
      gluing: "GLUING_FOLDING", bindery: "COATING_FINISHING", qa: "QA", shipping: "PACKED",
    };
    return workCenters.map(wc => {
      const stage = stageMap[wc.type] || "";
      const activeJobs = jobs.filter(j => j.status === stage).length;
      const utilization = wc.capacity > 0 ? Math.round((activeJobs / wc.capacity) * 100) : 0;
      return { ...wc, activeJobs, utilization };
    });
  }, [jobs, workCenters]);

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
            <h1 className="text-2xl font-bold text-gray-900">Production Efficiency</h1>
            <p className="text-sm text-gray-500">Throughput, cycle time, and work center utilization</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>Print</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-xs text-gray-500">Active Jobs</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-600" : "text-emerald-600"}`}>{stats.overdue}</p>
          <p className="text-xs text-gray-500">Overdue</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={`text-2xl font-bold ${stats.onTimeRate >= 90 ? "text-emerald-600" : stats.onTimeRate >= 70 ? "text-amber-600" : "text-red-600"}`}>{stats.onTimeRate}%</p>
          <p className="text-xs text-gray-500">On-Time Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.avgCycleTime}d</p>
          <p className="text-xs text-gray-500">Avg Cycle Time</p>
        </Card>
      </div>

      {/* Work Center Utilization */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Factory className="h-4 w-4 text-brand-600" /> Work Center Utilization</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {wcUtilization.map((wc) => (
              <div key={wc.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{wc.name}</span>
                  <span className="text-gray-500">{wc.activeJobs} / {wc.capacity} jobs ({wc.utilization}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${wc.utilization > 80 ? "bg-red-500" : wc.utilization > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(wc.utilization, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Jobs by Stage */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-brand-600" /> Active Jobs by Stage</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {stats.byStage.map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-600">{stage.replace(/_/g, " ")}</span>
                <Badge className="bg-brand-100 text-brand-700">{count}</Badge>
              </div>
            ))}
            {stats.byStage.length === 0 && <p className="text-sm text-gray-400">No active jobs</p>}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Jobs */}
      {stats.overdueJobs.length > 0 && (
        <Card className="border-red-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" /> Overdue Jobs ({stats.overdueJobs.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.overdueJobs.map((j) => {
                  const daysLate = Math.floor((Date.now() - new Date(j.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={j.id} className="cursor-pointer hover:bg-red-50" onClick={() => window.location.href = `/dashboard/jobs/${j.id}`}>
                      <TableCell className="font-mono text-brand-600">{j.jobNumber}</TableCell>
                      <TableCell className="font-medium">{j.name}</TableCell>
                      <TableCell>{j.companyName}</TableCell>
                      <TableCell><Badge className="bg-gray-100 text-gray-600 text-xs">{j.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-red-600">{formatDate(j.dueDate)}</TableCell>
                      <TableCell><Badge className="bg-red-100 text-red-700">{daysLate}d late</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
