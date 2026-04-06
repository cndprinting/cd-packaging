"use client";

import React from "react";
import Link from "next/link";
import { demoJobs } from "@/lib/demo-data";
import { cn, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileCheck, CheckCircle, RotateCcw, Clock, Image, FileText, Eye,
} from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

interface Proof {
  id: string;
  jobId: string;
  jobName: string;
  jobNumber: string;
  version: number;
  status: "pending" | "approved" | "revision_requested";
  sentDate: string;
  approvedDate?: string;
  notes?: string;
}

function generateProofs(): Proof[] {
  const myJobs = demoJobs.filter((j) => j.companyId === CUSTOMER_COMPANY_ID);
  const proofs: Proof[] = [];

  myJobs.forEach((job) => {
    if (job.proofStatus === "SENT" || job.proofStatus === "PENDING") {
      proofs.push({
        id: `proof-${job.id}-v2`,
        jobId: job.id,
        jobName: job.name,
        jobNumber: job.jobNumber,
        version: 2,
        status: "pending",
        sentDate: new Date(new Date(job.dueDate).getTime() - 7 * 86400000).toISOString(),
        notes: "Updated with revised color profile and logo placement.",
      });
    }

    // Add historical approved proofs for jobs past proofing stage
    const pastProofStages = [
      "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED",
      "SCHEDULED", "PRINTING", "COATING_FINISHING", "DIE_CUTTING",
      "GLUING_FOLDING", "QA", "PACKED", "SHIPPED", "DELIVERED", "INVOICED",
    ];
    if (pastProofStages.includes(job.status)) {
      proofs.push({
        id: `proof-${job.id}-v1`,
        jobId: job.id,
        jobName: job.name,
        jobNumber: job.jobNumber,
        version: 1,
        status: "approved",
        sentDate: new Date(new Date(job.dueDate).getTime() - 14 * 86400000).toISOString(),
        approvedDate: new Date(new Date(job.dueDate).getTime() - 12 * 86400000).toISOString(),
      });
    }
  });

  return proofs;
}

export default function PortalProofsPage() {
  const proofs = generateProofs();

  const pendingProofs = proofs.filter((p) => p.status === "pending");
  const approvedProofs = proofs.filter((p) => p.status === "approved");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proof Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve proofs for your packaging orders
        </p>
      </div>

      {/* Pending Proofs */}
      {pendingProofs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Approval ({pendingProofs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingProofs.map((proof) => (
              <Card key={proof.id} className="border-amber-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{proof.jobName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {proof.jobNumber} &middot; Version {proof.version}
                      </p>
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>

                  {/* Mock proof preview */}
                  <div className="flex items-center justify-center h-36 rounded-lg bg-gray-100 border border-gray-200 mb-3">
                    <div className="text-center">
                      <Image className="h-8 w-8 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Proof Preview</p>
                    </div>
                  </div>

                  {proof.notes && (
                    <p className="text-sm text-gray-600 mb-3">{proof.notes}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Sent {formatDate(proof.sentDate)}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button variant="outline" size="sm">
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Revision
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            This is a demo. Clicking Approve or Revision will not submit an actual response.
          </p>
        </div>
      )}

      {pendingProofs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">All caught up!</p>
            <p className="text-xs text-gray-500 mt-1">
              No proofs are waiting for your approval.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Approved Proofs */}
      {approvedProofs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Approved Proofs ({approvedProofs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedProofs.map((proof) => (
              <Card key={proof.id} className="border-emerald-100">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{proof.jobName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {proof.jobNumber} &middot; v{proof.version}
                      </p>
                    </div>
                    <Badge variant="success">Approved</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>Sent {formatDate(proof.sentDate)}</span>
                    {proof.approvedDate && (
                      <span>Approved {formatDate(proof.approvedDate)}</span>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Link href={`/portal/orders/${proof.jobId}`}>
                      <Button variant="ghost" size="sm" className="text-brand-600 px-0">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Order
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
