"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search, Filter, AlertTriangle, Clock, LayoutGrid,
} from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cn,
  getStatusColor,
  getStatusLabel,
  formatDate,
  formatNumber,
  daysFromNow,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Column definitions -- grouped stages for the physical board layout
// ---------------------------------------------------------------------------
const BOARD_COLUMNS = [
  {
    id: "estimating",
    label: "Estimating",
    statuses: ["QUOTE"],
    color: "border-gray-400",
    bg: "bg-gray-50",
  },
  {
    id: "pre-production",
    label: "Pre-Production",
    statuses: [
      "ARTWORK_RECEIVED",
      "STRUCTURAL_DESIGN",
      "PROOFING",
      "CUSTOMER_APPROVAL",
    ],
    color: "border-blue-400",
    bg: "bg-blue-50/40",
  },
  {
    id: "prepress",
    label: "Prepress",
    statuses: ["PREPRESS", "PLATING"],
    color: "border-indigo-400",
    bg: "bg-indigo-50/40",
  },
  {
    id: "materials",
    label: "Materials",
    statuses: ["MATERIALS_ORDERED", "MATERIALS_RECEIVED"],
    color: "border-orange-400",
    bg: "bg-orange-50/40",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    statuses: ["SCHEDULED"],
    color: "border-cyan-400",
    bg: "bg-cyan-50/40",
  },
  {
    id: "on-press",
    label: "On Press",
    statuses: ["PRINTING"],
    color: "border-blue-500",
    bg: "bg-blue-50/40",
  },
  {
    id: "finishing",
    label: "Finishing",
    statuses: ["COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING"],
    color: "border-violet-400",
    bg: "bg-violet-50/40",
  },
  {
    id: "qa",
    label: "QA",
    statuses: ["QA"],
    color: "border-yellow-400",
    bg: "bg-yellow-50/40",
  },
  {
    id: "shipping",
    label: "Shipping",
    statuses: ["PACKED", "SHIPPED"],
    color: "border-emerald-400",
    bg: "bg-emerald-50/40",
  },
  {
    id: "complete",
    label: "Complete",
    statuses: ["DELIVERED", "INVOICED"],
    color: "border-green-500",
    bg: "bg-green-50/40",
  },
] as const;

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dueBorderColor(dueDate: string): string {
  const days = daysFromNow(dueDate);
  if (days < 0) return "border-l-red-500";
  if (days <= 3) return "border-l-amber-400";
  return "border-l-green-500";
}

function priorityLabel(p: string) {
  switch (p) {
    case "URGENT":
      return "bg-red-100 text-red-700";
    case "HIGH":
      return "bg-orange-100 text-orange-700";
    case "NORMAL":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function JobBoardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");

  // Fetch jobs from API, fallback to demo data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) throw new Error("api");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.jobs ?? data.data ?? [];
        if (!cancelled) setJobs(list.length > 0 ? list : demoJobs);
      } catch {
        if (!cancelled) setJobs(demoJobs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered jobs
  const filtered = useMemo(() => {
    let list = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          (j.jobNumber ?? "").toLowerCase().includes(q) ||
          (j.companyName ?? "").toLowerCase().includes(q) ||
          (j.name ?? "").toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== "ALL") {
      list = list.filter((j) => j.priority === priorityFilter);
    }
    return list;
  }, [jobs, search, priorityFilter]);

  // Group filtered jobs into columns
  const columns = useMemo(() => {
    return BOARD_COLUMNS.map((col) => ({
      ...col,
      jobs: filtered.filter((j) =>
        (col.statuses as readonly string[]).includes(j.status)
      ),
    }));
  }, [filtered]);

  const totalOnBoard = filtered.length;
  const overdueCount = filtered.filter((j) => daysFromNow(j.dueDate) < 0).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutGrid className="h-6 w-6 text-brand-600" />
              Job Board
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Darrin&apos;s visual tracking board
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {totalOnBoard} jobs
            </Badge>
            {overdueCount > 0 && (
              <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {overdueCount} overdue
              </Badge>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search job #, customer, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400" />
            {(["ALL", "URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => (
              <Button
                key={p}
                variant={priorityFilter === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPriorityFilter(p)}
                className="text-xs"
              >
                {p === "ALL" ? "All" : p.charAt(0) + p.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading jobs...
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto px-6 pb-6">
          <div className="inline-flex gap-4 h-full min-w-full">
            {columns.map((col) => (
              <div
                key={col.id}
                className="flex flex-col min-w-[220px] w-[220px] shrink-0"
              >
                {/* Column header */}
                <div
                  className={cn(
                    "rounded-t-lg border-t-4 px-3 py-2 flex items-center justify-between",
                    col.color,
                    col.bg
                  )}
                >
                  <span className="text-sm font-semibold text-gray-700 truncate">
                    {col.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 ml-1.5 shrink-0"
                  >
                    {col.jobs.length}
                  </Badge>
                </div>

                {/* Job strips */}
                <div
                  className={cn(
                    "flex-1 overflow-y-auto rounded-b-lg border border-t-0 border-gray-200 p-2 space-y-2",
                    col.bg
                  )}
                >
                  {col.jobs.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">
                      No jobs
                    </p>
                  )}
                  {col.jobs.map((job) => (
                    <JobStrip key={job.id} job={job} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Strip -- the tear-off portion of a job ticket
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobStrip({ job }: { job: any }) {
  const days = daysFromNow(job.dueDate);
  const overdue = days < 0;
  const soonDue = days >= 0 && days <= 3;

  return (
    <Link href={`/dashboard/jobs/${job.id}`}>
      <Card
        className={cn(
          "border-l-4 p-2.5 cursor-pointer transition-shadow hover:shadow-md",
          dueBorderColor(job.dueDate),
          job.isBlocked && "ring-1 ring-red-300"
        )}
      >
        {/* Top row: job number + priority */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-sm font-bold text-gray-900 truncate">
            {job.jobNumber}
          </span>
          <Badge className={cn("text-[10px] px-1 py-0 leading-4 shrink-0", priorityLabel(job.priority))}>
            {job.priority === "URGENT"
              ? "URG"
              : job.priority === "HIGH"
              ? "HI"
              : job.priority === "NORMAL"
              ? "NRM"
              : "LOW"}
          </Badge>
        </div>

        {/* Customer */}
        <p className="text-xs text-gray-500 truncate">{job.companyName}</p>

        {/* Title */}
        <p className="text-xs font-medium text-gray-700 truncate mt-0.5">
          {job.name}
        </p>

        {/* Bottom row: qty + due date */}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <span className="text-[11px] text-gray-500">
            {formatNumber(job.quantity)} pcs
          </span>
          <span
            className={cn(
              "text-[11px] flex items-center gap-0.5",
              overdue
                ? "text-red-600 font-semibold"
                : soonDue
                ? "text-amber-600 font-medium"
                : "text-gray-500"
            )}
          >
            <Clock className="h-3 w-3" />
            {formatDate(job.dueDate)}
          </span>
        </div>

        {/* Blocked indicator */}
        {job.isBlocked && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-600 bg-red-50 rounded px-1 py-0.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">{job.blockerReason || "Blocked"}</span>
          </div>
        )}

        {/* Status sub-badge for grouped columns */}
        <Badge
          className={cn(
            "mt-1.5 text-[10px] px-1.5 py-0 leading-4",
            getStatusColor(job.status)
          )}
        >
          {getStatusLabel(job.status)}
        </Badge>
      </Card>
    </Link>
  );
}
