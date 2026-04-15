"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Layers, Clock, AlertTriangle, CheckCircle2, Loader2, FileCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PrepressJob {
  id: string;
  jobNumber: string;
  name: string;
  customer: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string | null;
  stockDescription: string | null;
  numPages: number | null;
  pressAssignment: string | null;
  enteredStageAt: string;
  ageHours: number;
  slaState: "ok" | "warning" | "overdue";
}

const statusLabels: Record<string, string> = {
  ARTWORK_RECEIVED: "Artwork Received",
  STRUCTURAL_DESIGN: "Structural Design",
  PROOFING: "Proofing",
  CUSTOMER_APPROVAL: "Customer Approval",
  PREPRESS: "Pre-Press",
  PLATING: "Plating",
};

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours - days * 24);
  return `${days}d ${rem}h`;
}

function JobCard({ job }: { job: PrepressJob }) {
  const slaBorder =
    job.slaState === "overdue" ? "border-l-red-500"
    : job.slaState === "warning" ? "border-l-amber-500"
    : "border-l-emerald-500";
  const slaBg =
    job.slaState === "overdue" ? "bg-red-50 text-red-700"
    : job.slaState === "warning" ? "bg-amber-50 text-amber-700"
    : "bg-emerald-50 text-emerald-700";
  const slaIcon =
    job.slaState === "overdue" ? <AlertTriangle className="h-3.5 w-3.5" />
    : job.slaState === "warning" ? <Clock className="h-3.5 w-3.5" />
    : <CheckCircle2 className="h-3.5 w-3.5" />;

  return (
    <Link href={`/dashboard/jobs/${job.id}`}>
      <Card className={`border-l-4 ${slaBorder} hover:shadow-md transition-shadow cursor-pointer`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs text-gray-500">{job.jobNumber}</span>
                {job.priority === "URGENT" && <Badge className="bg-red-100 text-red-700 text-[10px]">URGENT</Badge>}
                {job.priority === "HIGH" && <Badge className="bg-orange-100 text-orange-700 text-[10px]">HIGH</Badge>}
              </div>
              <p className="text-sm font-semibold text-gray-900 truncate">{job.name}</p>
              <p className="text-xs text-gray-500 truncate">{job.customer}</p>
            </div>
            <div className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${slaBg}`}>
              {slaIcon}
              <span>{formatAge(job.ageHours)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Badge className="bg-gray-100 text-gray-700 text-[10px]">{statusLabels[job.status] || job.status}</Badge>
            </span>
            {job.quantity > 0 && <span>Qty: {job.quantity.toLocaleString()}</span>}
            {job.numPages && <span>{job.numPages}pp</span>}
            {job.dueDate && <span>Due: {formatDate(job.dueDate)}</span>}
            {job.pressAssignment && <span>Press: {job.pressAssignment}</span>}
          </div>
          {job.stockDescription && (
            <p className="mt-1 text-[11px] text-gray-400 truncate">Stock: {job.stockDescription}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PrepressPage() {
  const [rack, setRack] = useState<PrepressJob[]>([]);
  const [okayToPrint, setOkayToPrint] = useState<PrepressJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    try {
      const res = await fetch("/api/prepress");
      const data = await res.json();
      setRack(data.rack || []);
      setOkayToPrint(data.okayToPrint || []);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Auto-refresh every 60 seconds so SLA ticks forward
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const overdueCount = rack.filter(j => j.slaState === "overdue").length;
  const warningCount = rack.filter(j => j.slaState === "warning").length;
  const healthyCount = rack.filter(j => j.slaState === "ok").length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pre-Press Queue</h1>
            <p className="text-sm text-gray-500">
              24-hour proof SLA · Last refresh {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
        >
          Refresh
        </button>
      </div>

      {/* SLA summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
              <p className="text-xs text-gray-500">Overdue (&gt;24h)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
              <p className="text-xs text-gray-500">At Risk (12–24h)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{healthyCount}</p>
              <p className="text-xs text-gray-500">On Track (&lt;12h)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{okayToPrint.length}</p>
              <p className="text-xs text-gray-500">Okay to Print</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two-rack layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pre-Press Rack */}
        <div>
          <Card>
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-600" />
                  Pre-Press Rack
                </span>
                <Badge className="bg-brand-50 text-brand-700">{rack.length}</Badge>
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">Artwork received → proofing → plating. 24-hour proof target.</p>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {rack.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  Rack is clear. Nice work.
                </div>
              ) : (
                rack.map(job => <JobCard key={job.id} job={job} />)
              )}
            </CardContent>
          </Card>
        </div>

        {/* Okay to Print Rack */}
        <div>
          <Card>
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  Okay to Print
                </span>
                <Badge className="bg-emerald-50 text-emerald-700">{okayToPrint.length}</Badge>
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">Customer approved — waiting to be scheduled on a press.</p>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {okayToPrint.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  <FileCheck className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  Nothing waiting to be scheduled.
                </div>
              ) : (
                okayToPrint.map(job => <JobCard key={job.id} job={job} />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
