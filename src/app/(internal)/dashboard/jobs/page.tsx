"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, X, Loader2, AlertTriangle } from "lucide-react";
import { demoJobs, demoCompanies } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  formatDate,
  formatNumber,
} from "@/lib/utils";

interface Job {
  id: string;
  jobNumber: string;
  orderId: string;
  orderNumber: string;
  name: string;
  description?: string;
  companyId: string;
  companyName: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string;
  isLate: boolean;
  isBlocked: boolean;
  blockerReason?: string;
  productType?: string;
  estimatedHours?: number;
  actualHours?: number;
}

const STATUSES = [
  "QUOTE", "ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL",
  "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED",
  "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA",
  "PACKED", "SHIPPED", "DELIVERED", "INVOICED",
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>(demoJobs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newJob, setNewJob] = useState({ name: "", description: "", quantity: "", dueDate: "", priority: "NORMAL", customerName: "", estimatedHours: "", productType: "FOLDING_CARTON" });

  // Fetch jobs from API (falls back to demo data)
  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => { if (data.jobs) setJobs(data.jobs); })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (search && !j.name.toLowerCase().includes(search.toLowerCase()) && !j.jobNumber.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && j.status !== statusFilter) return false;
      if (priorityFilter && j.priority !== priorityFilter) return false;
      if (customerFilter && j.companyName !== customerFilter) return false;
      if (productTypeFilter && j.productType !== productTypeFilter) return false;
      return true;
    });
  }, [jobs, search, statusFilter, priorityFilter, customerFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, Job[]> = {};
    for (const status of STATUSES) {
      const statusJobs = filtered.filter((j) => j.status === status);
      if (statusJobs.length > 0) groups[status] = statusJobs;
    }
    return groups;
  }, [filtered]);

  const customers = useMemo(() => [...new Set(jobs.map((j) => j.companyName))].sort(), [jobs]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newJob.name || !newJob.quantity || !newJob.estimatedHours) { setCreateError("Name, quantity, and estimated hours are required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJob),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create job"); setCreating(false); return; }
      setJobs((prev) => [data.job, ...prev]);
      setShowNewJobModal(false);
      setNewJob({ name: "", description: "", quantity: "", dueDate: "", priority: "NORMAL", customerName: "", estimatedHours: "", productType: "FOLDING_CARTON" });
      setCreating(false);
    } catch { setCreateError("Something went wrong"); setCreating(false); }
  };

  const updateNewJob = (field: string, value: string) => setNewJob((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs Board</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {jobs.length} jobs</p>
        </div>
        <Button onClick={() => setShowNewJobModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Job
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search by job number or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses" options={[{ value: "", label: "All Statuses" }, ...STATUSES.map((s) => ({ value: s, label: getStatusLabel(s) }))]} className="w-40" />
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} placeholder="All Priorities" options={[{ value: "", label: "All Priorities" }, { value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} className="w-40" />
          <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} placeholder="All Customers" options={[{ value: "", label: "All Customers" }, ...customers.map((c) => ({ value: c, label: c }))]} className="w-44" />
          <Select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)} options={[{ value: "", label: "All Types" }, { value: "FOLDING_CARTON", label: "Folding Carton" }, { value: "COMMERCIAL_PRINT", label: "Commercial Print" }]} className="w-40" />
        </div>
      </Card>

      {/* Job Groups */}
      {Object.entries(grouped).map(([status, statusJobs]) => (
        <div key={status}>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getStatusColor(status)}>{getStatusLabel(status)}</Badge>
            <span className="text-xs text-gray-400">{statusJobs.length} job{statusJobs.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {statusJobs.map((job) => (
              <Link key={job.id} href={`/dashboard/jobs/${job.id}`}>
                <Card className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${job.isLate ? "border-l-4 border-l-red-500" : job.isBlocked ? "border-l-4 border-l-orange-500" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">{job.jobNumber}</span>
                          <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                          {job.isLate && <Badge className="bg-red-100 text-red-700">LATE</Badge>}
                          {job.isBlocked && <Badge className="bg-orange-100 text-orange-700">BLOCKED</Badge>}
                          {job.productType && <Badge className={job.productType === "FOLDING_CARTON" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}>{job.productType === "FOLDING_CARTON" ? "Carton" : "Print"}</Badge>}
                        </div>
                        <p className="font-medium text-gray-900 mt-0.5">{job.name}</p>
                        <p className="text-sm text-gray-500">{job.companyName}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-sm font-medium text-gray-700">{formatNumber(job.quantity)} <span className="text-gray-400 text-xs">qty</span></p>
                      <p className="text-xs text-gray-400">{formatDate(job.dueDate)} <span className="text-gray-300">due</span></p>
                      {job.estimatedHours && (
                        <p className={`text-xs font-medium ${job.actualHours && job.actualHours > job.estimatedHours ? "text-red-600" : "text-emerald-600"}`}>
                          {job.actualHours ? `${job.actualHours}h` : "0h"} / {job.estimatedHours}h est
                        </p>
                      )}
                    </div>
                  </div>
                  {job.blockerReason && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-600">
                      <AlertTriangle className="h-3.5 w-3.5" /> {job.blockerReason}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 text-gray-400">No jobs match your filters</div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowNewJobModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Create New Job</h2>
                <button onClick={() => setShowNewJobModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>

              <form onSubmit={handleCreateJob} className="space-y-4">
                {createError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{createError}</div>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Name *</label>
                  <Input placeholder="e.g. Organic Cereal Box - 12oz" value={newJob.name} onChange={(e) => updateNewJob("name", e.target.value)} autoFocus />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Input placeholder="e.g. Full color printed folding carton with matte finish" value={newJob.description} onChange={(e) => updateNewJob("description", e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <Input type="number" placeholder="25000" value={newJob.quantity} onChange={(e) => updateNewJob("quantity", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <Input type="date" value={newJob.dueDate} onChange={(e) => updateNewJob("dueDate", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <Select value={newJob.priority} onChange={(e) => updateNewJob("priority", e.target.value)} options={[
                      { value: "LOW", label: "Low" },
                      { value: "NORMAL", label: "Normal" },
                      { value: "HIGH", label: "High" },
                      { value: "URGENT", label: "Urgent" },
                    ]} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <Input placeholder="Company name" value={newJob.customerName} onChange={(e) => updateNewJob("customerName", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours *</label>
                    <Input type="number" step="0.5" placeholder="e.g. 12" value={newJob.estimatedHours} onChange={(e) => updateNewJob("estimatedHours", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                    <Select value={newJob.productType} onChange={(e) => updateNewJob("productType", e.target.value)} options={[{ value: "FOLDING_CARTON", label: "Folding Carton" }, { value: "COMMERCIAL_PRINT", label: "Commercial Print" }]} />
                  </div>
                  <div className="flex items-end">
                    <p className="text-xs text-gray-400 pb-2">Hours will be tracked against this estimate in the Labor Report</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewJobModal(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={creating}>
                    {creating ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating...</span> : "Create Job"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
