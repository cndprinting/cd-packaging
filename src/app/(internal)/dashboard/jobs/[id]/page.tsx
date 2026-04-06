"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowLeft, CheckCircle, Calendar, MapPin, Users, Package,
  ClipboardList, Truck, MessageSquare, ShieldCheck, FileImage,
  Loader2, ChevronRight, Pencil, X, Check, Trash2,
} from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getStatusColor, getStatusLabel, getPriorityColor, formatDate, formatNumber } from "@/lib/utils";

import { PRODUCT_TYPES } from "@/lib/demo-data";

const STAGES_FOLDING_CARTON = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

const STAGES_COMMERCIAL_PRINT = [
  "QUOTE","ARTWORK_RECEIVED","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

interface JobData {
  id: string;
  jobNumber: string;
  orderId: string;
  orderNumber: string;
  name: string;
  description?: string;
  companyId: string;
  companyName: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string;
  csrName: string;
  salesRepName: string;
  productionOwnerName: string;
  isLate: boolean;
  isBlocked: boolean;
  blockerReason?: string;
  proofStatus?: string;
  productType?: string;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", quantity: "", dueDate: "", priority: "NORMAL" });

  // Fetch job from API first, fall back to demo data
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (res.ok && data.job) {
          const j = data.job;
          // Handle both DB format and demo format
          const formatted: JobData = {
            id: j.id,
            jobNumber: j.jobNumber,
            orderId: j.orderId || j.order?.id || "",
            orderNumber: j.orderNumber || j.order?.orderNumber || "",
            name: j.name,
            description: j.description || "",
            companyId: j.companyId || j.order?.companyId || "",
            companyName: j.companyName || j.order?.company?.name || "",
            status: j.status,
            priority: j.priority,
            quantity: j.quantity,
            dueDate: j.dueDate ? (typeof j.dueDate === "string" ? j.dueDate.split("T")[0] : new Date(j.dueDate).toISOString().split("T")[0]) : "",
            csrName: j.csrName || j.csr?.name || "Unassigned",
            salesRepName: j.salesRepName || j.salesRep?.name || "Unassigned",
            productionOwnerName: j.productionOwnerName || j.productionOwner?.name || "Unassigned",
            isLate: j.isLate || false,
            isBlocked: j.isBlocked || false,
            blockerReason: j.blockerReason,
            proofStatus: j.proofStatus,
            productType: j.productType,
          };
          setJob(formatted);
          setEditForm({ name: formatted.name, description: formatted.description || "", quantity: String(formatted.quantity), dueDate: formatted.dueDate, priority: formatted.priority });
          setLoading(false);
          return;
        }
      } catch { /* fall through to demo */ }

      // Fallback to demo data
      const found = demoJobs.find((j) => j.id === jobId);
      if (found) {
        setJob({ ...found, status: found.status as string, priority: found.priority as string });
        setEditForm({ name: found.name, description: found.description || "", quantity: String(found.quantity), dueDate: found.dueDate, priority: found.priority });
      }
      setLoading(false);
    }
    fetchJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Job not found</h2>
        <Link href="/dashboard/jobs"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Jobs</Button></Link>
      </div>
    );
  }

  const STAGES = job.productType === "COMMERCIAL_PRINT" ? STAGES_COMMERCIAL_PRINT : STAGES_FOLDING_CARTON;
  const currentStageIndex = STAGES.indexOf(job.status);

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "advance" }) });
      if (res.ok) {
        const nextStatus = STAGES[currentStageIndex + 1];
        if (nextStatus) {
          setJob({ ...job, status: nextStatus });
          setFeedback({ msg: `Advanced to ${getStatusLabel(nextStatus)}`, type: "success" });
        }
      } else {
        // Demo fallback
        const nextStatus = STAGES[currentStageIndex + 1];
        if (nextStatus) {
          setJob({ ...job, status: nextStatus });
          setFeedback({ msg: `Advanced to ${getStatusLabel(nextStatus)} (demo)`, type: "success" });
        }
      }
    } catch {
      const nextStatus = STAGES[currentStageIndex + 1];
      if (nextStatus) {
        setJob({ ...job, status: nextStatus });
        setFeedback({ msg: `Advanced to ${getStatusLabel(nextStatus)} (demo)`, type: "success" });
      }
    }
    setAdvancing(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
    } catch { /* ok */ }
    setJob({ ...job, name: editForm.name, quantity: parseInt(editForm.quantity) || job.quantity, dueDate: editForm.dueDate || job.dueDate, priority: editForm.priority });
    setEditing(false);
    setSaving(false);
    setFeedback({ msg: "Job updated", type: "success" });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    } catch { /* ok */ }
    setDeleting(false);
    router.push("/dashboard/jobs");
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={`p-3 rounded-lg text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{feedback.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/jobs"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
            <Badge className={getStatusColor(job.status)}>{getStatusLabel(job.status)}</Badge>
            <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
            {job.isLate && <Badge className="bg-red-100 text-red-700">LATE</Badge>}
            {job.isBlocked && <Badge className="bg-orange-100 text-orange-700">BLOCKED</Badge>}
            {job.productType && <Badge className={job.productType === "FOLDING_CARTON" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}>{job.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"}</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-1">{job.jobNumber} &middot; {job.companyName} &middot; Order <Link href={`/dashboard/orders/${job.orderId}`} className="text-green-700 hover:underline">{job.orderNumber}</Link></p>
        </div>
        <div className="flex gap-2">
          {!confirmDelete ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(!editing); if (!editing) setEditForm({ name: job.name, description: job.description || "", quantity: String(job.quantity), dueDate: job.dueDate, priority: job.priority }); }} className="gap-1.5">
                {editing ? <><X className="h-4 w-4" />Cancel</> : <><Pencil className="h-4 w-4" />Edit</>}
              </Button>
              <Button variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />Delete
              </Button>
              <Button onClick={handleAdvance} disabled={advancing || currentStageIndex >= STAGES.length - 1} className="gap-1.5">
                {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                Advance Stage
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <span className="text-sm text-red-700">Delete this job?</span>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Delete"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card className="p-4 border-brand-200 bg-brand-50/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Job Name</label><Input value={editForm.name} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label><Input type="number" value={editForm.quantity} onChange={(e) => setEditForm(p => ({ ...p, quantity: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label><Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label><Select value={editForm.priority} onChange={(e) => setEditForm(p => ({ ...p, priority: e.target.value }))} options={[{ value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} /></div>
          </div>
          <div className="flex justify-end mt-3"><Button onClick={handleSaveEdit} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save Changes</Button></div>
        </Card>
      )}

      {/* Stage Progress — Click any stage to jump directly */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stage Progress</CardTitle>
            <span className="text-xs text-gray-400">Click any stage to jump to it</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[900px]">
              {STAGES.map((stage, i) => {
                const isCompleted = i < STAGES.indexOf(job.status);
                const isCurrent = i === STAGES.indexOf(job.status);
                return (
                  <div key={stage} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <button
                        onClick={async () => {
                          if (stage === job.status) return;
                          try { await fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setStatus", status: stage }) }); } catch {}
                          setJob({ ...job, status: stage });
                          setFeedback({ msg: `Jumped to ${getStatusLabel(stage)}`, type: "success" });
                          setTimeout(() => setFeedback(null), 2000);
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium cursor-pointer transition-transform hover:scale-125 ${isCompleted ? "bg-green-600 text-white" : isCurrent ? "bg-green-600 text-white ring-4 ring-green-100" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                        title={`Jump to: ${getStatusLabel(stage)}`}
                      >
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <span>{i + 1}</span>}
                      </button>
                      <span className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? "font-semibold text-green-700" : isCompleted ? "text-green-600" : "text-gray-400"}`}>{getStatusLabel(stage)}</span>
                    </div>
                    {i < STAGES.length - 1 && <div className={`h-0.5 w-full ${i < STAGES.indexOf(job.status) ? "bg-green-500" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-gray-500 mb-1"><Package className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Quantity</span></div><p className="text-lg font-semibold">{formatNumber(job.quantity)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-gray-500 mb-1"><Calendar className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Due Date</span></div><p className="text-lg font-semibold">{job.dueDate ? formatDate(job.dueDate) : "Not set"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-gray-500 mb-1"><Truck className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Requested Ship</span></div><p className="text-lg font-semibold">{job.dueDate ? formatDate(job.dueDate) : "Not set"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-gray-500 mb-1"><MapPin className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Plant</span></div><p className="text-lg font-semibold">Plant A - Main</p></CardContent></Card>
      </div>

      {/* Assigned Team — Editable */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Assigned Team</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">CSR / Account Manager</label>
              <Input defaultValue={job.csrName} placeholder="Assign CSR..." onBlur={(e) => { fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csrName: e.target.value }) }).catch(() => {}); }} />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Sales Rep</label>
              <Input defaultValue={job.salesRepName} placeholder="Assign Sales Rep..." onBlur={(e) => { fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salesRepName: e.target.value }) }).catch(() => {}); }} />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Production Owner</label>
              <Input defaultValue={job.productionOwnerName} placeholder="Assign Production Owner..." onBlur={(e) => { fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productionOwnerName: e.target.value }) }).catch(() => {}); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materials — Add + List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Materials</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { const name = prompt("Material name:"); if (name) { fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category: "substrate" }) }).then(() => setFeedback({ msg: `Material "${name}" added`, type: "success" })).catch(() => {}); setTimeout(() => setFeedback(null), 2000); } }}>+ Add</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"><span className="text-sm">18pt C1S Paperboard</span><Badge variant="success">Available</Badge></div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"><span className="text-sm">Aqueous Coating - Gloss</span><Badge variant="success">Available</Badge></div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"><span className="text-sm">CMYK Process Inks</span><Badge variant="success">Available</Badge></div>
            </div>
          </CardContent>
        </Card>

        {/* Proofing — Upload + Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FileImage className="h-4 w-4" />Proofing</CardTitle>
            <Button variant="outline" size="sm" onClick={async () => { await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).catch(() => {}); setFeedback({ msg: "Proof uploaded", type: "success" }); setTimeout(() => setFeedback(null), 2000); }}>Upload Proof</Button>
          </CardHeader>
          <CardContent>
            {job.proofStatus ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Status</span>
                  <Badge className={job.proofStatus === "APPROVED" ? "bg-green-100 text-green-700" : job.proofStatus === "SENT" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>{job.proofStatus}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-blue-600" onClick={async () => { await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofId: jobId, action: "approve" }) }).catch(() => {}); setJob({ ...job, proofStatus: "APPROVED" }); }}>Approve</Button>
                  <Button size="sm" variant="outline" className="text-amber-600" onClick={async () => { await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofId: jobId, action: "reject" }) }).catch(() => {}); setJob({ ...job, proofStatus: "REJECTED" }); }}>Reject</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No proofs uploaded yet. Click &quot;Upload Proof&quot; to start.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QA — Actionable */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />QA</CardTitle></CardHeader>
          <CardContent>
            {job.status === "QA" ? (
              <div className="space-y-3">
                <p className="text-sm text-yellow-700 font-medium">Job is in QA inspection</p>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={async () => { await fetch("/api/qa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action: "pass" }) }).catch(() => {}); setJob({ ...job, status: "PACKED" }); setFeedback({ msg: "Passed QA", type: "success" }); setTimeout(() => setFeedback(null), 2000); }}>Pass</Button>
                  <Button size="sm" variant="outline" className="text-amber-600 flex-1" onClick={async () => { await fetch("/api/qa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action: "hold" }) }).catch(() => {}); setFeedback({ msg: "QA hold applied", type: "success" }); setTimeout(() => setFeedback(null), 2000); }}>Hold</Button>
                  <Button size="sm" variant="outline" className="text-red-600 flex-1" onClick={async () => { await fetch("/api/qa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action: "fail" }) }).catch(() => {}); setJob({ ...job, status: "PRINTING" }); setFeedback({ msg: "Failed QA — back to production", type: "success" }); setTimeout(() => setFeedback(null), 2000); }}>Fail</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">QA available when job reaches QA stage.</p>
            )}
          </CardContent>
        </Card>

        {/* Shipment — Create */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />Shipment</CardTitle></CardHeader>
          <CardContent>
            {(job.status === "PACKED" || job.status === "SHIPPED") ? (
              <div className="space-y-3">
                <Button size="sm" className="w-full" onClick={async () => {
                  const carrier = prompt("Carrier (e.g. FedEx, UPS):");
                  const tracking = prompt("Tracking number:");
                  if (carrier && tracking) {
                    await fetch("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: job.orderId, carrier, trackingNumber: tracking }) }).catch(() => {});
                    setFeedback({ msg: `Shipment created: ${carrier} ${tracking}`, type: "success" });
                    setTimeout(() => setFeedback(null), 3000);
                  }
                }}>Create Shipment</Button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Available when job is packed.</p>
            )}
          </CardContent>
        </Card>

        {/* Comments — Add */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Input placeholder="Add a comment..." onKeyDown={async (e) => { if (e.key === "Enter" && (e.target as HTMLInputElement).value) { const val = (e.target as HTMLInputElement).value; setFeedback({ msg: `Comment added: "${val}"`, type: "success" }); (e.target as HTMLInputElement).value = ""; setTimeout(() => setFeedback(null), 2000); } }} />
              <p className="text-xs text-gray-400">Press Enter to post</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
