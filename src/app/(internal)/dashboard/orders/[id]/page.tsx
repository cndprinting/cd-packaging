"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  User,
  Clock,
  Package,
  MessageSquare,
} from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  formatDate,
  formatNumber,
} from "@/lib/utils";

const STAGES = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const orderJobs = useMemo(
    () => demoJobs.filter((j) => j.orderId === orderId),
    [orderId]
  );

  if (orderJobs.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Order not found</h2>
        <Link href="/dashboard/orders">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const order = {
    orderId,
    orderNumber: orderJobs[0].orderNumber,
    companyName: orderJobs[0].companyName,
    csrName: orderJobs[0].csrName,
    salesRepName: orderJobs[0].salesRepName,
    productionOwnerName: orderJobs[0].productionOwnerName,
  };

  // Get highest stage index across all jobs to determine overall progress
  const highestStageIndex = Math.max(
    ...orderJobs.map((j) => STAGES.indexOf(j.status))
  );
  const overallStatus = STAGES[highestStageIndex] || orderJobs[0].status;
  const earliestDue = orderJobs.reduce(
    (min, j) => (new Date(j.dueDate) < new Date(min) ? j.dueDate : min),
    orderJobs[0].dueDate
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {order.orderNumber}
            </h1>
            <Badge className={getStatusColor(overallStatus)}>
              {getStatusLabel(overallStatus)}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {order.companyName} &middot; Due {formatDate(earliestDue)} &middot;{" "}
            {orderJobs.length} job{orderJobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline">Edit Order</Button>
      </div>

      {/* Stage Progress Stepper */}
      <Card>
        <CardHeader>
          <CardTitle>Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[900px]">
              {STAGES.map((stage, i) => {
                const isCompleted = i < highestStageIndex;
                const isCurrent = i === highestStageIndex;
                return (
                  <div key={stage} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCompleted
                            ? "bg-green-600 text-white"
                            : isCurrent
                            ? "bg-green-600 text-white ring-4 ring-green-100"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] mt-1 text-center leading-tight ${
                          isCurrent
                            ? "font-semibold text-green-700"
                            : isCompleted
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {getStatusLabel(stage)}
                      </span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div
                        className={`h-0.5 w-full ${
                          i < highestStageIndex ? "bg-green-500" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">CSR</p>
                <p className="text-sm font-medium">{order.csrName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Sales Rep
                </p>
                <p className="text-sm font-medium">{order.salesRepName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Production Owner
                </p>
                <p className="text-sm font-medium">
                  {order.productionOwnerName}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Production Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              No production notes yet. Add notes about special handling or
              requirements.
            </div>
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-gray-700">Order created</p>
                  <p className="text-xs text-gray-400">3 days ago</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-gray-700">Jobs scheduled</p>
                  <p className="text-xs text-gray-400">2 days ago</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-gray-700">Awaiting updates...</p>
                  <p className="text-xs text-gray-400">Activity log placeholder</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs in this Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono">{job.jobNumber}</TableCell>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(job.status)}>
                      {getStatusLabel(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(job.priority)}>
                      {job.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatNumber(job.quantity)}</TableCell>
                  <TableCell>{formatDate(job.dueDate)}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/jobs/${job.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
