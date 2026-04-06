"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, Clock, Gauge } from "lucide-react";
import { demoJobs, demoWorkCenters } from "@/lib/demo-data";
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

function getWorkCenterStageMap(): Record<string, string> {
  return {
    prepress: "PREPRESS",
    press: "PRINTING",
    "die-cutting": "DIE_CUTTING",
    gluing: "GLUING_FOLDING",
    qa: "QA",
    shipping: "PACKED",
  };
}

export default function SchedulePage() {
  const weekDays = useMemo(() => getWeekDays(), []);
  const stageMap = getWorkCenterStageMap();

  const jobsByDay = useMemo(() => {
    const map: Record<string, typeof demoJobs> = {};
    for (const day of weekDays) {
      map[day.iso] = demoJobs.filter((j) => {
        const dueIso = j.dueDate;
        return dueIso === day.iso;
      });
    }
    return map;
  }, [weekDays]);

  const workCenterData = useMemo(() => {
    return demoWorkCenters.map((wc) => {
      const stage = stageMap[wc.type];
      const assignedJobs = stage
        ? demoJobs.filter((j) => j.status === stage)
        : [];
      return { ...wc, assignedJobs, stage };
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Production Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Week view &middot; Next 7 days
          </p>
        </div>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Change View
        </Button>
      </div>

      {/* Week View */}
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day, i) => (
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
                  {jobsByDay[day.iso].map((job) => (
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
              <Card key={wc.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{wc.name}</h3>
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
