"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { demoJobs } from "@/lib/demo-data";
import { cn, formatDate, getStatusColor, getStatusLabel, formatNumber } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Check, Circle, Clock, Package, Truck, FileCheck,
  MapPin, CalendarDays, Hash, Loader2,
} from "lucide-react";

/** Simplified stages the customer sees. */
const CUSTOMER_STAGES = [
  { key: "received", label: "Received" },
  { key: "design", label: "In Design" },
  { key: "proof", label: "Proof Ready" },
  { key: "approved", label: "Approved" },
  { key: "production", label: "In Production" },
  { key: "qa", label: "QA" },
  { key: "shipping", label: "Shipping" },
  { key: "delivered", label: "Delivered" },
] as const;

/** Map internal status to the simplified customer stage index. */
function getCustomerStageIndex(status: string): number {
  const map: Record<string, number> = {
    QUOTE: 0,
    ARTWORK_RECEIVED: 0,
    STRUCTURAL_DESIGN: 1,
    PROOFING: 2,
    CUSTOMER_APPROVAL: 2,
    PREPRESS: 3,
    PLATING: 3,
    MATERIALS_ORDERED: 3,
    MATERIALS_RECEIVED: 3,
    SCHEDULED: 3,
    PRINTING: 4,
    COATING_FINISHING: 4,
    DIE_CUTTING: 4,
    GLUING_FOLDING: 4,
    QA: 5,
    PACKED: 6,
    SHIPPED: 6,
    DELIVERED: 7,
    INVOICED: 7,
  };
  return map[status] ?? 0;
}

export default function PortalOrderDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.job) {
            // Normalize DB job shape to match demo shape
            const j = data.job;
            const normalized = data.source === "database"
              ? {
                  id: j.id,
                  jobNumber: j.jobNumber,
                  orderNumber: j.order?.orderNumber || j.orderNumber || "",
                  name: j.name,
                  description: j.description || "",
                  companyId: j.order?.companyId || j.companyId || "",
                  companyName: j.order?.company?.name || j.companyName || "",
                  status: j.status,
                  priority: j.priority || "NORMAL",
                  quantity: j.quantity || 0,
                  dueDate: j.dueDate ? (typeof j.dueDate === "string" ? j.dueDate.split("T")[0] : j.dueDate) : "",
                  csrName: j.csrName || "",
                  salesRepName: j.salesRepName || "",
                  proofStatus: j.proofs?.[0]?.status || j.proofStatus || null,
                  isLate: j.isLate ?? false,
                  isBlocked: j.isBlocked ?? false,
                }
              : j;
            setJob(normalized);
          } else {
            // API returned no job, try demo fallback
            const demoJob = demoJobs.find((d) => d.id === jobId);
            if (demoJob) {
              setJob(demoJob);
            } else {
              setNotFound(true);
            }
          }
        } else if (!cancelled) {
          // API error - fall back to demo
          const demoJob = demoJobs.find((d) => d.id === jobId);
          if (demoJob) {
            setJob(demoJob);
          } else {
            setNotFound(true);
          }
        }
      } catch {
        if (!cancelled) {
          const demoJob = demoJobs.find((d) => d.id === jobId);
          if (demoJob) {
            setJob(demoJob);
          } else {
            setNotFound(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJob();
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Package className="h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Order not found.</p>
        <Link href="/portal/orders">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const activeStageIndex = getCustomerStageIndex(job.status);

  const isShipped = ["SHIPPED", "DELIVERED", "INVOICED"].includes(job.status);
  const isProofPending = job.proofStatus === "SENT" || job.proofStatus === "PENDING";

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/portal/orders">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{job.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.jobNumber} &middot; {job.orderNumber}
          </p>
        </div>
      </div>

      {/* Progress Stepper */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
            <div
              className="absolute top-4 left-4 h-0.5 bg-brand-600 transition-all duration-500"
              style={{
                width: `${(activeStageIndex / (CUSTOMER_STAGES.length - 1)) * 100}%`,
                maxWidth: "calc(100% - 2rem)",
              }}
            />

            {/* Steps */}
            <div className="relative flex justify-between">
              {CUSTOMER_STAGES.map((stage, idx) => {
                const isComplete = idx < activeStageIndex;
                const isCurrent = idx === activeStageIndex;
                return (
                  <div key={stage.key} className="flex flex-col items-center" style={{ width: "12.5%" }}>
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center h-8 w-8 rounded-full border-2 transition-colors",
                        isComplete
                          ? "bg-brand-600 border-brand-600 text-white"
                          : isCurrent
                          ? "bg-white border-brand-600 text-brand-600"
                          : "bg-white border-gray-300 text-gray-400"
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "mt-2 text-xs text-center leading-tight",
                        isCurrent ? "font-semibold text-brand-700" : isComplete ? "text-gray-700" : "text-gray-400"
                      )}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem icon={Hash} label="Job Number" value={job.jobNumber} />
              <DetailItem icon={Package} label="Order" value={job.orderNumber} />
              <DetailItem icon={CalendarDays} label="Due Date" value={formatDate(job.dueDate)} />
              <DetailItem icon={Hash} label="Quantity" value={formatNumber(job.quantity)} />
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Description</p>
              <p className="text-sm text-gray-500 mt-1">{job.description}</p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Current Status</p>
              <Badge className={cn("mt-1.5", getStatusColor(job.status))}>
                {getStatusLabel(job.status)}
              </Badge>
              {job.isLate && (
                <Badge variant="destructive" className="ml-2 mt-1.5">
                  Past Due
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Conditional Panels */}
        <div className="space-y-6">
          {/* Proof Approval Section */}
          {isProofPending && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-amber-600" />
                  Proof Pending Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  A proof is ready for your review. Please review and approve to keep your order on schedule.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    Approve Proof
                  </Button>
                  <Button variant="outline" size="sm">
                    Request Revision
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  This is a demo. Clicking will not submit an actual approval.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Shipment Tracking */}
          {isShipped && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  Shipment Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Carrier</p>
                    <p className="text-sm font-medium text-gray-900">FedEx Freight</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tracking Number</p>
                    <p className="text-sm font-medium text-brand-600">7489 2034 5612</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Ship Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(job.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Est. Delivery</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(
                        new Date(new Date(job.dueDate).getTime() + 3 * 86400000).toISOString()
                      )}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      {job.status === "DELIVERED" || job.status === "INVOICED"
                        ? "Delivered to your facility"
                        : "In transit - Memphis, TN distribution center"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your C&D Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.csrName}</p>
                  <p className="text-xs text-gray-500">Customer Service Rep</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.salesRepName}</p>
                  <p className="text-xs text-gray-500">Sales Representative</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
