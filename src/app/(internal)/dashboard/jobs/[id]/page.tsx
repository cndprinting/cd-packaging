"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, CheckCircle, Calendar, Truck, MessageSquare,
  ShieldCheck, FileImage, Loader2, ChevronRight, Pencil, X, Check,
  Trash2, Users, Layers, Printer, Scissors,
  DollarSign, Info, Plus, Send, CircleAlert, FileCheck, Copy,
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
  blanketNumber?: string;
  dieNumber?: string;
  paperSource?: string;
  flatSizeWidth?: number;
  flatSizeHeight?: number;
  finishedWidth?: number;
  finishedHeight?: number;
  inkFront?: string;
  inkBack?: string;
  varnish?: string;
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
  paymentNotes?: string;
  prepressNotes?: string;
  generalNotes?: string;
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
  const [quoteRequest, setQuoteRequest] = useState<any | null>(null);
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
  const [dbMaterials, setDbMaterials] = useState<{ id: string; name: string; sku: string | null; onHand?: number; allocated?: number; available?: number; unit?: string; isShort?: boolean; isLow?: boolean }[]>([]);

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
            blanketNumber: j.blanketNumber || "",
            dieNumber: j.dieNumber || "",
            paperSource: j.paperSource || "on_hand",
            flatSizeWidth: j.flatSizeWidth || 0,
            flatSizeHeight: j.flatSizeHeight || 0,
            finishedWidth: j.finishedWidth || 0,
            finishedHeight: j.finishedHeight || 0,
            inkFront: j.inkFront || "",
            inkBack: j.inkBack || "",
            varnish: j.varnish || "",
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
            paymentNotes: j.paymentNotes || "",
            prepressNotes: j.prepressNotes || "",
            generalNotes: j.generalNotes || "",
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
            quotedPrice: j.quotedPrice || 0,
            estimatedCost: j.estimatedCost || 0,
          } as any;
          setJob(formatted);
          if (data.quoteRequest) setQuoteRequest(data.quoteRequest);
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
          blanketNumber: "",
          dieNumber: "",
          paperSource: "on_hand",
          flatSizeWidth: 0,
          flatSizeHeight: 0,
          finishedWidth: 0,
          finishedHeight: 0,
          inkFront: "",
          inkBack: "",
          varnish: "",
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
          paymentNotes: "",
          prepressNotes: "",
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

                  const quotedPrice = (job as any).quotedPrice || (job as any).estimatedCost || ((job as any).unitPrice ? (job as any).unitPrice * job.quantity : 0);
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
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={async () => {
                  if (!confirm(`Duplicate ${job.jobNumber} as an exact reprint? All ticket notes and specs will be copied to a new job number.`)) return;
                  try {
                    const res = await fetch(`/api/jobs/${jobId}/duplicate`, { method: "POST" });
                    const data = await res.json();
                    if (res.ok && data.job) {
                      flash(`Duplicated → ${data.job.jobNumber}`);
                      router.push(`/dashboard/jobs/${data.job.id}`);
                    } else {
                      alert(data.error || "Failed to duplicate");
                    }
                  } catch { alert("Failed to duplicate job"); }
                }}
              >
                <Copy className="h-4 w-4" />Duplicate (Reprint)
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
      {/* 2c. GENERAL NOTES — cross-department critical info                */}
      {/* Added per Carrie's feedback: CSRs need one prominent notes field  */}
      {/* visible to every department (prepress, press, bindery, shipping) */}
      {/* instead of cramming critical info into margins and corners.       */}
      {/* ================================================================= */}
      <Card className="border-amber-300 bg-amber-50/50 print:border-2 print:border-black">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <CircleAlert className="h-4 w-4" />General Notes
            <span className="text-xs font-normal text-amber-700">— visible to all departments on the ticket &amp; printout</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            defaultValue={job.generalNotes || ""}
            placeholder="Critical info everyone on this job needs to see: deadlines, mask pin #s, customer quirks, quality warnings, cross-department coordination..."
            rows={3}
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            onBlur={(e) => updateJobField("generalNotes", e.target.value)}
          />
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

            {/* Page info line — per CSR feedback, # Pages / Self Cover / Plus Cover
                live together on one line so they read in sequence at the top. */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <SectionLabel># Pages</SectionLabel>
                <Input
                  type="number"
                  defaultValue={job.numPages || ""}
                  placeholder="0"
                  onBlur={(e) => updateJobField("numPages", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center gap-4 pb-2">
                <Checkbox label="Self Cover" checked={job.softCover || false} onChange={(v) => updateJobField("softCover", v)} />
                <Checkbox label="Plus Cover" checked={job.plusCover || false} onChange={(v) => updateJobField("plusCover", v)} />
              </div>
              <div className="md:col-span-2">
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
                  if (!desc) return;
                  const qty = prompt("Quantity:");
                  const flatSize = prompt("Flat size (e.g. 11x17):") || "";
                  const finSize = prompt("Finished size (e.g. 8.5x11):") || "";
                  let finishedWidth: number | null = null, finishedHeight: number | null = null;
                  if (finSize) {
                    const [w, h] = finSize.split(/[xX]/).map(s => parseFloat(s.trim()));
                    if (!isNaN(w)) finishedWidth = w;
                    if (!isNaN(h)) finishedHeight = h;
                  }
                  const inkSpec = prompt("Ink spec (e.g. 4/0 CMYK, or 5/4 +PMS):") || "";
                  const res = await fetch(`/api/jobs/${jobId}/lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lineItem", description: desc, quantity: parseInt(qty || "1") || 1, flatSize, finishedWidth, finishedHeight, inkSpec }) });
                  if (res.ok) {
                    setFeedback({ msg: "Line item added", type: "success" }); setTimeout(() => setFeedback(null), 2000);
                    const lr = await fetch(`/api/jobs/${jobId}/lines`);
                    const ld = await lr.json();
                    if (ld.lineItems) setJob((prev: any) => prev ? { ...prev, lineItems: ld.lineItems } : prev);
                  }
                }}>+ Add Row</Button>
              </div>
              <div className="bg-gray-50 rounded-lg overflow-hidden border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-100"><th className="p-2 text-left font-medium">Qty</th><th className="p-2 text-left font-medium">Description</th><th className="p-2 text-left font-medium">Flat Size</th><th className="p-2 text-left font-medium">Finished Size</th><th className="p-2 text-left font-medium">Ink Spec</th><th className="p-2 w-8"></th></tr></thead>
                  <tbody>
                    {((job as any).lineItems && (job as any).lineItems.length > 0) ? (
                      (job as any).lineItems.map((li: any, i: number) => {
                        // Click-to-edit cell: prompts for a new value, PATCHes, reloads.
                        // Keeps markup tiny without rebuilding the whole table into a form.
                        const editCell = async (field: string, label: string, current: any) => {
                          const next = prompt(`${label}:`, String(current ?? ""));
                          if (next === null) return;
                          const res = await fetch(`/api/jobs/${jobId}/lines`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lineItem", itemId: li.id, field, value: next }) });
                          if (res.ok) {
                            const lr = await fetch(`/api/jobs/${jobId}/lines`);
                            const ld = await lr.json();
                            if (ld.lineItems) setJob((prev: any) => prev ? { ...prev, lineItems: ld.lineItems } : prev);
                          }
                        };
                        const finSizeDisplay = li.finishedWidth ? `${li.finishedWidth}${li.finishedHeight ? ` x ${li.finishedHeight}` : ""}` : "—";
                        return (
                          <tr key={li.id || i} className="border-t hover:bg-white">
                            <td className="p-2 font-medium cursor-pointer" onClick={() => editCell("quantity", "Quantity", li.quantity)}>{li.quantity?.toLocaleString() || "—"}</td>
                            <td className="p-2 cursor-pointer" onClick={() => editCell("description", "Description", li.description)}>{li.description || "—"}</td>
                            <td className="p-2 cursor-pointer" onClick={() => editCell("flatSize", "Flat size (e.g. 11x17)", li.flatSize)}>{li.flatSize || "—"}</td>
                            <td className="p-2 cursor-pointer" onClick={async () => {
                              const next = prompt("Finished size (WxH, e.g. 8.5x11):", `${li.finishedWidth || ""}x${li.finishedHeight || ""}`);
                              if (next === null) return;
                              const [w, h] = next.split(/[xX]/).map(s => parseFloat(s.trim()));
                              await fetch(`/api/jobs/${jobId}/lines`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lineItem", itemId: li.id, field: "finishedWidth", value: isNaN(w) ? null : w }) });
                              await fetch(`/api/jobs/${jobId}/lines`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lineItem", itemId: li.id, field: "finishedHeight", value: isNaN(h) ? null : h }) });
                              const lr = await fetch(`/api/jobs/${jobId}/lines`);
                              const ld = await lr.json();
                              if (ld.lineItems) setJob((prev: any) => prev ? { ...prev, lineItems: ld.lineItems } : prev);
                            }}>{finSizeDisplay}</td>
                            <td className="p-2 cursor-pointer" onClick={() => editCell("inkSpec", "Ink spec (e.g. 4/0 CMYK)", li.inkSpec)}>{li.inkSpec || "—"}</td>
                            <td className="p-1 text-right">
                              <button className="text-red-500 hover:text-red-700 text-xs" title="Delete line" onClick={async () => {
                                if (!confirm("Delete this line item?")) return;
                                await fetch(`/api/jobs/${jobId}/lines`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lineItem", itemId: li.id }) });
                                const lr = await fetch(`/api/jobs/${jobId}/lines`);
                                const ld = await lr.json();
                                if (ld.lineItems) setJob((prev: any) => prev ? { ...prev, lineItems: ld.lineItems } : prev);
                              }}>✕</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="border-t"><td className="p-2 font-medium">{job.quantity?.toLocaleString()}</td><td className="p-2">{job.description || "—"}</td><td className="p-2">{job.flatSizeWidth && job.flatSizeHeight ? `${job.flatSizeWidth}x${job.flatSizeHeight}` : "—"}</td><td className="p-2">{job.finishedWidth && job.finishedHeight ? `${job.finishedWidth} x ${job.finishedHeight}` : "—"}</td><td className="p-2">{job.inkFront || "—"}</td><td /></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">Click any cell to edit. Size and ink are per-version.</p>
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
                options={[{ value: "", label: "Select stock..." }, ...dbMaterials.map(m => {
                  const avail = m.available ?? 0;
                  const short = m.isShort || avail <= 0;
                  const tag = short ? " ⚠ SHORT" : m.isLow ? " ⚠ LOW" : avail > 0 ? ` — ${avail.toLocaleString()} free` : "";
                  return { value: m.name, label: `${m.name}${m.sku ? ` (${m.sku})` : ""}${tag}` };
                })]}
              />
              {/* Inventory status strip for selected stock */}
              {job.stockDescription && (() => {
                const sel = dbMaterials.find(m => m.name === job.stockDescription);
                if (!sel) return null;
                const onHand = sel.onHand ?? 0;
                const allocated = sel.allocated ?? 0;
                const available = sel.available ?? 0;
                const unit = sel.unit || "sheets";
                const needed = job.quantity || 0;
                const shortForJob = needed > 0 && available < needed;
                const bg = shortForJob || sel.isShort ? "bg-red-50 border-red-200 text-red-800"
                          : sel.isLow ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800";
                return (
                  <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${bg}`}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span><span className="font-semibold">On Hand:</span> {onHand.toLocaleString()} {unit}</span>
                      <span><span className="font-semibold">Allocated:</span> {allocated.toLocaleString()}</span>
                      <span><span className="font-semibold">Free:</span> {available.toLocaleString()}</span>
                      {needed > 0 && <span><span className="font-semibold">Needed for this job:</span> {needed.toLocaleString()}</span>}
                    </div>
                    {shortForJob && (
                      <div className="mt-1 font-medium">
                        ⚠ Not enough free inventory — switch Paper Source to "Order New" and flag for purchasing.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex items-end">
              <Checkbox
                label="FSC Certified"
                checked={job.fscCertified || false}
                onChange={(v) => updateJobField("fscCertified", v)}
              />
            </div>

            {/* Paper Source — Darrin flags whether to use on-hand stock or order fresh */}
            <div className="lg:col-span-3">
              <SectionLabel>Paper Source</SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { value: "on_hand", label: "Use On Hand", color: "emerald" },
                  { value: "order_new", label: "Order New", color: "amber" },
                  { value: "customer_supplied", label: "Customer Supplied", color: "blue" },
                ] as const).map(opt => {
                  const active = (job.paperSource || "on_hand") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateJobField("paperSource", opt.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        active
                          ? opt.color === "emerald" ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : opt.color === "amber" ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {job.paperSource === "order_new" && job.stockDescription && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/purchases", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            jobId: job.id,
                            category: "paper",
                            description: `${job.stockDescription} — Job ${job.jobNumber} (${job.quantity?.toLocaleString() || "?"} units)`,
                            status: "needed",
                          }),
                        });
                        if (res.ok) alert("Flagged for purchasing — check the purchase queue on the job.");
                        else alert("Could not flag for purchase. Check the inventory / purchasing page.");
                      } catch { alert("Network error flagging purchase."); }
                    }}
                    className="ml-2 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                  >
                    + Flag for Purchasing
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {job.paperSource === "order_new" && "Darrin: flag this if on-hand inventory is spoken for. Click Flag for Purchasing to send to the purchase queue."}
                {job.paperSource === "on_hand" && "Using existing inventory. Make sure the stock isn't allocated to another job."}
                {job.paperSource === "customer_supplied" && "Customer is providing the paper — no purchase needed."}
              </p>
            </div>

            <div>
              <SectionLabel>Blanket No.</SectionLabel>
              <Input
                defaultValue={job.blanketNumber || ""}
                placeholder="Blanket #..."
                onBlur={(e) => updateJobField("blanketNumber", e.target.value)}
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
                  defaultValue={job.flatSizeWidth || ""}
                  placeholder="Width"
                  className="flex-1"
                  onBlur={(e) => updateJobField("flatSizeWidth", parseFloat(e.target.value) || 0)}
                />
                <span className="text-gray-400 text-sm">x</span>
                <Input
                  type="number"
                  defaultValue={job.flatSizeHeight || ""}
                  placeholder="Height"
                  className="flex-1"
                  onBlur={(e) => updateJobField("flatSizeHeight", parseFloat(e.target.value) || 0)}
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
                defaultValue={job.varnish || ""}
                placeholder="e.g. Aqueous Gloss"
                onBlur={(e) => updateJobField("varnish", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <Checkbox label="Has Bleeds" checked={job.hasBleeds || false} onChange={(v) => updateJobField("hasBleeds", v)} />
            {/* Self Cover / Plus Cover moved to page-info row at top of ticket per CSR feedback */}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* 4a. PRE-PRESS — proofs + instructions (combined)                   */}
      {/* Pre-press is a distinct stage between estimating and production.   */}
      {/* Everything pre-press related lives here: proof uploads, customer   */}
      {/* delivery, approval, and free-text instructions for the team.      */}
      {/* Placed above Outside Purchases because pre-press happens first.   */}
      {/* ================================================================= */}
      <div className="rounded-xl border-l-4 border-l-purple-500 bg-purple-50/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-purple-600" />
          <span className="font-semibold text-purple-900">Pre-Press Stage</span>
          <span className="text-xs text-gray-500">— Complete proofs + customer approval before production can schedule.</span>
        </div>
        <ProofsCard jobId={jobId} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileCheck className="h-4 w-4" />Pre-Press Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              defaultValue={job.prepressNotes || ""}
              placeholder="Notes for Michael/Kevin — proof rounds, structural design, plate requirements, trapping..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              onBlur={(e) => updateJobField("prepressNotes", e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* ================================================================= */}
      {/* 4b. OUTSIDE PURCHASES — moved adjacent to Stock per CSR feedback  */}
      {/* (paper / coatings / foil are stock-like decisions; keep together) */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Outside Purchases Required</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddingPurchase(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Add Purchase
          </Button>
        </CardHeader>
        <CardContent>
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
                // Pre-fill each prompt from the job-level press fields so Kelsey
                // doesn't have to re-type what she already picked in the dropdowns.
                const press = prompt("Press (e.g. KOM, Offset #2):", job.pressAssignment || "");
                const form = prompt("Form # / Info:", job.pressFormat || "");
                const finish = prompt("Finish Count:", job.finalPressCount ? String(job.finalPressCount) : "");
                const makeReady = prompt("Make Ready:", job.makeReadyCount ? String(job.makeReadyCount) : "");
                const runSize = prompt("Running Size (e.g. 23X29):", job.runningSize || "");
                const imp = prompt("Imposition (e.g. 1-Side):", job.imposition || "");
                const nUp = prompt("# Up:", job.numberUp ? String(job.numberUp) : "");
                const ink = prompt("Ink (e.g. 5/0):", job.inkFront || "");
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
      {/* 6a². FROM QUOTE REQUEST — long-tail fields that don't have Job cols */}
      {/* ================================================================= */}
      {quoteRequest && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <FileCheck className="h-4 w-4" />From Quote Request #{quoteRequest.requestNumber}
            </CardTitle>
            <p className="text-xs text-gray-600">Read-only snapshot of the original CSR intake — source of truth for fields the ticket doesn't track directly.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              {(() => {
                const qr = quoteRequest;
                const rows: Array<[string, any]> = [];
                const push = (label: string, v: any) => { if (v != null && v !== "" && v !== false) rows.push([label, v === true ? "Yes" : String(v)]); };
                push("Job type", qr.jobType && qr.jobType !== "new" ? (qr.jobType === "exact_reprint" ? "EXACT REPRINT" : "REPRINT W/ CHANGES") : null);
                push("Pickup from", qr.pickupJobNumber);
                push("Low-res proofs", qr.lowResProofs);
                push("Hi-res proofs", qr.hiResProofs);
                push("Orientation", qr.orientation);
                push("Colors S1", qr.colorsSide1);
                push("Colors S2", qr.colorsSide2);
                push("Coating S1", qr.coatingSide1);
                push("Coating S2", qr.coatingSide2);
                push("Flood UV", qr.floodUv && (qr.uvSides || "yes"));
                push("Spot UV", qr.spotUv && (qr.uvSides || "yes"));
                push("Flood LED UV", qr.floodLedUv && (qr.ledUvSides || "yes"));
                push("Spot LED UV", qr.spotLedUv && (qr.ledUvSides || "yes"));
                push("Aqueous", qr.aqueous);
                push("Dry trap", qr.drytrap);
                push("Fold type", qr.foldType);
                push("Saddle stitch", qr.saddleStitch);
                push("Corner stitch", qr.cornerStitch);
                push("Perfect bind", qr.perfectBind);
                push("Plastic coil", qr.plasticCoil);
                push("Wire-O", qr.wireO);
                push("GBC", qr.gbc);
                push("Case bind", qr.caseBind);
                push("Lamination", qr.lamination);
                push("Foil", qr.foil && `${qr.foil}${qr.foilIsNew ? " (NEW)" : ""}`);
                push("Emboss", qr.emboss && `${qr.emboss}${qr.embossIsNew ? " (NEW)" : ""}`);
                push("Die cut", qr.dieCut && `${qr.existingDieNumber ? `#${qr.existingDieNumber}` : "yes"}${qr.dieVHSize ? ` (${qr.dieVHSize})` : ""}`);
                push("Drill", qr.drill);
                push("Punch", qr.punch);
                push("Score", qr.score);
                push("Perf", qr.perf);
                push("Round corner", qr.roundCorner);
                push("Numbering", qr.numbering);
                push("NCR pad", qr.ncrPad);
                push("Band", qr.bandIn);
                push("Wrap", qr.wrapIn);
                push("Pad", qr.padIn);
                push("Mailing", qr.mailingServices);
                push("Wafer seal", qr.waferSeal && `${qr.waferSealTabs ? `x${qr.waferSealTabs}` : ""}${qr.waferSealLocation ? ` @ ${qr.waferSealLocation}` : ""}`);
                push("# Pockets", qr.numPockets);
                push("Artwork", qr.artworkIsNew ? "NEW" : qr.artworkFileName || qr.artworkUrl || null);
                push("Vendor", qr.vendorName);
                return rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-blue-100 py-1">
                    <span className="text-gray-600">{k}</span>
                    <span className="font-medium text-gray-900">{v}</span>
                  </div>
                ));
              })()}
            </div>
            {quoteRequest.specialInstructions && (
              <div className="mt-3 rounded border border-blue-200 bg-white p-2 text-xs">
                <div className="font-semibold text-blue-900">Special instructions</div>
                <div className="whitespace-pre-wrap text-gray-700">{quoteRequest.specialInstructions}</div>
              </div>
            )}
            {quoteRequest.customColorCoatingNotes && (
              <div className="mt-2 rounded border border-blue-200 bg-white p-2 text-xs">
                <div className="font-semibold text-blue-900">Color / coating notes</div>
                <div className="whitespace-pre-wrap text-gray-700">{quoteRequest.customColorCoatingNotes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pre-Press section moved above Outside Purchases — see Section 4a. */}

      {/* ================================================================= */}
      {/* 6c. PAYMENT INFO / TERMS                                           */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Payment Info</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            defaultValue={job.paymentNotes || ""}
            placeholder="Payment terms, deposit received, PO reference, billing instructions..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            onBlur={(e) => updateJobField("paymentNotes", e.target.value)}
          />
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

// Proofs card — tied to job, visible to customer via portal
function ProofsCard({ jobId }: { jobId: string }) {
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/proofs?jobId=${jobId}`);
      const data = await res.json();
      setProofs(data.proofs || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobId]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setFileUrl(data.url);
        setFileName(data.fileName || file.name);
      }
    } catch { /* user can paste URL manually */ }
    setUploading(false);
  };

  const createProof = async () => {
    if (!fileName.trim() && !fileUrl.trim()) return;
    await fetch("/api/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, fileName, fileUrl: fileUrl || null, notes: notes || null }),
    });
    setFileName(""); setFileUrl(""); setNotes(""); setAdding(false);
    load();
  };

  const markSent = async (proofId: string, deliveryMethod: "email" | "physical") => {
    await fetch("/api/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", proofId, deliveryMethod }),
    });
    load();
  };

  const decide = async (proofId: string, action: "approve" | "reject") => {
    await fetch("/api/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, proofId }),
    });
    load();
  };

  const statusBadge = (s: string) => {
    if (s === "APPROVED") return "bg-emerald-100 text-emerald-700";
    if (s === "REJECTED") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><FileImage className="h-4 w-4" />Proofs</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setAdding(!adding)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />{adding ? "Cancel" : "Upload Proof"}
        </Button>
      </CardHeader>
      <CardContent>
        {adding && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
            <label className="block text-xs font-medium text-gray-700">Attach proof file</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.ai,.psd"
                className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium hover:file:bg-brand-100"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              />
              {uploading && <span className="text-xs text-gray-500">Uploading…</span>}
              {fileUrl && !uploading && <span className="text-xs text-emerald-700 truncate">✓ {fileName}</span>}
            </div>
            <Input placeholder="Or paste URL (OneDrive, etc.)" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
            <Input placeholder="File name (auto-fills from upload)" value={fileName} onChange={(e) => setFileName(e.target.value)} />
            <Input placeholder="Notes for sales/customer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button size="sm" onClick={createProof} className="gap-1.5" disabled={uploading}>
              <Plus className="h-3.5 w-3.5" />Add proof (ready for sales to send)
            </Button>
            <p className="text-[11px] text-gray-500">
              Once added, it lands in the sales rep&apos;s queue to email or physically send to the customer.
            </p>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-gray-400">Loading proofs...</p>
        ) : proofs.length === 0 ? (
          <p className="text-sm text-gray-400">No proofs yet. Upload the first round for customer review.</p>
        ) : (
          <div className="space-y-2">
            {proofs.map((p) => {
              const sent = !!p.sentToCustomerAt;
              return (
                <div key={p.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">v{p.version}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>{p.status}</span>
                        {sent && p.status === "PENDING" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            SENT · {p.deliveryMethod?.toUpperCase()}
                          </span>
                        )}
                        {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noopener" className="text-xs text-brand-600 hover:underline">{p.fileName || "view"}</a>}
                        {!p.fileUrl && <span className="text-xs text-gray-500">{p.fileName}</span>}
                      </div>
                      {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                      {sent && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Sent to customer {new Date(p.sentToCustomerAt).toLocaleDateString()} via {p.deliveryMethod}
                        </p>
                      )}
                      {p.customerApprovedAt && (
                        <p className="text-[11px] text-emerald-600 mt-0.5">
                          ✓ Customer approved {new Date(p.customerApprovedAt).toLocaleDateString()}
                          {p.productionAlertSentAt && " — production notified"}
                        </p>
                      )}
                    </div>
                    {p.status === "PENDING" && !sent && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => markSent(p.id, "email")} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Email to customer</button>
                        <button onClick={() => markSent(p.id, "physical")} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Sent physically</button>
                      </div>
                    )}
                    {p.status === "PENDING" && sent && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => decide(p.id, "approve")} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold">✓ Customer approved</button>
                        <button onClick={() => decide(p.id, "reject")} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Rejected</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">
          Flow: <strong>Pre-press uploads</strong> → <strong>Sales sends to customer</strong> (email or physical) →
          <strong> Customer approves</strong> → production automatically alerted, printing gate unlocks.
        </p>
      </CardContent>
    </Card>
  );
}
