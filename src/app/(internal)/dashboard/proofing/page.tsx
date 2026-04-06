"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileImage, Send, Eye } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function getProofStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-gray-100 text-gray-700";
    case "SENT":
      return "bg-blue-100 text-blue-700";
    case "APPROVED":
      return "bg-green-100 text-green-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "REVISION_REQUESTED":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function ProofingPage() {
  const proofJobs = useMemo(
    () => demoJobs.filter((j) => j.proofStatus),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Proofing &amp; Approvals
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {proofJobs.length} jobs with proofs
          </p>
        </div>
        <Button>Upload Proof</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proofJobs.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-gray-500">
                  {job.jobNumber}
                </span>
                <Badge className={getProofStatusColor(job.proofStatus!)}>
                  {job.proofStatus!.replace(/_/g, " ")}
                </Badge>
              </div>
              <CardTitle className="text-base">{job.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-500">{job.companyName}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <FileImage className="h-3.5 w-3.5" />
                  <span>Version 1</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Link href={`/dashboard/jobs/${job.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                  </Link>
                  {(job.proofStatus === "SENT" ||
                    job.proofStatus === "PENDING") && (
                    <Button variant="ghost" size="sm" className="flex-1">
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Send Reminder
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {proofJobs.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No proofs currently in progress.
          </div>
        )}
      </div>
    </div>
  );
}
