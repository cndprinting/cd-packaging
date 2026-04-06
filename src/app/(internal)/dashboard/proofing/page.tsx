"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileImage, Send, Eye, Plus, X, Loader2 } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

const proofStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  REVISION_REQUESTED: "bg-amber-100 text-amber-700",
};

export default function ProofingPage() {
  const proofJobs = useMemo(() => demoJobs.filter((j) => j.proofStatus), []);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ jobId: "", notes: "" });
  const [feedback, setFeedback] = useState("");
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set());

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.jobId) return;
    setUploading(true);
    try {
      await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: uploadForm.jobId, notes: uploadForm.notes }) });
      setFeedback("Proof uploaded successfully");
    } catch {
      setFeedback("Proof created (demo mode)");
    }
    setUploading(false);
    setShowUploadModal(false);
    setUploadForm({ jobId: "", notes: "" });
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleReminder = (jobId: string) => {
    setSentReminders((prev) => new Set(prev).add(jobId));
    setTimeout(() => setSentReminders((prev) => { const n = new Set(prev); n.delete(jobId); return n; }), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><FileImage className="h-6 w-6 text-brand-600" /><div><h1 className="text-2xl font-bold text-gray-900">Proofing & Approvals</h1><p className="text-sm text-gray-500">{proofJobs.length} jobs with proofs</p></div></div>
        <Button onClick={() => setShowUploadModal(true)} className="gap-2"><Plus className="h-4 w-4" />Upload Proof</Button>
      </div>

      {feedback && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3">{feedback}</div>}

      <div className="space-y-3">
        {proofJobs.map((j) => (
          <Card key={j.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/jobs/${j.id}`} className="font-semibold text-gray-900 hover:text-brand-600">{j.jobNumber}</Link>
                  <Badge className={proofStatusColors[j.proofStatus || "PENDING"]}>{j.proofStatus}</Badge>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{j.name}</p>
                <p className="text-sm text-gray-500">{j.companyName} &middot; Version 1</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/dashboard/jobs/${j.id}`}><Button variant="outline" size="sm" className="gap-1.5"><Eye className="h-3.5 w-3.5" />View</Button></Link>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleReminder(j.id)} disabled={sentReminders.has(j.id)}>
                  <Send className="h-3.5 w-3.5" />{sentReminders.has(j.id) ? "Sent!" : "Send Reminder"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showUploadModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowUploadModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Upload Proof</h2><button onClick={() => setShowUploadModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={handleUpload} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Select Job</label>
                  <select value={uploadForm.jobId} onChange={(e) => setUploadForm(p => ({ ...p, jobId: e.target.value }))} className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option value="">Choose a job...</option>
                    {demoJobs.map((j) => <option key={j.id} value={j.id}>{j.jobNumber} - {j.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><Input value={uploadForm.notes} onChange={(e) => setUploadForm(p => ({ ...p, notes: e.target.value }))} placeholder="Version notes..." /></div>
                <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-sm text-gray-400">File upload area (drag & drop or click)</div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowUploadModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={uploading || !uploadForm.jobId}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload Proof"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
