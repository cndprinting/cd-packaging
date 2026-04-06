"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Gauge, Wrench, Loader2, ArrowRight } from "lucide-react";
import { demoJobs, demoWorkCenters } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  formatDate,
  formatNumber,
} from "@/lib/utils";

const PRODUCTION_STAGES = [
  "PRINTING",
  "COATING_FINISHING",
  "DIE_CUTTING",
  "GLUING_FOLDING",
  "QA",
];

const WORK_CENTER_STAGE_MAP: Record<string, string> = {
  prepress: "PREPRESS",
  press: "PRINTING",
  "die-cutting": "DIE_CUTTING",
  gluing: "GLUING_FOLDING",
  qa: "QA",
  shipping: "PACKED",
};

export default function ProductionPage() {
  const [allJobs, setAllJobs] = useState<any[]>(demoJobs);
  const [loading, setLoading] = useState(true);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        const res = await fetch("/api/jobs");
        if (!cancelled && res.ok) {
          const data = await res.json();
          const apiJobs = data.jobs || [];
          if (apiJobs.length > 0) {
            setAllJobs(apiJobs);
          } else {
            setAllJobs(demoJobs);
          }
        }
      } catch {
        // Keep demo data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJobs();
    return () => { cancelled = true; };
  }, []);

  const productionJobs = useMemo(
    () => allJobs.filter((j) => PRODUCTION_STAGES.includes(j.status)),
    [allJobs]
  );

  const workCenterData = useMemo(() => {
    return demoWorkCenters.map((wc) => {
      const stage = WORK_CENTER_STAGE_MAP[wc.type];
      const jobs = stage ? allJobs.filter((j) => j.status === stage).length : 0;
      return { ...wc, jobs, stage };
    });
  }, [allJobs]);

  async function handleAdvanceStage(jobId: string) {
    setAdvancingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance" }),
      });
      if (res.ok) {
        // Refresh jobs list
        const jobsRes = await fetch("/api/jobs");
        if (jobsRes.ok) {
          const data = await jobsRes.json();
          const apiJobs = data.jobs || [];
          if (apiJobs.length > 0) {
            setAllJobs(apiJobs);
          }
        }
      }
    } catch {
      // Silently fail - job stays in current stage
    } finally {
      setAdvancingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Production Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {productionJobs.length} jobs currently in production
        </p>
      </div>

      {/* Work Centers */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Work Centers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workCenterData.map((wc) => {
            const utilization =
              wc.capacity > 0
                ? Math.round((wc.jobs / wc.capacity) * 100)
                : 0;
            return (
              <Card key={wc.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <Wrench className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{wc.name}</h3>
                      <p className="text-xs text-gray-500">
                        {wc.stage ? getStatusLabel(wc.stage) : wc.type}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                    <div>
                      <p className="text-gray-500 text-xs">Capacity</p>
                      <p className="font-semibold">{wc.capacity}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Active</p>
                      <p className="font-semibold">{wc.jobs}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Utilization</p>
                      <p
                        className={`font-semibold ${
                          utilization > 80
                            ? "text-red-600"
                            : utilization > 50
                            ? "text-amber-600"
                            : "text-green-600"
                        }`}
                      >
                        {utilization}%
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        utilization > 80
                          ? "bg-red-500"
                          : utilization > 50
                          ? "bg-amber-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Production Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs in Production</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono">{job.jobNumber}</TableCell>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>{job.companyName}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(job.status)}>
                      {getStatusLabel(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(job.priority)}>
                      {job.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatNumber(job.quantity)}</TableCell>
                  <TableCell>{formatDate(job.dueDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/jobs/${job.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={advancingId === job.id}
                        onClick={() => handleAdvanceStage(job.id)}
                      >
                        {advancingId === job.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <ArrowRight className="h-3.5 w-3.5 mr-1" />
                            Advance
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {productionJobs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    No jobs currently in production.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
