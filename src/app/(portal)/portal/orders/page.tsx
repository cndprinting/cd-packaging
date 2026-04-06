"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { demoJobs } from "@/lib/demo-data";
import { cn, formatDate, getStatusColor, getStatusLabel, formatNumber } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Search, Eye, Clock, Filter, Loader2 } from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

export default function PortalOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        // Get the current user's companyId from session
        let companyId: string | null = null;
        try {
          const sessionRes = await fetch("/api/auth/session");
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            companyId = sessionData.user?.companyId || null;
          }
        } catch {
          // Session fetch failed, will use fallback companyId
        }

        // Fetch jobs from API
        const jobsRes = await fetch("/api/jobs");
        if (!cancelled && jobsRes.ok) {
          const data = await jobsRes.json();
          const jobs = data.jobs || [];

          // Filter to this customer's company
          const effectiveCompanyId = companyId || CUSTOMER_COMPANY_ID;
          const myJobs = jobs.filter((j: any) => j.companyId === effectiveCompanyId);

          if (myJobs.length > 0) {
            setAllJobs(myJobs);
          } else {
            // No jobs found for this company in API, fall back to demo data
            setAllJobs(demoJobs.filter((j) => j.companyId === (companyId || CUSTOMER_COMPANY_ID)));
          }
        } else if (!cancelled) {
          setAllJobs(demoJobs.filter((j) => j.companyId === CUSTOMER_COMPANY_ID));
        }
      } catch {
        if (!cancelled) {
          setAllJobs(demoJobs.filter((j) => j.companyId === CUSTOMER_COMPANY_ID));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJobs();
    return () => { cancelled = true; };
  }, []);

  const filteredJobs = allJobs.filter((job) => {
    const matchesSearch =
      search === "" ||
      job.name.toLowerCase().includes(search.toLowerCase()) ||
      job.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
      (job.orderNumber || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !["DELIVERED", "INVOICED"].includes(job.status)) ||
      (statusFilter === "completed" && ["DELIVERED", "INVOICED", "SHIPPED"].includes(job.status));

    return matchesSearch && matchesStatus;
  });

  const sortedJobs = [...filteredJobs].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          View and track all your packaging orders
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order name or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {["all", "active", "completed"].map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter === "all"
                    ? "All Orders"
                    : filter === "active"
                    ? "Active"
                    : "Completed"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No orders found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{job.jobNumber}</p>
                          <p className="text-xs text-gray-500">{job.orderNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-900">{job.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{job.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(job.status)}>
                          {getStatusLabel(job.status)}
                        </Badge>
                        {job.isLate && (
                          <Badge variant="destructive" className="ml-1.5 text-[10px]">
                            Late
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(job.dueDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(job.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/portal/orders/${job.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
