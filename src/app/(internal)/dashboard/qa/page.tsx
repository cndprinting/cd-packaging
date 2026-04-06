"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, CheckCircle, AlertTriangle, X, Loader2 } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export default function QAPage() {
  const [jobs, setJobs] = useState(demoJobs.filter((j) => j.status === "QA"));
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ id: string; msg: string; type: "success" | "error" } | null>(null);

  const handleQA = async (jobId: string, action: "pass" | "hold" | "fail") => {
    if ((action === "hold" || action === "fail") && !notesFor) {
      setNotesFor(jobId);
      return;
    }
    setLoadingId(jobId);
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ id: jobId, msg: data.error || "Failed", type: "error" });
      } else {
        if (action === "pass") {
          setJobs((prev) => prev.filter((j) => j.id !== jobId));
          setFeedback({ id: jobId, msg: "Passed QA — moved to Packed", type: "success" });
        } else if (action === "fail") {
          setJobs((prev) => prev.filter((j) => j.id !== jobId));
          setFeedback({ id: jobId, msg: "Failed QA — sent back to production", type: "success" });
        } else {
          setFeedback({ id: jobId, msg: "QA hold applied", type: "success" });
        }
      }
    } catch {
      setFeedback({ id: jobId, msg: "Something went wrong", type: "error" });
    }
    setLoadingId(null);
    setNotesFor(null);
    setNotes("");
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Assurance</h1>
          <p className="text-sm text-gray-500">{jobs.length} jobs in QA</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {feedback.msg}
        </div>
      )}

      <div className="space-y-4">
        {jobs.map((j) => (
          <Card key={j.id} className={`p-5 ${j.isBlocked ? "border-l-4 border-l-red-500" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/jobs/${j.id}`} className="font-semibold text-gray-900 hover:text-brand-600">{j.jobNumber}</Link>
                  <Badge className="bg-yellow-100 text-yellow-700">In QA</Badge>
                  {j.isBlocked && <Badge className="bg-red-100 text-red-700">Hold</Badge>}
                </div>
                <p className="text-sm text-gray-700 mt-1">{j.name}</p>
                <p className="text-sm text-gray-500">{j.companyName} &middot; Qty: {j.quantity.toLocaleString()} &middot; Due: {formatDate(j.dueDate)}</p>
                {j.blockerReason && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />{j.blockerReason}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleQA(j.id, "pass")} disabled={loadingId === j.id}>
                  {loadingId === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}Pass
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-300" onClick={() => handleQA(j.id, "hold")} disabled={loadingId === j.id}>
                  <AlertTriangle className="h-4 w-4" />Hold
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-300" onClick={() => handleQA(j.id, "fail")} disabled={loadingId === j.id}>
                  <X className="h-4 w-4" />Fail
                </Button>
              </div>
            </div>
            {notesFor === j.id && (
              <div className="mt-3 flex gap-2">
                <Input placeholder="Add notes (reason for hold/fail)..." value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1" autoFocus />
                <Button size="sm" onClick={() => handleQA(j.id, notesFor === j.id ? "hold" : "fail")}>Submit</Button>
                <Button size="sm" variant="ghost" onClick={() => { setNotesFor(null); setNotes(""); }}>Cancel</Button>
              </div>
            )}
          </Card>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No jobs currently in QA</p>
          </div>
        )}
      </div>
    </div>
  );
}
