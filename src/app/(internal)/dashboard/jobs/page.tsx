"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

const STATUSES = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

const customers = Array.from(new Set(demoJobs.map((j) => j.companyName))).sort();

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const filtered = useMemo(() => {
    return demoJobs.filter((job) => {
      const matchSearch =
        !search ||
        job.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        job.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || job.status === statusFilter;
      const matchPriority = !priorityFilter || job.priority === priorityFilter;
      const matchCustomer = !customerFilter || job.companyName === customerFilter;
      return matchSearch && matchStatus && matchPriority && matchCustomer;
    });
  }, [search, statusFilter, priorityFilter, customerFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof demoJobs> = {};
    for (const job of filtered) {
      if (!groups[job.status]) groups[job.status] = [];
      groups[job.status].push(job);
    }
    return groups;
  }, [filtered]);

  const statusOrder = STATUSES.filter((s) => grouped[s]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs Board</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} of {demoJobs.length} jobs
          </p>
        </div>
        <Button>+ New Job</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by job number or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                ...STATUSES.map((s) => ({ value: s, label: getStatusLabel(s) })),
              ]}
            />
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: "", label: "All Priorities" },
                ...PRIORITIES.map((p) => ({ value: p, label: p })),
              ]}
            />
            <Select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              options={[
                { value: "", label: "All Customers" },
                ...customers.map((c) => ({ value: c, label: c })),
              ]}
            />
            {(search || statusFilter || priorityFilter || customerFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setPriorityFilter("");
                  setCustomerFilter("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Jobs grouped by status */}
      <div className="space-y-6">
        {statusOrder.map((status) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <Badge className={getStatusColor(status)}>
                {getStatusLabel(status)}
              </Badge>
              <span className="text-sm text-gray-500">
                {grouped[status].length} job{grouped[status].length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[status].map((job) => (
                <Link key={job.id} href={`/dashboard/jobs/${job.id}`}>
                  <Card
                    className={`hover:shadow-md transition-shadow cursor-pointer ${
                      job.isLate
                        ? "border-l-4 border-l-red-500"
                        : job.isBlocked
                        ? "border-l-4 border-l-orange-400"
                        : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-gray-500">
                                {job.jobNumber}
                              </span>
                              <Badge className={getPriorityColor(job.priority)}>
                                {job.priority}
                              </Badge>
                              {job.isLate && (
                                <Badge className="bg-red-100 text-red-700">
                                  LATE
                                </Badge>
                              )}
                              {job.isBlocked && (
                                <Badge className="bg-orange-100 text-orange-700">
                                  BLOCKED
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 mt-1 truncate">
                              {job.name}
                            </p>
                            <p className="text-sm text-gray-500">{job.companyName}</p>
                            {job.isBlocked && job.blockerReason && (
                              <p className="text-xs text-orange-600 mt-1">
                                Blocker: {job.blockerReason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-500 shrink-0">
                          <div className="text-right">
                            <p className="font-medium text-gray-700">
                              {formatNumber(job.quantity)}
                            </p>
                            <p className="text-xs">qty</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-700">
                              {formatDate(job.dueDate)}
                            </p>
                            <p className="text-xs">due date</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {statusOrder.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No jobs match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
