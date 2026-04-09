"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, CheckCircle, Calendar, Truck, MessageSquare,
  ShieldCheck, FileImage, Loader2, ChevronRight, Pencil, X, Check,
  Trash2, Users, Layers, Printer, Scissors,
  DollarSign, Info, Plus, Send, CircleAlert, FileBarChart,
} from "lucide-react";
import { demoJobs, PRODUCT_TYPES } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getStatusColor, getStatusLabel, getPriorityColor, formatDate, formatNumber,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
  // Extended job-ticket fields
  jobType?: string;
  contactName?: string;
  customerPO?: string;
  estimateNumber?: string;
  repName?: string;
  numPages?: number;
  proofDate?: string;
  enteredDate?: string;
  pressCheck?: boolean;
  stockDescription?: string;
  fscCertified?: boolean;
  blanketNo?: string;
  dieNumber?: string;
  flatWidth?: number;
  flatHeight?: number;
  finishedWidth?: number;
  finishedHeight?: number;
  inkFront?: string;
  inkBack?: string;
  varnishCoating?: string;
  softCover?: boolean;
  plusCover?: boolean;
  hasBleeds?: boolean;
  pressAssignment?: string;
  ledInk?: boolean;
  pressFormat?: string;
  imposition?: string;
  numberUp?: number;
  runningSize?: string;
  makeReadyCount?: number;
  firstPassCount?: number;
  finalPressCount?: number;
  pressmanInitials?: string;
  pressNotes?: string;
  binderyScore?: boolean;
  binderyPerf?: boolean;
  binderyDrill?: boolean;
  binderyPad?: boolean;
  binderyFold?: boolean;
  binderyCount?: boolean;
  binderyStitch?: boolean;
  binderyCollate?: boolean;
  binderyPockets?: boolean;
  binderyGlue?: boolean;
  binderyWrap?: boolean;
  binderyOther?: boolean;
  binderyNotes?: string;
  deliveryQty?: number;
  packaging?: string;
  deliveryTo?: string;
  samplesRequired?: boolean;
  samplesTo?: string;
  samplesChecked?: boolean;
  aaCharges?: number;
  vendorInfo?: string;
}

interface Purchase {
  id: string;
  jobId: string;
  category: string;
  description: string;
  vendor: string;
  estCost: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Job type options
// ---------------------------------------------------------------------------
const JOB_TYPE_OPTIONS = [
  { value: "NEW_ORDER", label: "New Order" },
  { value: "EXACT_REPRINT", label: "Exact Reprint" },
  { value: "REPRINT_WITH_CHANGES", label: "Reprint with Changes" },
  { value: "REPRINT_NEW_FILE", label: "Reprint New File" },
];

const JOB_TYPE_COLORS: Record<string, string> = {
  NEW_ORDER: "bg-blue-100 text-blue-700",
  EXACT_REPRINT: "bg-green-100 text-green-700",
  REPRINT_WITH_CHANGES: "bg-amber-100 text-amber-700",
  REPRINT_NEW_FILE: "bg-purple-100 text-purple-700",
};

const PURCHASE_CATEGORIES = [
  { value: "PAPER", label: "Paper" },
  { value: "INK", label: "Ink" },
  { value: "CUTTING_DIE", label: "Cutting Die" },
  { value: "FOIL_DIE", label: "Foil Die" },
  { value: "OUTSIDE_SERVICE", label: "Outside Service" },
  { value: "OTHER", label: "Other" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{children}</label>;
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
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

  // Lookup data for dropdowns
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [dbPresses, setDbPresses] = useState<{ id: string; name: string; costPerHour: number }[]>([]);
  const [dbMaterials, setDbMaterials] = useState<{ id: string; name: string; sku: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => { if (d.users) setEmployees(d.users); }).catch(() => {});
    fetch("/api/plant-standards").then(r => r.json()).then(d => { if (d.presses) setDbPresses(d.presses); }).catch(() => {});
    fetch("/api/materials").then(r => r.json()).then(d => { if (d.materials) setDbMaterials(d.materials); }).catch(() => {});
  }, []);

  // Purchases state
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [addingPurchase, setAddingPurchase] = useState(false);
  const [newPurchase, setNewPurchase] = useState({ category: "PAPER", description: "", vendor: "", estCost: "" });

