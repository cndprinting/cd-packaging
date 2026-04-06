"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { demoJobs, demoAlerts } from "@/lib/demo-data";
import { formatDate, getStatusColor, getStatusLabel, formatNumber } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Package, Factory, Truck, CheckCircle, AlertTriangle, ArrowRight, Clock,
} from "lucide-react";

export default function PortalDashboard() {
  const [companyId, setCompanyId] = useState<string>("co-1");

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(d => { if (d.user?.companyId) setCompanyId(d.user.companyId); })
      .catch(() => {});
  }, []);

  const myJobs = demoJobs.filter((j) => j.companyId === companyId);

  const activeOrders = myJobs.filter(
    (j) => !["DELIVERED", "INVOICED"].includes(j.status)
  ).length;
  const inProduction = myJobs.filter((j) =>
    ["PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING"].includes(j.status)
  ).length;
  const readyToShip = myJobs.filter((j) => j.status === "PACKED").length;
  const delivered = myJobs.filter((j) =>
    ["DELIVERED", "INVOICED", "SHIPPED"].includes(j.status)
  ).length;

  const kpiCards = [
    { label: "Active Orders", value: activeOrders, icon: Package, color: "text-blue-600 bg-blue-50" },
    { label: "In Production", value: inProduction, icon: Factory, color: "text-amber-600 bg-amber-50" },
    { label: "Ready to Ship", value: readyToShip, icon: Truck, color: "text-emerald-600 bg-emerald-50" },
    { label: "Delivered", value: delivered, icon: CheckCircle, color: "text-green-600 bg-green-50" },
  ];

  const recentJobs = myJobs
    .filter((j) => !["INVOICED"].includes(j.status))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);

  const myAlerts = demoAlerts.filter((a) => {
    const job = demoJobs.find((j) => j.id === a.jobId);
    return job && job.companyId === companyId;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your packaging orders with C&D Packaging
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                </div>
                <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Link href="/portal/orders">
              <Button variant="ghost" size="sm" className="text-brand-600">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/portal/orders/${job.id}`}
                        className="font-medium text-gray-900 hover:text-brand-600 transition-colors"
                      >
                        {job.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">{job.jobNumber}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusLabel(job.status)}
                      </Badge>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {myAlerts.length === 0 ? (
              <p className="text-sm text-gray-500">No active alerts for your orders.</p>
            ) : (
              <div className="space-y-3">
                {myAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      alert.severity === "CRITICAL"
                        ? "border-red-200 bg-red-50"
                        : alert.severity === "WARNING"
                        ? "border-amber-200 bg-amber-50"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        alert.severity === "CRITICAL"
                          ? "text-red-500"
                          : alert.severity === "WARNING"
                          ? "text-amber-500"
                          : "text-blue-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(alert.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
