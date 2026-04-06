"use client";

import {
  Clock,
  AlertTriangle,
  BarChart3,
  Timer,
  Layers,
  Package,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REPORTS = [
  {
    title: "On-Time Shipment",
    description:
      "Track shipment accuracy and on-time delivery percentage over time.",
    icon: Truck,
    color: "text-green-600 bg-green-50",
  },
  {
    title: "Late Jobs",
    description:
      "Review all jobs that are currently past due or at risk of being late.",
    icon: AlertTriangle,
    color: "text-red-600 bg-red-50",
  },
  {
    title: "Jobs by Customer",
    description:
      "Breakdown of active and completed jobs grouped by customer.",
    icon: BarChart3,
    color: "text-blue-600 bg-blue-50",
  },
  {
    title: "Cycle Time",
    description:
      "Analyze average time from order creation to delivery across all jobs.",
    icon: Timer,
    color: "text-purple-600 bg-purple-50",
  },
  {
    title: "Stage Delays",
    description:
      "Identify bottlenecks by analyzing time spent at each production stage.",
    icon: Clock,
    color: "text-amber-600 bg-amber-50",
  },
  {
    title: "Blocked Jobs",
    description:
      "Summary of all currently blocked jobs with reasons and resolution status.",
    icon: Layers,
    color: "text-orange-600 bg-orange-50",
  },
  {
    title: "Material Shortage",
    description:
      "Materials below reorder point or with shortages impacting production.",
    icon: Package,
    color: "text-rose-600 bg-rose-50",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate and view production reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.title}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${report.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {report.description}
                </CardDescription>
                <Button variant="outline" size="sm" className="w-full">
                  Generate
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