  // Save a single field to the API
  const saveField = useCallback(
    (field: string, value: unknown) =>
      fetch(`/api/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }).catch(() => {}),
    [jobId],
  );

  // Flash a brief feedback message
  const flash = useCallback((msg: string, type: "success" | "error" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  // -----------------------------------------------------------------------
  // Fetch job
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (res.ok && data.job) {
          const j = data.job;
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
            jobType: j.jobType || "NEW_ORDER",
            contactName: j.contactName || "",
            customerPO: j.customerPO || "",
            estimateNumber: j.estimateNumber || "",
            repName: j.repName || "",
            numPages: j.numPages || 0,
            proofDate: j.proofDate ? (typeof j.proofDate === "string" ? j.proofDate.split("T")[0] : new Date(j.proofDate).toISOString().split("T")[0]) : "",
            enteredDate: j.enteredDate ? (typeof j.enteredDate === "string" ? j.enteredDate.split("T")[0] : new Date(j.enteredDate).toISOString().split("T")[0]) : j.createdAt ? new Date(j.createdAt).toISOString().split("T")[0] : "",
            pressCheck: j.pressCheck || false,
            stockDescription: j.stockDescription || "",
            fscCertified: j.fscCertified || false,
            blanketNo: j.blanketNo || "",
            dieNumber: j.dieNumber || "",
            flatWidth: j.flatWidth || 0,
            flatHeight: j.flatHeight || 0,
            finishedWidth: j.finishedWidth || 0,
            finishedHeight: j.finishedHeight || 0,
            inkFront: j.inkFront || "",
            inkBack: j.inkBack || "",
            varnishCoating: j.varnishCoating || "",
            softCover: j.softCover || false,
            plusCover: j.plusCover || false,
            hasBleeds: j.hasBleeds || false,
            pressAssignment: j.pressAssignment || "",
            ledInk: j.ledInk || false,
            pressFormat: j.pressFormat || "",
            imposition: j.imposition || "",
            numberUp: j.numberUp || 0,
            runningSize: j.runningSize || "",
            makeReadyCount: j.makeReadyCount || 0,
            firstPassCount: j.firstPassCount || 0,
            finalPressCount: j.finalPressCount || 0,
            pressmanInitials: j.pressmanInitials || "",
            pressNotes: j.pressNotes || "",
            binderyScore: j.binderyScore || false,
            binderyPerf: j.binderyPerf || false,
            binderyDrill: j.binderyDrill || false,
            binderyPad: j.binderyPad || false,
            binderyFold: j.binderyFold || false,
            binderyCount: j.binderyCount || false,
            binderyStitch: j.binderyStitch || false,
            binderyCollate: j.binderyCollate || false,
            binderyPockets: j.binderyPockets || false,
            binderyGlue: j.binderyGlue || false,
            binderyWrap: j.binderyWrap || false,
            binderyOther: j.binderyOther || false,
            binderyNotes: j.binderyNotes || "",
            deliveryQty: j.deliveryQty || j.quantity || 0,
            packaging: j.packaging || "",
            deliveryTo: j.deliveryTo || "",
            samplesRequired: j.samplesRequired || false,
            samplesTo: j.samplesTo || "",
            samplesChecked: j.samplesChecked || false,
            aaCharges: j.aaCharges || 0,
            vendorInfo: j.vendorInfo || "",
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
        setJob({
          ...found,
          status: found.status as string,
          priority: found.priority as string,
          jobType: "NEW_ORDER",
          contactName: "",
          customerPO: "",
          estimateNumber: "",
          repName: "",
          numPages: 0,
          proofDate: "",
          enteredDate: new Date().toISOString().split("T")[0],
          pressCheck: false,
          stockDescription: "",
          fscCertified: false,
          blanketNo: "",
          dieNumber: "",
          flatWidth: 0,
          flatHeight: 0,
          finishedWidth: 0,
          finishedHeight: 0,
          inkFront: "",
          inkBack: "",
          varnishCoating: "",
          softCover: false,
          plusCover: false,
          hasBleeds: false,
          pressAssignment: "",
          ledInk: false,
          pressFormat: "",
          imposition: "",
          numberUp: 0,
          runningSize: "",
          makeReadyCount: 0,
          firstPassCount: 0,
          finalPressCount: 0,
          pressmanInitials: "",
          pressNotes: "",
          binderyScore: false,
          binderyPerf: false,
          binderyDrill: false,
          binderyPad: false,
          binderyFold: false,
          binderyCount: false,
          binderyStitch: false,
          binderyCollate: false,
          binderyPockets: false,
          binderyGlue: false,
          binderyWrap: false,
          binderyOther: false,
          binderyNotes: "",
          deliveryQty: found.quantity,
          packaging: "",
          deliveryTo: "",
          samplesRequired: false,
          samplesTo: "",
          samplesChecked: false,
          aaCharges: 0,
          vendorInfo: "",
        });
        setEditForm({ name: found.name, description: found.description || "", quantity: String(found.quantity), dueDate: found.dueDate, priority: found.priority });
      }
      setLoading(false);
    }
    fetchJob();
  }, [jobId]);

  // -----------------------------------------------------------------------
  // Fetch purchases
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function fetchPurchases() {
      try {
        const res = await fetch(`/api/purchases?jobId=${jobId}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.purchases)) {
          setPurchases(data.purchases);
        }
      } catch { /* ok */ }
    }
    fetchPurchases();
  }, [jobId]);

  // -----------------------------------------------------------------------
  // Loading / Not found
  // -----------------------------------------------------------------------
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
        <Link href="/dashboard/jobs">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------
  const STAGES = job.productType === "COMMERCIAL_PRINT" ? STAGES_COMMERCIAL_PRINT : STAGES_FOLDING_CARTON;
  const currentStageIndex = STAGES.indexOf(job.status);

  // Helpers to update local state + persist
  const updateJobField = (field: string, value: unknown) => {
    setJob((prev) => (prev ? { ...prev, [field]: value } : prev));
    saveField(field, value);
  };

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "advance" }) });
      if (res.ok) {
        const nextStatus = STAGES[currentStageIndex + 1];
        if (nextStatus) { setJob({ ...job, status: nextStatus }); flash(`Advanced to ${getStatusLabel(nextStatus)}`); }
      } else {
        const nextStatus = STAGES[currentStageIndex + 1];
        if (nextStatus) { setJob({ ...job, status: nextStatus }); flash(`Advanced to ${getStatusLabel(nextStatus)} (demo)`); }
      }
    } catch {
      const nextStatus = STAGES[currentStageIndex + 1];
      if (nextStatus) { setJob({ ...job, status: nextStatus }); flash(`Advanced to ${getStatusLabel(nextStatus)} (demo)`); }
    }
    setAdvancing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
    } catch { /* ok */ }
    setJob({ ...job, name: editForm.name, quantity: parseInt(editForm.quantity) || job.quantity, dueDate: editForm.dueDate || job.dueDate, priority: editForm.priority });
    setEditing(false);
    setSaving(false);
    flash("Job updated");
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await fetch(`/api/jobs/${jobId}`, { method: "DELETE" }); } catch { /* ok */ }
    setDeleting(false);
    router.push("/dashboard/jobs");
  };

  const handleAddPurchase = async () => {
    const payload = { jobId, category: newPurchase.category, description: newPurchase.description, vendor: newPurchase.vendor, estCost: parseFloat(newPurchase.estCost) || 0, status: "NEEDED" };
    try {
      const res = await fetch("/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok && data.purchase) {
        setPurchases((prev) => [...prev, data.purchase]);
      } else {
        // demo fallback
        setPurchases((prev) => [...prev, { id: `p-${Date.now()}`, ...payload }]);
      }
    } catch {
      setPurchases((prev) => [...prev, { id: `p-${Date.now()}`, ...payload }]);
    }
    setNewPurchase({ category: "PAPER", description: "", vendor: "", estCost: "" });
    setAddingPurchase(false);
    flash("Purchase added");
  };

  const handleUpdatePurchaseStatus = async (purchaseId: string, newStatus: string) => {
    try {
      await fetch("/api/purchases", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: purchaseId, status: newStatus }) });
    } catch { /* ok */ }
    setPurchases((prev) => prev.map((p) => (p.id === purchaseId ? { ...p, status: newStatus } : p)));
  };

  const jobTypeLabel = JOB_TYPE_OPTIONS.find((o) => o.value === job.jobType)?.label || "New Order";
  const jobTypeColor = JOB_TYPE_COLORS[job.jobType || "NEW_ORDER"] || JOB_TYPE_COLORS.NEW_ORDER;

  // =======================================================================
  // RENDER
  // =======================================================================
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Feedback toast */}
      {feedback && (
        <div className={`p-3 rounded-lg text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {feedback.msg}
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. HEADER                                                         */}
      {/* ================================================================= */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/jobs">
          <Button variant="ghost" size="icon" className="mt-1"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{job.name}</h1>
            <Badge className={getStatusColor(job.status)}>{getStatusLabel(job.status)}</Badge>
            <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
            {job.productType && (
              <Badge className={job.productType === "FOLDING_CARTON" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}>
                {job.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"}
              </Badge>
            )}
            <Badge className={jobTypeColor}>{jobTypeLabel}</Badge>
            {job.isLate && <Badge className="bg-red-100 text-red-700">LATE</Badge>}
            {job.isBlocked && <Badge className="bg-orange-100 text-orange-700">BLOCKED</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-mono font-medium text-gray-700">{job.jobNumber}</span>
            {" "}&middot;{" "}
            <span className="font-medium text-gray-700">{job.companyName}</span>
            {" "}&middot; Order{" "}
            <Link href={`/dashboard/orders/${job.orderId}`} className="text-green-700 hover:underline font-medium">{job.orderNumber}</Link>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!confirmDelete ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(!editing); if (!editing) setEditForm({ name: job.name, description: job.description || "", quantity: String(job.quantity), dueDate: job.dueDate, priority: job.priority }); }} className="gap-1.5">
                {editing ? <><X className="h-4 w-4" />Cancel</> : <><Pencil className="h-4 w-4" />Edit</>}
              </Button>
              <a href={`/dashboard/jobs/${jobId}/print`} target="_blank">
                <Button variant="outline" className="gap-1.5">
                  <Printer className="h-4 w-4" />Print Ticket
                </Button>
              </a>
              <label className="cursor-pointer">
                <Button variant="outline" className="gap-1.5" asChild>
                  <span><FileBarChart className="h-4 w-4" />Import Order Form</span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("jobId", jobId);
                    try {
                      const res = await fetch("/api/import", { method: "POST", body: fd });
                      const data = await res.json();
                      if (res.ok) {
                        alert(`Imported ${data.imported} line items (${data.totalQuantity?.toLocaleString()} total units)`);
                        window.location.reload();
                      } else {
                        alert(data.error || "Import failed");
                      }
                    } catch { alert("Import failed"); }
                    e.target.value = "";
                  }}
                />
              </label>
              <Button
                variant="outline"
                className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={async () => {
                  if (!job) return;
                  // Check for existing invoices on this job
                  let existingInvoices: any[] = [];
                  try {
                    const invRes = await fetch("/api/payments");
                    const invData = await invRes.json();
                    existingInvoices = (invData.invoices || []).filter((inv: any) => inv.jobId === job.id);
                  } catch {}

                  const quotedPrice = (job as any).quotedPrice || 0;
                  const totalInvoiced = existingInvoices.reduce((s: number, inv: any) => s + inv.total, 0);
                  const totalPaid = existingInvoices.reduce((s: number, inv: any) => {
                    let paid = 0;
                    if (inv.depositPaid) paid += inv.depositAmount;
                    if (inv.balancePaid) paid += (inv.total - inv.depositAmount);
                    return s + paid;
                  }, 0);
                  const outstanding = quotedPrice - totalPaid;

                  let amount = quotedPrice;
                  let message = `Quoted Price: $${quotedPrice.toLocaleString()}`;
                  if (existingInvoices.length > 0) {
                    message += `\nAlready Invoiced: $${totalInvoiced.toLocaleString()}`;
                    message += `\nPaid So Far: $${totalPaid.toLocaleString()}`;
                    message += `\nStill Owed: $${outstanding.toLocaleString()}`;
                    amount = outstanding > 0 ? outstanding : quotedPrice;
                  }

                  const input = prompt(`${message}\n\nEnter invoice amount ($):`, String(amount > 0 ? amount : ""));
                  if (!input) return;
                  amount = parseFloat(input);
                  if (isNaN(amount) || amount <= 0) { alert("Invalid amount"); return; }

                  try {
                    const res = await fetch("/api/payments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "create_invoice",
                        customerName: job.companyName || "",
                        companyId: job.companyId || null,
                        description: `${job.jobNumber} - ${job.name}`,
                        subtotal: amount,
                        jobId: job.id,
                        orderId: job.orderId,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert(`Invoice ${data.invoice.invoiceNumber} created!\nTotal (with tax): $${data.invoice.total.toLocaleString()}`);
                    } else {
                      alert(data.error || "Failed to create invoice");
                    }
                  } catch { alert("Failed to create invoice"); }
                }}
              >
                <DollarSign className="h-4 w-4" />Create Invoice
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
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Job Name</label><Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label><Input type="number" value={editForm.quantity} onChange={(e) => setEditForm((p) => ({ ...p, quantity: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label><Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label><Select value={editForm.priority} onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value }))} options={[{ value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} /></div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save Changes
            </Button>
          </div>
        </Card>
      )}

      {/* ================================================================= */}
      {/* 2. STAGE PROGRESS STEPPER                                         */}
      {/* ================================================================= */}
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
                          flash(`Jumped to ${getStatusLabel(stage)}`);
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium cursor-pointer transition-transform hover:scale-125 ${isCompleted ? "bg-green-600 text-white" : isCurrent ? "bg-green-600 text-white ring-4 ring-green-100" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                        title={`Jump to: ${getStatusLabel(stage)}`}
                      >
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <span>{i + 1}</span>}
                      </button>
                      <span className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? "font-semibold text-green-700" : isCompleted ? "text-green-600" : "text-gray-400"}`}>
                        {getStatusLabel(stage)}
                      </span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`h-0.5 w-full ${i < STAGES.indexOf(job.status) ? "bg-green-500" : "bg-gray-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 3. JOB TICKET INFO — 2-column grid                               */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Customer & Job Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Customer &amp; Job Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionLabel>Customer</SectionLabel>
                <p className="text-sm font-medium text-gray-900">{job.companyName}</p>
              </div>
              <div>
                <SectionLabel>Contact Name</SectionLabel>
                <Input
                  defaultValue={job.contactName || ""}
                  placeholder="Contact name..."
                  onBlur={(e) => updateJobField("contactName", e.target.value)}
                />
              </div>
              <div>
                <SectionLabel>Customer PO</SectionLabel>
                <Input
                  defaultValue={job.customerPO || ""}
                  placeholder="PO #..."
                  onBlur={(e) => updateJobField("customerPO", e.target.value)}
                />
              </div>
              <div>
                <SectionLabel>Estimate #</SectionLabel>
                <Input
                  defaultValue={job.estimateNumber || ""}
                  placeholder="Estimate #..."
                  onBlur={(e) => updateJobField("estimateNumber", e.target.value)}
                />
              </div>
              <div>
                <SectionLabel>Rep Name</SectionLabel>
                <Input
                  defaultValue={job.repName || ""}
                  placeholder="Rep name..."
                  onBlur={(e) => updateJobField("repName", e.target.value)}
                />
              </div>
              <div>
                <SectionLabel>Quantity</SectionLabel>
                <p className="text-sm font-medium text-gray-900">{formatNumber(job.quantity)}</p>
              </div>
              {(job as any).quotedPrice > 0 && (
                <div>
                  <SectionLabel>Quoted Price</SectionLabel>
                  <p className="text-lg font-bold text-brand-600">${((job as any).quotedPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>

            <div>
              <SectionLabel>Job Title</SectionLabel>
              <p className="text-sm font-medium text-gray-900">{job.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionLabel># Pages</SectionLabel>
                <Input
                  type="number"
                  defaultValue={job.numPages || ""}
                  placeholder="0"
                  onBlur={(e) => updateJobField("numPages", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <SectionLabel>Job Type</SectionLabel>
                <Select
                  value={job.jobType || "NEW_ORDER"}
                  onChange={(e) => updateJobField("jobType", e.target.value)}
                  options={JOB_TYPE_OPTIONS}
                />
              </div>
            </div>

            {job.description && (
              <div>
                <SectionLabel>Job Description</SectionLabel>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{job.description}</p>
              </div>
            )}

            {/* Multi-row Job Line Items (versions/quantities) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Versions / Line Items</SectionLabel>
                <Button variant="outline" size="sm" onClick={async () => {
                  const desc = prompt("Description (e.g. MR-30200 #7346 / 9,750):");
                  const qty = prompt("Quantity:");
                  if (desc && qty) {
                    const res = await fetch(`/api/jobs/${jobId}/lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lineItem", description: desc, quantity: parseInt(qty) || 1 }) });
                    if (res.ok) {
                      setFeedback({ msg: "Line item added", type: "success" }); setTimeout(() => setFeedback(null), 2000);
                      // Reload line items
                      const lr = await fetch(`/api/jobs/${jobId}/lines`);
                      const ld = await lr.json();
                      if (ld.lineItems) setJob((prev: any) => prev ? { ...prev, lineItems: ld.lineItems } : prev);
                    }
                  }
                }}>+ Add Row</Button>
              </div>
              <div className="bg-gray-50 rounded-lg overflow-hidden border">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-100"><th className="p-2 text-left font-medium">Qty</th><th className="p-2 text-left font-medium">Description</th><th className="p-2 text-left font-medium">Ink Spec</th></tr></thead>
                  <tbody>
                    {((job as any).lineItems && (job as any).lineItems.length > 0) ? (
                      (job as any).lineItems.map((li: any, i: number) => (
                        <tr key={li.id || i} className="border-t"><td className="p-2 font-medium">{li.quantity?.toLocaleString()}</td><td className="p-2">{li.description || "—"}</td><td className="p-2">{li.inkSpec || "—"}</td></tr>
                      ))
                    ) : (
                      <tr className="border-t"><td className="p-2 font-medium">{job.quantity?.toLocaleString()}</td><td className="p-2">{job.description || "—"}</td><td className="p-2">{job.inkFront || "—"}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Dates & Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" />Dates &amp; Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionLabel>CSR</SectionLabel>
                <Select
                  value={job.csrName || ""}
                  onChange={(e) => updateJobField("csrName", e.target.value)}
                  options={[{ value: "", label: "Unassigned" }, ...employees.filter(u => ["CSR", "ADMIN", "OWNER", "GM"].includes(u.role)).map(u => ({ value: u.name, label: u.name }))]}
                />
              </div>
              <div>
                <SectionLabel>Sales Rep</SectionLabel>
                <Select
                  value={job.salesRepName || ""}
                  onChange={(e) => updateJobField("salesRepName", e.target.value)}
                  options={[{ value: "", label: "Unassigned" }, ...employees.filter(u => ["SALES_REP", "SALES_MANAGER", "OWNER", "GM"].includes(u.role)).map(u => ({ value: u.name, label: u.name }))]}
                />
              </div>
              <div>
                <SectionLabel>Production Owner</SectionLabel>
                <Select
                  value={job.productionOwnerName || ""}
                  onChange={(e) => updateJobField("productionOwnerName", e.target.value)}
                  options={[{ value: "", label: "Unassigned" }, ...employees.filter(u => ["PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ADMIN", "OWNER", "GM"].includes(u.role)).map(u => ({ value: u.name, label: u.name }))]}
                />
              </div>
              <div>
                <SectionLabel>Due Date</SectionLabel>
                <p className="text-sm font-medium text-gray-900 py-2">{job.dueDate ? formatDate(job.dueDate) : "Not set"}</p>
              </div>
              <div>
                <SectionLabel>Proof Date</SectionLabel>
                <Input
                  type="date"
                  defaultValue={job.proofDate || ""}
                  onBlur={(e) => updateJobField("proofDate", e.target.value)}
                />
              </div>
              <div>
                <SectionLabel>Entered Date</SectionLabel>
                <p className="text-sm font-medium text-gray-900 py-2">{job.enteredDate ? formatDate(job.enteredDate) : "Not set"}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <Checkbox
                label="Press Check Required"
                checked={job.pressCheck || false}
                onChange={(v) => updateJobField("pressCheck", v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================= */}
      {/* 4. STOCK & SPECS                                                  */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4" />Stock &amp; Specs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SectionLabel>Stock Description</SectionLabel>
              <Select
                value={job.stockDescription || ""}
                onChange={(e) => updateJobField("stockDescription", e.target.value)}
                options={[{ value: "", label: "Select stock..." }, ...dbMaterials.map(m => ({ value: m.name, label: `${m.name}${m.sku ? ` (${m.sku})` : ""}` }))]}
              />
            </div>
            <div className="flex items-end">
              <Checkbox
                label="FSC Certified"
                checked={job.fscCertified || false}
                onChange={(v) => updateJobField("fscCertified", v)}
              />
            </div>

            <div>
              <SectionLabel>Blanket No.</SectionLabel>
              <Input
                defaultValue={job.blanketNo || ""}
                placeholder="Blanket #..."
                onBlur={(e) => updateJobField("blanketNo", e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>Die #</SectionLabel>
              <Input
                defaultValue={job.dieNumber || ""}
                placeholder="Die #..."
                onBlur={(e) => updateJobField("dieNumber", e.target.value)}
              />
            </div>
            <div />

            {/* Flat Size */}
            <div>
              <SectionLabel>Flat Size (W x H)</SectionLabel>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  defaultValue={job.flatWidth || ""}
                  placeholder="Width"
                  className="flex-1"
                  onBlur={(e) => updateJobField("flatWidth", parseFloat(e.target.value) || 0)}
                />
                <span className="text-gray-400 text-sm">x</span>
                <Input
                  type="number"
                  defaultValue={job.flatHeight || ""}
                  placeholder="Height"
                  className="flex-1"
                  onBlur={(e) => updateJobField("flatHeight", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Finished Size */}
            <div>
              <SectionLabel>Finished Size (W x H)</SectionLabel>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  defaultValue={job.finishedWidth || ""}
                  placeholder="Width"
                  className="flex-1"
                  onBlur={(e) => updateJobField("finishedWidth", parseFloat(e.target.value) || 0)}
                />
                <span className="text-gray-400 text-sm">x</span>
                <Input
                  type="number"
                  defaultValue={job.finishedHeight || ""}
                  placeholder="Height"
                  className="flex-1"
                  onBlur={(e) => updateJobField("finishedHeight", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div />

            <div>
              <SectionLabel>Ink Front</SectionLabel>
              <Input
                defaultValue={job.inkFront || ""}
                placeholder='e.g. 4/0 CMYK'
                onBlur={(e) => updateJobField("inkFront", e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>Ink Back</SectionLabel>
              <Input
                defaultValue={job.inkBack || ""}
                placeholder='e.g. 1/0 Black'
                onBlur={(e) => updateJobField("inkBack", e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>Varnish / Coating</SectionLabel>
              <Input
                defaultValue={job.varnishCoating || ""}
                placeholder="e.g. Aqueous Gloss"
                onBlur={(e) => updateJobField("varnishCoating", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <Checkbox label="Soft Cover" checked={job.softCover || false} onChange={(v) => updateJobField("softCover", v)} />
            <Checkbox label="Plus Cover" checked={job.plusCover || false} onChange={(v) => updateJobField("plusCover", v)} />
            <Checkbox label="Has Bleeds" checked={job.hasBleeds || false} onChange={(v) => updateJobField("hasBleeds", v)} />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 5. PRESS INFORMATION                                              */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Printer className="h-4 w-4" />Press Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <SectionLabel>Press Assignment</SectionLabel>
              <Select
                value={job.pressAssignment || ""}
                onChange={(e) => updateJobField("pressAssignment", e.target.value)}
                options={[{ value: "", label: "Select press..." }, ...dbPresses.map(p => ({ value: p.name, label: `${p.name} ($${p.costPerHour}/hr)` }))]}
              />
            </div>
            <div className="flex items-end pb-2">
              <Checkbox label="LED Ink" checked={job.ledInk || false} onChange={(v) => updateJobField("ledInk", v)} />
            </div>
            <div>
              <SectionLabel>Format / Info</SectionLabel>
              <Input
                defaultValue={job.pressFormat || ""}
                placeholder="Format info..."
                onBlur={(e) => updateJobField("pressFormat", e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>Imposition</SectionLabel>
              <Input
                defaultValue={job.imposition || ""}
                placeholder="Imposition..."
                onBlur={(e) => updateJobField("imposition", e.target.value)}
              />
            </div>
            <div>
              <SectionLabel># Up</SectionLabel>
              <Input
                type="number"
                defaultValue={job.numberUp || ""}
                placeholder="0"
                onBlur={(e) => updateJobField("numberUp", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <SectionLabel>Running Size</SectionLabel>
              <Input
                defaultValue={job.runningSize || ""}
                placeholder='e.g. 28" x 40"'
                onBlur={(e) => updateJobField("runningSize", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <SectionLabel>Make Ready Count</SectionLabel>
              <Input
                type="number"
                defaultValue={job.makeReadyCount || ""}
                placeholder="0"
                onBlur={(e) => updateJobField("makeReadyCount", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <SectionLabel>First Pass Count</SectionLabel>
              <Input
                type="number"
                defaultValue={job.firstPassCount || ""}
                placeholder="0"
                onBlur={(e) => updateJobField("firstPassCount", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <SectionLabel>Final Press Count</SectionLabel>
              <Input
                type="number"
                defaultValue={job.finalPressCount || ""}
                placeholder="0"
                onBlur={(e) => updateJobField("finalPressCount", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <SectionLabel>Pressman Initials</SectionLabel>
              <Input
                defaultValue={job.pressmanInitials || ""}
                placeholder="Initials..."
                className="uppercase"
                onBlur={(e) => updateJobField("pressmanInitials", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* Multi-row Press Runs */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Press Runs</SectionLabel>
              <Button variant="outline" size="sm" onClick={async () => {
                const press = prompt("Press (e.g. KOM, Offset #2):");
                const form = prompt("Form # / Info:");
                const finish = prompt("Finish Count:");
                const makeReady = prompt("Make Ready:");
                const runSize = prompt("Running Size (e.g. 23X29):");
                const imp = prompt("Imposition (e.g. 1-Side):");
                const nUp = prompt("# Up:");
                const ink = prompt("Ink (e.g. 5/0):");
                if (press) {
                  const res = await fetch(`/api/jobs/${jobId}/lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "pressRun", press, formNumber: form, finishCount: finish, makeReady, runningSize: runSize, imposition: imp, numberUp: nUp, inkSpec: ink }) });
                  if (res.ok) {
                    setFeedback({ msg: "Press run added", type: "success" }); setTimeout(() => setFeedback(null), 2000);
                    const lr = await fetch(`/api/jobs/${jobId}/lines`);
                    const ld = await lr.json();
                    if (ld.pressRuns) setJob((prev: any) => prev ? { ...prev, pressRuns: ld.pressRuns } : prev);
                  }
                }
              }}>+ Add Press Run</Button>
            </div>
            <div className="bg-gray-50 rounded-lg overflow-hidden border overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-100"><th className="p-2 text-left font-medium">Press</th><th className="p-2 text-left font-medium">Form#</th><th className="p-2 text-right font-medium">Finish Ct</th><th className="p-2 text-right font-medium">Make Ready</th><th className="p-2 text-left font-medium">Size</th><th className="p-2 text-left font-medium">Imposition</th><th className="p-2 text-right font-medium">#Up</th><th className="p-2 text-left font-medium">Ink</th></tr></thead>
                <tbody>
                  {((job as any).pressRuns && (job as any).pressRuns.length > 0) ? (
                    (job as any).pressRuns.map((pr: any, i: number) => (
                      <tr key={pr.id || i} className="border-t"><td className="p-2">{pr.press || "—"}</td><td className="p-2">{pr.formNumber || "—"}</td><td className="p-2 text-right">{pr.finishCount?.toLocaleString() || "—"}</td><td className="p-2 text-right">{pr.makeReady?.toLocaleString() || "—"}</td><td className="p-2">{pr.runningSize || "—"}</td><td className="p-2">{pr.imposition || "—"}</td><td className="p-2 text-right">{pr.numberUp || "—"}</td><td className="p-2">{pr.inkSpec || "—"}</td></tr>
                    ))
                  ) : (
                    <tr className="border-t"><td className="p-2">{job.pressAssignment || "—"}</td><td className="p-2">{job.pressFormat || "—"}</td><td className="p-2 text-right">{job.finalPressCount || "—"}</td><td className="p-2 text-right">{job.makeReadyCount || "—"}</td><td className="p-2">{job.runningSize || "—"}</td><td className="p-2">{job.imposition || "—"}</td><td className="p-2 text-right">{job.numberUp || "—"}</td><td className="p-2">{job.inkFront || "—"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1">Click &quot;+ Add Press Run&quot; for additional press entries (multiple forms/passes)</p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <SectionLabel>Press Notes</SectionLabel>
            <textarea
              defaultValue={job.pressNotes || ""}
              placeholder="Press notes, special instructions..."
              rows={3}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y"
              onBlur={(e) => updateJobField("pressNotes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 6. BINDERY INSTRUCTIONS                                           */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scissors className="h-4 w-4" />Bindery Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-6 gap-y-3">
            <Checkbox label="Score" checked={job.binderyScore || false} onChange={(v) => updateJobField("binderyScore", v)} />
            <Checkbox label="Perf" checked={job.binderyPerf || false} onChange={(v) => updateJobField("binderyPerf", v)} />
            <Checkbox label="Drill" checked={job.binderyDrill || false} onChange={(v) => updateJobField("binderyDrill", v)} />
            <Checkbox label="Pad" checked={job.binderyPad || false} onChange={(v) => updateJobField("binderyPad", v)} />
            <Checkbox label="Fold" checked={job.binderyFold || false} onChange={(v) => updateJobField("binderyFold", v)} />
            <Checkbox label="Count" checked={job.binderyCount || false} onChange={(v) => updateJobField("binderyCount", v)} />
            <Checkbox label="Stitch" checked={job.binderyStitch || false} onChange={(v) => updateJobField("binderyStitch", v)} />
            <Checkbox label="Collate" checked={job.binderyCollate || false} onChange={(v) => updateJobField("binderyCollate", v)} />
            <Checkbox label="Pockets" checked={job.binderyPockets || false} onChange={(v) => updateJobField("binderyPockets", v)} />
            <Checkbox label="Glue" checked={job.binderyGlue || false} onChange={(v) => updateJobField("binderyGlue", v)} />
            <Checkbox label="Wrap" checked={job.binderyWrap || false} onChange={(v) => updateJobField("binderyWrap", v)} />
            <Checkbox label="Other" checked={job.binderyOther || false} onChange={(v) => updateJobField("binderyOther", v)} />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SectionLabel>Bindery Notes</SectionLabel>
            <Input
              defaultValue={job.binderyNotes || ""}
              placeholder="Special bindery instructions..."
              onBlur={(e) => updateJobField("binderyNotes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 7. OUTSIDE PURCHASES                                              */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Outside Purchases Required</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddingPurchase(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Add Purchase
          </Button>
        </CardHeader>
        <CardContent>
          {/* Add-purchase form */}
          {addingPurchase && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <SectionLabel>Category</SectionLabel>
                  <Select value={newPurchase.category} onChange={(e) => setNewPurchase((p) => ({ ...p, category: e.target.value }))} options={PURCHASE_CATEGORIES} />
                </div>
                <div>
                  <SectionLabel>Description</SectionLabel>
                  <Input value={newPurchase.description} onChange={(e) => setNewPurchase((p) => ({ ...p, description: e.target.value }))} placeholder="Description..." />
                </div>
                <div>
                  <SectionLabel>Vendor</SectionLabel>
                  <Input value={newPurchase.vendor} onChange={(e) => setNewPurchase((p) => ({ ...p, vendor: e.target.value }))} placeholder="Vendor..." />
                </div>
                <div>
                  <SectionLabel>Est. Cost</SectionLabel>
                  <Input type="number" value={newPurchase.estCost} onChange={(e) => setNewPurchase((p) => ({ ...p, estCost: e.target.value }))} placeholder="$0.00" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setAddingPurchase(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddPurchase} className="gap-1.5"><Check className="h-3.5 w-3.5" />Save</Button>
              </div>
            </div>
          )}

          {purchases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Category</th>
                    <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Description</th>
                    <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Vendor</th>
                    <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Est. Cost</th>
                    <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Badge variant="secondary">{PURCHASE_CATEGORIES.find((c) => c.value === p.category)?.label || p.category}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">{p.description || "--"}</td>
                      <td className="py-2.5 pr-3 text-gray-700">{p.vendor || "--"}</td>
                      <td className="py-2.5 pr-3 text-gray-700">{p.estCost ? `$${Number(p.estCost).toFixed(2)}` : "--"}</td>
                      <td className="py-2.5 pr-3">
                        <Badge className={
                          p.status === "RECEIVED" ? "bg-green-100 text-green-700" :
                          p.status === "ORDERED" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }>
                          {p.status === "RECEIVED" ? "Received" : p.status === "ORDERED" ? "Ordered" : "Needed"}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          {p.status === "NEEDED" && (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => handleUpdatePurchaseStatus(p.id, "ORDERED")}>
                              Mark Ordered
                            </Button>
                          )}
                          {p.status === "ORDERED" && (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-green-700" onClick={() => handleUpdatePurchaseStatus(p.id, "RECEIVED")}>
                              Mark Received
                            </Button>
                          )}
                          {p.status === "RECEIVED" && (
                            <span className="text-xs text-gray-400 py-1">Complete</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No outside purchases. Click &quot;Add Purchase&quot; to add one.</p>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 8. DELIVERY & SAMPLES                                             */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />Delivery &amp; Samples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <SectionLabel>Delivery QTY</SectionLabel>
              <Input
                type="number"
                defaultValue={job.deliveryQty || ""}
                placeholder="0"
                onBlur={(e) => updateJobField("deliveryQty", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <SectionLabel>Packaging</SectionLabel>
              <Input
                defaultValue={job.packaging || ""}
                placeholder="e.g. Shrink wrap on skids"
                onBlur={(e) => updateJobField("packaging", e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>Delivery To</SectionLabel>
              <Input
                defaultValue={job.deliveryTo || ""}
                placeholder="Delivery address / instructions..."
                onBlur={(e) => updateJobField("deliveryTo", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-100 items-end">
            <Checkbox
              label="Samples Required"
              checked={job.samplesRequired || false}
              onChange={(v) => updateJobField("samplesRequired", v)}
            />
            <div className="flex-1 min-w-[200px]">
              <SectionLabel>Samples To</SectionLabel>
              <Input
                defaultValue={job.samplesTo || ""}
                placeholder="Where to send samples..."
                onBlur={(e) => updateJobField("samplesTo", e.target.value)}
              />
            </div>
            <Checkbox
              label="Samples Checked"
              checked={job.samplesChecked || false}
              onChange={(v) => updateJobField("samplesChecked", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 9. ADDITIONAL INFO                                                */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-4 w-4" />Additional Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SectionLabel>AA Charges</SectionLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  defaultValue={job.aaCharges || ""}
                  placeholder="0.00"
                  className="pl-7"
                  onBlur={(e) => updateJobField("aaCharges", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <SectionLabel>Vendor Information</SectionLabel>
              <textarea
                defaultValue={job.vendorInfo || ""}
                placeholder="Vendor notes, contact info..."
                rows={3}
                className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y"
                onBlur={(e) => updateJobField("vendorInfo", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* SHIPMENT / COMMENTS                                              */}
      {/* ================================================================= */}
      {/* Proofing and QA cards archived — team doesn't use them (Apr 2026) */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" />Shipment</CardTitle>
          </CardHeader>
          <CardContent>
            {(job.status === "PACKED" || job.status === "SHIPPED") ? (
              <div className="space-y-3">
                <Button size="sm" className="w-full" onClick={async () => {
                  const carrier = prompt("Carrier (e.g. FedEx, UPS):");
                  const tracking = prompt("Tracking number:");
                  if (carrier && tracking) {
                    await fetch("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: job.orderId, carrier, trackingNumber: tracking }) }).catch(() => {});
                    flash(`Shipment created: ${carrier} ${tracking}`);
                  }
                }}>Create Shipment</Button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Available when job is packed.</p>
            )}
          </CardContent>
        </Card>

        {/* 13. Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Input placeholder="Add a comment..." onKeyDown={async (e) => {
                if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                  const val = (e.target as HTMLInputElement).value;
                  flash(`Comment added: "${val}"`);
                  (e.target as HTMLInputElement).value = "";
                }
              }} />
              <p className="text-xs text-gray-400">Press Enter to post</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
