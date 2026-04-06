"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getStatusLabel,
  getPriorityColor,
  formatDate,
  formatNumber,
} from "@/lib/utils";

export default function QAPage() {
  const qaJobs = useMemo(
    () => demoJobs.filter((j) => j.status === "QA"),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quality Assurance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {qaJobs.length} job{qaJobs.length !== 1 ? "s" : ""} in QA
          </p>
        </div>
      </div>

      {qaJobs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No jobs currently in QA.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {qaJobs.map((job) => (
            <Card
              key={job.id}
              className={
                job.isBlocked
                  ? "border-l-4 border-l-orange-400"
                  : ""
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-gray-500">
                    {job.jobNumber}
                  </span>
                  <Badge className={getPriorityColor(job.priority)}>
                    {job.priority}
                  </Badge>
                </div>
                <CardTitle className="text-base">{job.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Customer:</span>{" "}
                      <span className="font-medium">{job.companyName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Qty:</span>{" "}
                      <span className="font-medium">
                        {formatNumber(job.quantity)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Due:</span>{" "}
                      <span className="font-medium">
                        {formatDate(job.dueDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">QA Hold:</span>{" "}
                      <span className="font-medium">
                        {job.isBlocked ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                  {job.isBlocked && job.blockerReason && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-orange-50 text-orange-700 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{job.blockerReason}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Pass
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Hold
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1">
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Fail
                    </Button>
                  </div>
                  <Link href={`/dashboard/jobs/${job.id}`}>
                    <Button variant="ghost" size="sm" className="w-full">
                      View Job Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
