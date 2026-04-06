"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  Package,
  ClipboardList,
  Truck,
  MessageSquare,
  ShieldCheck,
  FileImage,
} from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  const job = useMemo(
    () => demoJobs.find((j) => j.id === jobId),
    [jobId]
  );

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Job not found</h2>
        <Link href="/dashboard/jobs">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

  const currentStageIndex = STAGES.indexOf(job.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/jobs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
            <Badge className={getStatusColor(job.status)}>
              {getStatusLabel(job.status)}
            </Badge>
            <Badge className={getPriorityColor(job.priority)}>
              {job.priority}
            </Badge>
            {job.isLate && (
              <Badge className="bg-red-100 text-red-700">LATE</Badge>
            )}
            {job.isBlocked && (
              <Badge className="bg-orange-100 text-orange-700">BLOCKED</Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {job.jobNumber} &middot; {job.companyName} &middot; Order{" "}
            <Link
              href={`/dashboard/orders/${job.orderId}`}
              className="text-green-700 hover:underline"
            >
              {job.orderNumber}
            </Link>
          </p>
          {job.isBlocked && job.blockerReason && (
            <p className="text-sm text-orange-600 mt-1">
              Blocker: {job.blockerReason}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit</Button>
          <Button>Advance Stage</Button>
        </div>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[900px]">
              {STAGES.map((stage, i) => {
                const isCompleted = i < currentStageIndex;
                const isCurrent = i === currentStageIndex;
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
                          i < currentStageIndex ? "bg-green-500" : "bg-gray-200"
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

      {/* Detail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Quantity</span>
            </div>
            <p className="text-lg font-semibold">{formatNumber(job.quantity)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Due Date</span>
            </div>
            <p className="text-lg font-semibold">{formatDate(job.dueDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Truck className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                Requested Ship
              </span>
            </div>
            <p className="text-lg font-semibold">{formatDate(job.dueDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <MapPin className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Plant</span>
            </div>
            <p className="text-lg font-semibold">Plant A - Main</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Team */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assigned Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">CSR</p>
                <p className="text-sm font-medium">{job.csrName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Sales Rep
                </p>
                <p className="text-sm font-medium">{job.salesRepName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Production Owner
                </p>
                <p className="text-sm font-medium">{job.productionOwnerName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Materials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Materials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Materials required for this job will be displayed here once
              assigned.
            </div>
          </CardContent>
        </Card>

        {/* Proof History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Proof History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {job.proofStatus ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Status</span>
                  <Badge
                    className={
                      job.proofStatus === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : job.proofStatus === "SENT"
                        ? "bg-blue-100 text-blue-700"
                        : job.proofStatus === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : job.proofStatus === "REVISION_REQUESTED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-700"
                    }
                  >
                    {job.proofStatus}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">Version 1 &middot; Uploaded 2 days ago</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                No proofs uploaded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QA Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              QA Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              QA inspection details will appear here when the job reaches QA
              stage.
            </div>
          </CardContent>
        </Card>

        {/* Shipment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Shipment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Shipment tracking information will be shown once the job is
              shipped.
            </div>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              No comments yet. Start a conversation about this job.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
