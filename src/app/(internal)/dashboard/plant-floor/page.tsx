"use client";

import { useState, useEffect, useRef } from "react";
import { Timer, Play, Square, Clock, Package, Factory } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  { id: "prepress", label: "Prepress", stages: ["PREPRESS"], color: "bg-indigo-600" },
  { id: "press", label: "Press", stages: ["PRINTING"], color: "bg-blue-600" },
  { id: "die-cutting", label: "Die Cutting", stages: ["DIE_CUTTING"], color: "bg-pink-600" },
  { id: "gluing", label: "Gluing / Folding", stages: ["GLUING_FOLDING"], color: "bg-rose-600" },
  { id: "coating", label: "Coating / Finishing", stages: ["COATING_FINISHING"], color: "bg-violet-600" },
  { id: "qa", label: "QA", stages: ["QA"], color: "bg-yellow-600" },
  { id: "shipping", label: "Shipping", stages: ["PACKED", "SHIPPED"], color: "bg-emerald-600" },
];

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PlantFloorPage() {
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[1].id);
  const [runningJobs, setRunningJobs] = useState<Record<string, number>>({});
  const [completedToday, setCompletedToday] = useState<{ jobNumber: string; jobName: string; department: string; duration: string }[]>([
    { jobNumber: "PKG-2026-001", jobName: "Organic Cereal Box", department: "Press", duration: "2h 30m" },
    { jobNumber: "PKG-2026-005", jobName: "Foundation Box", department: "QA", duration: "0h 45m" },
  ]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const dept = DEPARTMENTS.find(d => d.id === selectedDept)!;
  const deptJobs = demoJobs.filter(j => dept.stages.includes(j.status));

  // Timer tick
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRunningJobs(prev => {
        const next = { ...prev };
        for (const key in next) next[key] = next[key] + 1;
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleStart = async (jobId: string) => {
    setRunningJobs(prev => ({ ...prev, [jobId]: 0 }));
    try { await fetch("/api/timeclock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action: "start", department: dept.label }) }); } catch {}
  };

  const handleStop = async (jobId: string) => {
    const elapsed = runningJobs[jobId] || 0;
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const job = demoJobs.find(j => j.id === jobId);
    setCompletedToday(prev => [{ jobNumber: job?.jobNumber || "", jobName: job?.name || "", department: dept.label, duration: `${h}h ${m}m` }, ...prev]);
    setRunningJobs(prev => { const next = { ...prev }; delete next[jobId]; return next; });
    try { await fetch("/api/timeclock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action: "stop", department: dept.label }) }); } catch {}
  };

  return (
    <RequireRole allowed={["ADMIN", "PRODUCTION_MANAGER", "CSR"]}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Factory className="h-7 w-7 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plant Floor</h1>
            <p className="text-sm text-gray-500">Job timer — start and stop jobs by department</p>
          </div>
        </div>

        {/* Department Selector */}
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map(d => {
            const jobCount = demoJobs.filter(j => d.stages.includes(j.status)).length;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDept(d.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all",
                  selectedDept === d.id
                    ? `${d.color} text-white shadow-lg scale-105`
                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow"
                )}
              >
                {d.label}
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", selectedDept === d.id ? "bg-white/20" : "bg-gray-100")}>{jobCount}</span>
              </button>
            );
          })}
        </div>

        {/* Jobs in Department */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deptJobs.map(job => {
            const isRunning = job.id in runningJobs;
            const elapsed = runningJobs[job.id];
            const running = elapsed !== undefined;

            return (
              <Card key={job.id} className={cn("p-6", running && "ring-2 ring-green-500 bg-green-50/30")}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-mono text-gray-400">{job.jobNumber}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{job.name}</p>
                    <p className="text-sm text-gray-500">{job.companyName}</p>
                  </div>
                  <Badge className="bg-gray-100 text-gray-700 text-lg px-3 py-1">{job.quantity.toLocaleString()}</Badge>
                </div>

                {running ? (
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-4xl font-bold font-mono text-green-700">{formatElapsed(elapsed)}</p>
                      <p className="text-xs text-green-600 mt-1">Running in {dept.label}</p>
                    </div>
                    <Button size="lg" className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 gap-2" onClick={() => handleStop(job.id)}>
                      <Square className="h-6 w-6" /> STOP
                    </Button>
                  </div>
                ) : (
                  <Button size="lg" className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 gap-2" onClick={() => handleStart(job.id)}>
                    <Play className="h-6 w-6" /> START
                  </Button>
                )}
              </Card>
            );
          })}

          {deptJobs.length === 0 && (
            <div className="col-span-2 text-center py-16 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg">No jobs in {dept.label}</p>
            </div>
          )}
        </div>

        {/* Completed Today */}
        {completedToday.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Completed Today</h3>
            <div className="space-y-2">
              {completedToday.map((entry, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{entry.jobNumber} — {entry.jobName}</p>
                    <p className="text-xs text-gray-500">{entry.department}</p>
                  </div>
                  <Badge className="bg-gray-100 text-gray-700">{entry.duration}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </RequireRole>
  );
}
