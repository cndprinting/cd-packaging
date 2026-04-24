"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Calendar, Clock, Gauge, Loader2 } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  formatDateShort,
  formatNumber,
} from "@/lib/utils";

const PRODUCTION_STAGES = [
  "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA", "PACKED",
];

function getWeekDays(): { date: Date; label: string; iso: string }[] {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d,
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      iso: d.toISOString().split("T")[0],
    });
  }
  return days;
}

// Schedule = production-floor capacity planning. Pre-press is its own
// phase (see /dashboard/prepress). Floor work centers start at the press.
function getWorkCenterStageMap(): Record<string, string[]> {
  return {
    press: ["PRINTING"],
    "die-cutting": ["DIE_CUTTING"],
    gluing: ["GLUING_FOLDING"],
    bindery: ["COATING_FINISHING"],
    qa: ["QA"],
    shipping: ["PACKED", "SHIPPED"],
  };
}

interface WorkCenterData {
  id: string;
  name: string;
  code: string;
  type: string;
  capacity: number;
  machines: { id: string; name: string; code: string }[];
}

export default function SchedulePage() {
  const [jobs, setJobs] = useState<any[]>(demoJobs);
  const [workCenters, setWorkCenters] = useState<WorkCenterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [jobRes, wcRes] = await Promise.all([
          fetch("/api/jobs"),
          fetch("/api/schedule/work-centers"),
        ]);
        if (!cancelled) {
          if (jobRes.ok) {
            const jd = await jobRes.json();
            if (jd.jobs?.length) setJobs(jd.jobs);
          }
          if (wcRes.ok) {
            const wd = await wcRes.json();
            if (wd.workCenters?.length) {
              // Hide Prepress — it has its own dashboard at /dashboard/prepress
              setWorkCenters(wd.workCenters.filter((wc: any) => wc.type !== "prepress" && wc.code !== "PP"));
            }
          }
        }
      } catch {
        // Keep defaults on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const weekDays = useMemo(() => getWeekDays(), []);
  const monthDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        date: d,
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        iso: d.toISOString().split("T")[0],
      });
    }
    return days;
  }, []);
  const displayDays = view === "week" ? weekDays : monthDays;
  const stageMap = getWorkCenterStageMap();

  const jobsByDay = useMemo(() => {
    const map: Record<string, typeof jobs> = {};
    for (const day of displayDays) {
      map[day.iso] = jobs.filter((j) => {
        const dueIso = typeof j.dueDate === "string" ? j.dueDate.split("T")[0] : j.dueDate;
        return dueIso === day.iso;
      });
    }
    return map;
  }, [displayDays, jobs]);

  const workCenterData = useMemo(() => {
    return workCenters.map((wc) => {
      const stages = stageMap[wc.type] || [];
      const assignedJobs = stages.length > 0
        ? jobs.filter((j) => stages.includes(j.status))
        : [];
      return { ...wc, assignedJobs, stages };
    });
  }, [jobs, workCenters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Production Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {view === "week" ? "Week view \u00b7 Next 7 days" : "Month view \u00b7 Next 30 days"}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}>Week</button>
          <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}>Month</button>
        </div>
      </div>

      {/* Week View */}
      <div className={`grid gap-3 ${view === "week" ? "grid-cols-7" : "grid-cols-7"}`}>
        {displayDays.map((day, i) => (
          <Card
            key={day.iso}
            className={i === 0 ? "ring-2 ring-green-500" : ""}
          >
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    i === 0 ? "text-green-700" : "text-gray-600"
                  }`}
                >
                  {day.label}
                </span>
                {i === 0 && (
                  <Badge className="bg-green-100 text-green-700 text-[10px]">
                    Today
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {jobsByDay[day.iso]?.length > 0 ? (
                <div className="space-y-1.5">
                  {jobsByDay[day.iso].map((job: any) => (
                    <Link
                      key={job.id}
                      href={`/dashboard/jobs/${job.id}`}
                    >
                      <div
                        className={`p-2 rounded-md text-xs border cursor-pointer hover:shadow-sm transition-shadow ${
                          job.isLate
                            ? "border-red-200 bg-red-50"
                            : job.isBlocked
                            ? "border-orange-200 bg-orange-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <p className="font-mono text-[10px] text-gray-500">
                          {job.jobNumber}
                        </p>
                        <p className="font-medium text-gray-800 truncate">
                          {job.name}
                        </p>
                        <Badge
                          className={`${getStatusColor(job.status)} mt-1 text-[10px]`}
                        >
                          {getStatusLabel(job.status)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 text-center py-4">
                  No jobs due
                </p>
              )}
            </CardContent>
          </Card>
        ))}
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
                ? Math.round((wc.assignedJobs.length / wc.capacity) * 100)
                : 0;
            return (
              <Link key={wc.id} href={`/dashboard/schedule/${wc.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-brand-200 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-brand-700 hover:underline">{wc.name}</h3>
                      <p className="text-xs text-gray-500">Code: {wc.code}</p>
                    </div>
                    <Badge
                      className={
                        utilization > 80
                          ? "bg-red-100 text-red-700"
                          : utilization > 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }
                    >
                      {utilization}% utilized
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Capacity:</span>{" "}
                      <span className="font-medium">{wc.capacity}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Active Jobs:</span>{" "}
                      <span className="font-medium">
                        {wc.assignedJobs.length}
                      </span>
                    </div>
                  </div>
                  {/* Capacity bar */}
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
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
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
