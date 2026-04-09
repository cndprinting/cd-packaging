"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Printer, ChevronUp, ChevronDown,
  GripVertical, Factory, Settings, Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { getStatusColor, getStatusLabel, getPriorityColor, formatDate, formatNumber } from "@/lib/utils";

interface Machine {
  id: string;
  name: string;
  code: string;
}

interface WorkCenter {
  id: string;
  name: string;
  code: string;
  type: string;
  capacity: number;
  machines: Machine[];
}

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  companyName: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string;
  productType: string;
}

const STAGE_MAP: Record<string, string[]> = {
  prepress: ["QUOTE", "ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL", "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED"],
  press: ["PRINTING"],
  "die-cutting": ["DIE_CUTTING"],
  gluing: ["GLUING_FOLDING"],
  bindery: ["COATING_FINISHING"],
  qa: ["QA"],
  shipping: ["PACKED", "SHIPPED"],
};

export default function WorkCenterDetailPage() {
  const params = useParams();
  const [workCenter, setWorkCenter] = useState<WorkCenter | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showAllDays, setShowAllDays] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    Promise.all([
      fetch("/api/schedule/work-centers").then((r) => r.json()),
      fetch("/api/jobs").then((r) => r.json()),
    ])
      .then(([wcData, jobData]) => {
        const wcs: WorkCenter[] = wcData.workCenters || [];
        const wc = wcs.find((w) => w.id === params.id);
        if (wc) {
          setWorkCenter(wc);
          // Filter jobs by this work center's stage(s)
          const stages = STAGE_MAP[wc.type] || [];
          const allJobs: Job[] = jobData.jobs || [];
          const filtered = allJobs.filter((j) => stages.includes(j.status));
          // Deduplicate by job ID
          const unique = filtered.filter((j, i, arr) => arr.findIndex(x => x.id === j.id) === i);
          setJobs(unique);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const filteredJobs = useMemo(() => {
    if (showAllDays) return jobs;
    return jobs.filter(j => {
      if (!j.dueDate) return true; // Show jobs without due date on any day
      const due = typeof j.dueDate === "string" ? j.dueDate.split("T")[0] : String(j.dueDate);
      return due === selectedDate;
    });
  }, [jobs, showAllDays, selectedDate]);

  const moveJob = (index: number, direction: "up" | "down") => {
    const newJobs = [...jobs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newJobs.length) return;
    [newJobs[index], newJobs[targetIndex]] = [newJobs[targetIndex], newJobs[index]];
    setJobs(newJobs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!workCenter) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/schedule" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Schedule
        </Link>
        <Card className="p-8 text-center">
          <p className="text-gray-400">Work center not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/schedule"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{workCenter.name}</h1>
            <p className="text-sm text-gray-500">Code: {workCenter.code} &middot; {jobs.length} active jobs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print Schedule
          </Button>
        </div>
      </div>

      {/* Equipment Selector */}
      {workCenter.machines.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Equipment:</span>
              </div>
              <Select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                options={[
                  { value: "", label: `All Equipment (${workCenter.machines.length})` },
                  ...workCenter.machines.map((m) => ({ value: m.id, label: m.name })),
                ]}
                className="w-64"
              />
              {workCenter.machines.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMachine(selectedMachine === m.id ? "" : m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedMachine === m.id
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by Day</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllDays(!showAllDays)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAllDays ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                All Days
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split("T")[0]);
                    setShowAllDays(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setShowAllDays(false); }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split("T")[0]);
                    setShowAllDays(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setShowAllDays(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Today
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job List — Orderable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory className="h-5 w-5 text-brand-600" />
            Job Queue {selectedMachine ? `- ${workCenter.machines.find(m => m.id === selectedMachine)?.name}` : ""}
            {!showAllDays && <span className="text-sm font-normal text-gray-500">— {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>}
            <span className="text-sm font-normal text-gray-500 ml-2">({filteredJobs.length} jobs)</span>
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">Use arrows to reorder priority. Top = runs first.</p>
        </CardHeader>
        <CardContent>
          {filteredJobs.length > 0 ? (
            <div className="space-y-2">
              {filteredJobs.map((job, index) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 bg-white hover:shadow-sm transition-shadow"
                >
                  {/* Priority position */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => moveJob(index, "up")}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold text-gray-400 w-5 text-center">{index + 1}</span>
                    <button
                      onClick={() => moveJob(index, "down")}
                      disabled={index === filteredJobs.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />

                  {/* Job info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/jobs/${job.id}`} className="font-mono text-sm font-medium text-brand-600 hover:underline">
                        {job.jobNumber}
                      </Link>
                      <Badge className={getStatusColor(job.status)}>{getStatusLabel(job.status)}</Badge>
                      <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                    </div>
                    <p className="text-sm text-gray-900 font-medium mt-0.5 truncate">{job.name}</p>
                    <p className="text-xs text-gray-500">{job.companyName}</p>
                  </div>

                  {/* Quantity + Due */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatNumber(job.quantity)}</p>
                    <p className="text-xs text-gray-500">Due {formatDate(job.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Factory className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No jobs currently in {workCenter.name}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
