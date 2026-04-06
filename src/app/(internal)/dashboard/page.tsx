"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Factory,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  Warehouse,
  Truck,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getKPIs, getJobsByStatus, demoJobs, demoAlerts } from "@/lib/demo-data";
import { getStatusColor, getStatusLabel, getPriorityColor, formatDate } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  delta?: { value: string; trend: "up" | "down" | "neutral" };
}

function KPICard({ icon: Icon, iconBg, iconColor, value, label, delta }: KPICardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {delta && (
              <div className="flex items-center gap-1">
                {delta.trend === "up" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : delta.trend === "down" ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                ) : null}
                <span
                  className={`text-xs font-medium ${
                    delta.trend === "up"
                      ? "text-emerald-600"
                      : delta.trend === "down"
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  {delta.value}
                </span>
              </div>
            )}
          </div>
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return <Badge className="bg-red-100 text-red-700 border-red-200">Critical</Badge>;
    case "WARNING":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Warning</Badge>;
    case "INFO":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Info</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState(() => getKPIs());
  const [recentJobs, setRecentJobs] = useState(() => demoJobs.slice(0, 8));
  const [alerts, setAlerts] = useState(() => demoAlerts);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => {
        if (d.kpis) setKpis(d.kpis);
        if (d.recentJobs?.length) setRecentJobs(d.recentJobs);
        if (d.alerts?.length) setAlerts(d.alerts);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Plant overview and production status</p>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={Package}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          value={kpis.openJobs}
          label="Open Jobs"
          delta={{ value: "+3 this week", trend: "up" }}
        />
        <KPICard
          icon={Factory}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          value={kpis.inProduction}
          label="In Production"
        />
        <KPICard
          icon={Calendar}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          value={kpis.dueThisWeek}
          label="Due This Week"
        />
        <KPICard
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          value={kpis.lateJobs}
          label="Late Jobs"
          delta={{ value: "+1 since yesterday", trend: "down" }}
        />
        <KPICard
          icon={ShieldCheck}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          value={kpis.blockedJobs}
          label="Blocked Jobs"
        />
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={FileCheck}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          value={kpis.proofsPending}
          label="Proofs Pending"
        />
        <KPICard
          icon={Warehouse}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          value={kpis.materialShortages}
          label="Material Shortages"
          delta={{ value: "2 critical", trend: "down" }}
        />
        <KPICard
          icon={Truck}
          iconBg="bg-teal-100"
          iconColor="text-teal-600"
          value={kpis.readyToShip}
          label="Ready to Ship"
        />
        <KPICard
          icon={Target}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          value={`${kpis.onTimeShipmentPct}%`}
          label="On-Time Ship %"
          delta={{ value: "+2.1% vs last month", trend: "up" }}
        />
        <KPICard
          icon={Clock}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          value={`${kpis.avgCycleTimeDays}d`}
          label="Avg Cycle Time"
          delta={{ value: "-0.8d improvement", trend: "up" }}
        />
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {demoAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityBadge(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(alert.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-600" />
            Recent Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Job #</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Customer</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Priority</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-medium text-gray-900">
                        {job.jobNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-gray-900">{job.name}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{job.companyName}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {getStatusLabel(job.status)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(
                          job.priority
                        )}`}
                      >
                        {job.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className={job.isLate ? "text-red-600 font-medium" : "text-gray-600"}>
                          {formatDate(job.dueDate)}
                        </span>
                        {job.isLate && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            LATE
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
