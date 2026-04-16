"use client";

import { useState, useEffect, useMemo } from "react";
import { Printer, AlertTriangle, Loader2, Clock, Package } from "lucide-react";
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

// ---------- Types ----------

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  companyName: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string;
  csrName: string;
  isLate: boolean;
  updatedAt?: string;
}

interface Session {
  user?: { name?: string };
}

// ---------- Stage / Department mapping ----------

const STAGE_ORDER = [
  "QUOTE",
  "ARTWORK_RECEIVED",
  "STRUCTURAL_DESIGN",
  "PROOFING",
  "CUSTOMER_APPROVAL",
  "PREPRESS",
  "PLATING",
  "MATERIALS_ORDERED",
  "MATERIALS_RECEIVED",
  "SCHEDULED",
  "PRINTING",
  "COATING_FINISHING",
  "DIE_CUTTING",
  "GLUING_FOLDING",
  "QA",
  "PACKED",
  "SHIPPED",
] as const;

const COMPLETED_STATUSES = new Set(["DELIVERED", "INVOICED"]);

const STAGE_TO_DEPT: Record<string, string> = {
  QUOTE: "Quoting",
  ARTWORK_RECEIVED: "Design",
  STRUCTURAL_DESIGN: "Design",
  PROOFING: "Proofing",
  CUSTOMER_APPROVAL: "Proofing",
  PREPRESS: "Pre-Press",
  PLATING: "Pre-Press",
  MATERIALS_ORDERED: "Materials",
  MATERIALS_RECEIVED: "Materials",
  SCHEDULED: "Scheduled",
  PRINTING: "Press Room",
  COATING_FINISHING: "Coating/Finishing",
  DIE_CUTTING: "Die Cutting",
  GLUING_FOLDING: "Gluing/Folding",
  QA: "Quality Assurance",
  PACKED: "Shipping",
  SHIPPED: "Shipping",
};

// Ordered unique department list
const DEPT_ORDER = [
  "Quoting",
  "Design",
  "Proofing",
  "Pre-Press",
  "Materials",
  "Scheduled",
  "Press Room",
  "Coating/Finishing",
  "Die Cutting",
  "Gluing/Folding",
  "Quality Assurance",
  "Shipping",
];

function daysAgo(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------- Component ----------

export default function WIPReportPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [myJobsOnly, setMyJobsOnly] = useState(false);
  const [sessionUser, setSessionUser] = useState<string>("");

  // Fetch jobs + session in parallel
  useEffect(() => {
    Promise.all([
      fetch("/api/jobs")
        .then((r) => r.json())
        .then((d) => d.jobs ?? []),
      fetch("/api/auth/session")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([jobList, sess]: [Job[], Session | null]) => {
        setJobs(jobList);
        setSessionUser(sess?.user?.name ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter out completed, optionally filter to my jobs
  const activeJobs = useMemo(() => {
    let filtered = jobs.filter((j) => !COMPLETED_STATUSES.has(j.status));
    if (myJobsOnly && sessionUser) {
      filtered = filtered.filter(
        (j) => j.csrName?.toLowerCase() === sessionUser.toLowerCase()
      );
    }
    return filtered;
  }, [jobs, myJobsOnly, sessionUser]);

  // Group by department
  const grouped = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const j of activeJobs) {
      const dept = STAGE_TO_DEPT[j.status] ?? "Other";
      if (!map[dept]) map[dept] = [];
      map[dept].push(j);
    }
    return map;
  }, [activeJobs]);

  // Summary stats
  const today = todayISO();
  const totalActive = activeJobs.length;
  const dueToday = activeJobs.filter((j) => j.dueDate === today).length;
  const overdue = activeJobs.filter((j) => j.isLate).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav,
          aside,
          header,
          [data-sidebar],
          [data-topbar],
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .dept-section {
            page-break-after: always;
          }
          .dept-section:last-child {
            page-break-after: avoid;
          }
          .shadow-sm {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
          }
        }
      `}</style>

      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600 no-print">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  WIP Report
                </h1>
                <p className="text-sm text-gray-500">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 no-print">
            {sessionUser && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={myJobsOnly}
                  onChange={(e) => setMyJobsOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                My Jobs Only
              </label>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">
                {totalActive}
              </div>
              <div className="text-xs text-gray-500 mt-1">Active Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{dueToday}</div>
              <div className="text-xs text-gray-500 mt-1">Due Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div
                className={`text-3xl font-bold ${overdue > 0 ? "text-red-600" : "text-gray-900"}`}
              >
                {overdue}
              </div>
              <div className="text-xs text-gray-500 mt-1">Overdue</div>
            </CardContent>
          </Card>
        </div>

        {/* Department Sections */}
        {DEPT_ORDER.map((dept) => {
          const deptJobs = grouped[dept];
          if (!deptJobs || deptJobs.length === 0) return null;

          return (
            <div key={dept} className="dept-section">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{dept}</span>
                    <Badge variant="secondary" className="text-xs">
                      {deptJobs.length} job{deptJobs.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Job #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Job Name</TableHead>
                        <TableHead className="text-right w-[80px]">
                          Qty
                        </TableHead>
                        <TableHead className="w-[100px]">Due Date</TableHead>
                        <TableHead className="w-[100px]">CSR</TableHead>
                        <TableHead className="w-[90px]">Priority</TableHead>
                        <TableHead className="text-right w-[80px]">
                          <span className="flex items-center gap-1 justify-end">
                            <Clock className="h-3 w-3" />
                            Days
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptJobs.map((job) => {
                        const isOverdue = job.isLate;
                        const days = daysAgo(job.updatedAt);
                        const isRush =
                          job.priority === "RUSH" ||
                          job.priority === "URGENT";
                        return (
                          <TableRow key={job.id}>
                            <TableCell className="font-bold text-gray-900">
                              {job.jobNumber}
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {job.companyName}
                            </TableCell>
                            <TableCell className="text-gray-700 max-w-[200px] truncate">
                              {job.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {job.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {job.dueDate ? (
                                <span
                                  className={
                                    isOverdue
                                      ? "text-red-600 font-semibold"
                                      : "text-gray-700"
                                  }
                                >
                                  {isOverdue && (
                                    <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />
                                  )}
                                  {formatDate(job.dueDate)}
                                </span>
                              ) : (
                                <span className="text-gray-400">&mdash;</span>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {job.csrName || "\u2014"}
                            </TableCell>
                            <TableCell>
                              {isRush ? (
                                <Badge
                                  variant={
                                    job.priority === "URGENT"
                                      ? "destructive"
                                      : "warning"
                                  }
                                  className="text-[10px] px-1.5"
                                >
                                  {job.priority}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  {job.priority}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-gray-600">
                              {days > 0 ? days : "\u2014"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          );
        })}

        {totalActive === 0 && (
          <div className="text-center py-16 text-gray-400">
            No active jobs in progress.
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-8 pt-2">
          WIP Report generated{" "}
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}{" "}
          &middot; C&D Packaging
        </div>
      </div>
    </>
  );
}
