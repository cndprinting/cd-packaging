"use client";

import React, { useState } from "react";
import Link from "next/link";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileImage, CheckCircle, X, Loader2 } from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

export default function PortalProofsPage() {
  const customerJobs = demoJobs.filter((j) => j.companyId === CUSTOMER_COMPANY_ID && j.proofStatus);
  const pendingProofs = customerJobs.filter((j) => j.proofStatus === "SENT" || j.proofStatus === "PENDING");
  const approvedProofs = customerJobs.filter((j) => j.proofStatus === "APPROVED");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRevisionFor, setShowRevisionFor] = useState<string | null>(null);
  const [revisionComment, setRevisionComment] = useState("");
  const [actionResults, setActionResults] = useState<Record<string, string>>({});

  const handleApprove = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofId: jobId, action: "approve" }) });
    } catch { /* demo fallback */ }
    setActionResults((p) => ({ ...p, [jobId]: "APPROVED" }));
    setActionLoading(null);
  };

  const handleReject = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofId: jobId, action: "reject", comments: revisionComment }) });
    } catch { /* demo fallback */ }
    setActionResults((p) => ({ ...p, [jobId]: "REVISION_REQUESTED" }));
    setActionLoading(null);
    setShowRevisionFor(null);
    setRevisionComment("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><FileImage className="h-6 w-6 text-brand-600" /><h1 className="text-2xl font-bold text-gray-900">Proof Approvals</h1></div>

      {pendingProofs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pending Your Approval</h2>
          {pendingProofs.map((j) => {
            const result = actionResults[j.id];
            return (
              <Card key={j.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{j.jobNumber}</p>
                      {result ? <Badge className={result === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>{result === "APPROVED" ? "Approved" : "Revision Requested"}</Badge> : <Badge className="bg-blue-100 text-blue-700">Awaiting Approval</Badge>}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{j.name}</p>
                    <p className="text-xs text-gray-500">Version 1 &middot; Proof sent 2 days ago</p>
                    <div className="mt-3 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">Proof Preview</div>
                  </div>
                  {!result && (
                    <div className="flex flex-col gap-2 ml-4">
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(j.id)} disabled={actionLoading === j.id}>
                        {actionLoading === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-amber-600" onClick={() => setShowRevisionFor(showRevisionFor === j.id ? null : j.id)}>
                        <X className="h-4 w-4" />Revision
                      </Button>
                    </div>
                  )}
                </div>
                {showRevisionFor === j.id && (
                  <div className="mt-3 flex gap-2">
                    <Input placeholder="What needs to change?" value={revisionComment} onChange={(e) => setRevisionComment(e.target.value)} className="flex-1" autoFocus />
                    <Button size="sm" onClick={() => handleReject(j.id)} disabled={actionLoading === j.id}>Submit</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {approvedProofs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Previously Approved</h2>
          {approvedProofs.map((j) => (
            <Card key={j.id} className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">{j.jobNumber} — {j.name}</p><p className="text-xs text-gray-500">Approved</p></div>
                <Badge className="bg-green-100 text-green-700">Approved</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pendingProofs.length === 0 && approvedProofs.length === 0 && (
        <div className="text-center py-12 text-gray-400"><FileImage className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No proofs to review</p></div>
      )}
    </div>
  );
}
