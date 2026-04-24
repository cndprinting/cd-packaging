"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, X, Loader2, ArrowRight, FileBarChart, Trash2, ChevronDown, ChevronRight, Info, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { formatDate } from "@/lib/utils";

interface QuoteRequest {
  id: string;
  requestNumber: string;
  status: string;
  customerName: string;
  jobTitle: string | null;
  descriptionType: string | null;
  productType: string | null;
  quantity1: number | null;
  dateNeeded: string | null;
  submittedByName: string;
  createdAt: string;
  convertedQuoteId: string | null;
  lineItems?: { id: string; version: string; quantity: number }[];
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  estimating: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-400",
};

interface Company { id: string; name: string; }

type LineItem = {
  version: string;
  quantity: string;
  flatWidth: string;
  flatHeight: string;
  finishedWidth: string;
  finishedHeight: string;
  finishedDepth: string;
  dieNumber: string;
  dieIsNew: boolean;
  notes: string;
};

const emptyLineItem = (n: number): LineItem => ({
  version: `Version ${n}`,
  quantity: "",
  flatWidth: "", flatHeight: "",
  finishedWidth: "", finishedHeight: "", finishedDepth: "",
  dieNumber: "", dieIsNew: false, notes: "",
});

type FormState = {
  // Customer basics
  jobType: string; pickupJobNumber: string;
  customerName: string; companyId: string;
  dateNeeded: string;
  productType: string; descriptionType: string; jobTitle: string;
  pages: string; coverType: string; orientation: string;
  // Proofs
  lowResProofs: string; hiResProofs: string;
  // Colors
  colorsSide1: string; colorsSide2: string;
  // Coatings
  coatingSide1: string; coatingSide2: string;
  floodUv: boolean; spotUv: boolean; uvSides: string;
  floodLedUv: boolean; spotLedUv: boolean; ledUvSides: string;
  aqueous: boolean; drytrap: boolean;
  customColorCoatingNotes: string;
  // Size (only used if no line items override)
  flatWidth: string; flatHeight: string;
  finishedWidth: string; finishedHeight: string; finishedDepth: string;
  hasBleeds: boolean;
  // Paper
  paperWeight: string; paperDescription: string; paperType: string;
  // Bindery / folding
  foldType: string; score: boolean; perf: boolean; dieCut: boolean;
  existingDieNumber: string; numPockets: string; dieVHSize: string;
  // Foil / emboss
  foil: string; foilIsNew: boolean;
  emboss: string; embossIsNew: boolean;
  // Binding
  saddleStitch: boolean; cornerStitch: boolean; perfectBind: boolean;
  plasticCoil: string; wireO: string; gbc: string; caseBind: string;
  lamination: string;
  // Finishing add-ons
  drill: boolean; bandIn: string; wrapIn: string; padIn: string;
  ncrPad: boolean; numbering: string; punch: boolean; roundCorner: boolean;
  // Mailing
  mailingServices: string;
  waferSeal: boolean; waferSealTabs: string; waferSealLocation: string;
  // Art
  artworkUrl: string; artworkFileName: string; artworkIsNew: boolean; artworkNotes: string;
  // Notes
  specialInstructions: string; vendorName: string; deliveryInstructions: string;
};

const defaultForm: FormState = {
  jobType: "new", pickupJobNumber: "",
  customerName: "", companyId: "",
  dateNeeded: "",
  productType: "komori", descriptionType: "", jobTitle: "",
  pages: "", coverType: "self_cover", orientation: "",
  lowResProofs: "1", hiResProofs: "1",
  colorsSide1: "", colorsSide2: "",
  coatingSide1: "", coatingSide2: "",
  floodUv: false, spotUv: false, uvSides: "",
  floodLedUv: false, spotLedUv: false, ledUvSides: "",
  aqueous: false, drytrap: false,
  customColorCoatingNotes: "",
  flatWidth: "", flatHeight: "",
  finishedWidth: "", finishedHeight: "", finishedDepth: "",
  hasBleeds: false,
  paperWeight: "", paperDescription: "", paperType: "cover",
  foldType: "", score: false, perf: false, dieCut: false,
  existingDieNumber: "", numPockets: "", dieVHSize: "",
  foil: "", foilIsNew: false,
  emboss: "", embossIsNew: false,
  saddleStitch: false, cornerStitch: false, perfectBind: false,
  plasticCoil: "", wireO: "", gbc: "", caseBind: "",
  lamination: "",
  drill: false, bandIn: "", wrapIn: "", padIn: "",
  ncrPad: false, numbering: "", punch: false, roundCorner: false,
  mailingServices: "",
  waferSeal: false, waferSealTabs: "", waferSealLocation: "",
  artworkUrl: "", artworkFileName: "", artworkIsNew: true, artworkNotes: "",
  specialInstructions: "", vendorName: "", deliveryInstructions: "",
};

// Collapsible section
function Section({ title, subtitle, defaultOpen = true, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, children, hint, required }: { label: React.ReactNode; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
      {label}
    </label>
  );
}

export default function QuoteRequestsPage() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userRole, setUserRole] = useState("");
  const [view, setView] = useState<"active" | "completed" | "all">("active");

  const [form, setForm] = useState<FormState>(defaultForm);
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem(1)]);
  // Jobs list for Previous Job # dropdown (filters by selected customer).
  const [allJobs, setAllJobs] = useState<{ id: string; jobNumber: string; name: string; companyId: string; companyName: string }[]>([]);
  // Track artwork upload state to show a spinner + success flag.
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const update = <K extends keyof FormState>(f: K, v: FormState[K]) => setForm(p => ({ ...p, [f]: v }));
  const updateLine = (idx: number, patch: Partial<LineItem>) => setLineItems(p => p.map((li, i) => i === idx ? { ...li, ...patch } : li));
  const addLine = () => setLineItems(p => [...p, emptyLineItem(p.length + 1)]);
  const removeLine = (idx: number) => setLineItems(p => p.length === 1 ? p : p.filter((_, i) => i !== idx));

  const isReprint = form.jobType === "exact_reprint" || form.jobType === "reprint_with_changes";
  const isExactReprint = form.jobType === "exact_reprint";

  useEffect(() => {
    fetch("/api/quote-requests").then(r => r.json()).then(d => setRequests(d.requests || [])).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/companies").then(r => r.json()).then(d => setCompanies(d.companies || [])).catch(() => {});
    fetch("/api/auth/session").then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role); }).catch(() => {});
    // Load all jobs for the Previous Job # dropdown (filtered client-side by customer).
    fetch("/api/jobs").then(r => r.json()).then(d => setAllJobs(d.jobs || [])).catch(() => {});
  }, []);

  const isEstimator = ["OWNER", "GM", "ADMIN", "ESTIMATOR", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"].includes(userRole);

  const resetForm = () => { setForm(defaultForm); setLineItems([emptyLineItem(1)]); setError(""); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Per Mary's CSR-nuance pass: only these 4 are required so sales/CSRs
    // can submit quickly without Mary-level detail. Everything else is
    // optional and can be filled in by estimating.
    if (!form.customerName) { setError("Customer name is required"); return; }
    const validLines = lineItems.filter(li => li.version.trim() && li.quantity);
    if (validLines.length === 0) { setError("At least one version with a quantity is required"); return; }
    if (!form.descriptionType) { setError("Product type is required (pick 'Unsure' if you're not sure)"); return; }
    if (!form.paperWeight) { setError("Paper type is required (pick 'Unsure' if you're not sure)"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lineItems: validLines }),
      });
      const data = await res.json();
      if (res.ok) { setRequests(prev => [data.request, ...prev]); setShowModal(false); resetForm(); }
      else setError(data.error || "Failed");
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  const pending = requests.filter(r => r.status === "pending").length;
  const estimating = requests.filter(r => r.status === "estimating").length;
  const completed = requests.filter(r => r.status === "completed").length;
  const visibleRequests = requests.filter(r => {
    if (view === "active") return r.status === "pending" || r.status === "estimating";
    if (view === "completed") return r.status === "completed";
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quote Requests</h1>
            <p className="text-sm text-gray-500">Submit specs for estimating</p>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer" title="Bulk-import line items from a customer PO / order form spreadsheet (xlsx or csv). Use this when the customer sends a sheet with SKUs + quantities you want to attach to a quote or job — not for routine quote requests.">
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
                try {
                  const res = await fetch("/api/import", { method: "POST", body: fd });
                  const data = await res.json();
                  if (res.ok) {
                    alert(`Parsed ${data.lineItems?.length || 0} line items (${data.totalQuantity?.toLocaleString() || 0} total units). Attach to a job from the job ticket page.`);
                  } else {
                    alert(data.error || "Import failed");
                  }
                } catch { alert("Import failed"); }
                e.target.value = "";
              }}
            />
          </label>
          <Button onClick={() => { resetForm(); setShowModal(true); }} className="gap-2"><Plus className="h-4 w-4" />New Request</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{pending}</p><p className="text-xs text-gray-500">Pending</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{estimating}</p><p className="text-xs text-gray-500">Being Estimated</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{completed}</p><p className="text-xs text-gray-500">Completed</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{requests.length}</p><p className="text-xs text-gray-500">Total</p></Card>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([
          { id: "active", label: `Active (${pending + estimating})` },
          { id: "completed", label: `Completed (${completed})` },
          { id: "all", label: `All (${requests.length})` },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === tab.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {visibleRequests.map((req) => (
          <Card key={req.id} className={`border-l-4 ${req.status === "pending" ? "border-l-amber-400" : req.status === "estimating" ? "border-l-blue-400" : req.status === "completed" ? "border-l-emerald-400" : "border-l-gray-300"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium">{req.requestNumber}</span>
                    <Badge className={statusColors[req.status]}>{req.status}</Badge>
                  </div>
                  <p className="font-semibold text-gray-900">{req.customerName} — {req.jobTitle || req.descriptionType || "Untitled"}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {req.productType && <span className="mr-3">Type: {req.productType}</span>}
                    {req.lineItems && req.lineItems.length > 0 ? (
                      <span className="mr-3">{req.lineItems.length} version{req.lineItems.length > 1 ? "s" : ""} · {req.lineItems.reduce((s, l) => s + (l.quantity || 0), 0).toLocaleString()} total</span>
                    ) : req.quantity1 ? (
                      <span className="mr-3">Qty: {req.quantity1.toLocaleString()}</span>
                    ) : null}
                    {req.dateNeeded && <span>Need by: {formatDate(req.dateNeeded)}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Submitted by {req.submittedByName} on {formatDate(req.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  {isEstimator && req.status === "pending" && (
                    <Button size="sm" variant="outline" className="gap-1 text-blue-600" onClick={async () => {
                      await fetch("/api/quote-requests", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: req.id, status: "estimating" }) });
                      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "estimating" } : r));
                    }}>
                      <ArrowRight className="h-3.5 w-3.5" /> Start Estimating
                    </Button>
                  )}
                  {req.status !== "completed" && !req.convertedQuoteId && (
                    <Button size="sm" variant="outline" className="gap-1 text-purple-600" title="Create a placeholder job without waiting for the estimator — for testing downstream steps" onClick={async () => {
                      if (!confirm("Fast-track this request to a placeholder job? Use this to test production/job-ticket features without waiting on a full estimate.")) return;
                      const res = await fetch(`/api/quote-requests/${req.id}/fast-track`, { method: "POST" });
                      const data = await res.json();
                      if (res.ok && data.job) {
                        window.location.href = `/dashboard/jobs/${data.job.id}`;
                      } else {
                        alert(data.error || "Fast-track failed");
                      }
                    }}>
                      <Zap className="h-3.5 w-3.5" /> Fast-track to Job
                    </Button>
                  )}
                  {isEstimator && req.status === "estimating" && (
                    <a href={`/dashboard/quotes/estimate?from=${req.id}`}>
                      <Button size="sm" className="gap-1">
                        <ArrowRight className="h-3.5 w-3.5" /> Open in Estimator
                      </Button>
                    </a>
                  )}
                  {req.convertedQuoteId && (
                    <a href={`/dashboard/quotes/${req.convertedQuoteId}`}>
                      <Button size="sm" variant="outline" className="gap-1"><FileText className="h-3.5 w-3.5" /> View Quote</Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {visibleRequests.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {view === "active" ? "No active quote requests" : view === "completed" ? "No completed requests yet" : "No quote requests yet"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {view === "active" ? "Completed requests moved to the Quotes tab." : "Click \"New Request\" to submit specs for estimating"}
            </p>
          </Card>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pb-2 border-b border-gray-100">
                <h2 className="text-lg font-semibold">New Quote Request</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-lg p-2.5">
                  <strong>Required fields marked with <span className="text-red-600">*</span></strong> — just Customer, Quantity, Product Type, and Paper.
                  Everything else is optional — if you&apos;re not sure about a detail, leave it blank or pick &quot;Unsure&quot; and Mary will fill it in during estimating.
                </div>

                {/* 1. Job type + customer basics */}
                <Section title="Job Basics" defaultOpen={true}>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reprint Type</label>
                    <div className="flex gap-2">
                      {[
                        { v: "new", label: "New Job" },
                        { v: "exact_reprint", label: "Exact Reprint" },
                        { v: "reprint_with_changes", label: "Reprint w/ Changes" },
                      ].map(opt => (
                        <button key={opt.v} type="button" onClick={() => update("jobType", opt.v)}
                          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${form.jobType === opt.v ? "bg-brand-50 border-brand-500 text-brand-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isReprint && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <Field label={`Previous Job #${form.customerName ? ` — filtered to ${form.customerName}` : " — pick customer first to filter"}`}>
                          <Combobox
                            value={form.pickupJobNumber}
                            onChange={(_id, label) => update("pickupJobNumber", label)}
                            options={allJobs
                              .filter(j => !form.companyId || j.companyId === form.companyId)
                              .map(j => ({
                                id: j.jobNumber,
                                label: j.jobNumber,
                                subtitle: `${j.name}${j.companyName ? ` — ${j.companyName}` : ""}`,
                              }))}
                            placeholder="Search past jobs..."
                            allowCreate
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={<span>Customer <span className="text-red-600">*</span></span>} hint="Required">
                      <Combobox value={form.customerName} onChange={(id, label) => { update("customerName", label); update("companyId", id || ""); }}
                        options={companies.map(c => ({ id: c.id, label: c.name }))} placeholder="Select customer..." allowCreate />
                    </Field>
                    <Field label="Date Needed (job completion)" hint="When the finished job must ship, not when the quote is due">
                      <Input type="date" value={form.dateNeeded} onChange={(e) => update("dateNeeded", e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Product Type">
                      <Select value={form.productType} onChange={(e) => update("productType", e.target.value)} options={[
                        { value: "komori", label: "Komori (Offset)" },
                        { value: "digital", label: "Digital" },
                        { value: "letterpress", label: "Letterpress" },
                        { value: "bindery", label: "Bindery Only" },
                        { value: "vendor", label: "Outside Vendor" },
                      ]} />
                    </Field>
                    <Field label="Job Title">
                      <Input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} placeholder="Job name" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Product Type" required hint="Pick 'Unsure' if you don't know — Mary will confirm in estimating">
                      <Select value={form.descriptionType} onChange={(e) => update("descriptionType", e.target.value)} options={[
                        { value: "", label: "Select type..." },
                        { value: "unsure", label: "Unsure — please advise" },
                        { value: "folding_carton", label: "Folding Carton" },
                        { value: "flyer", label: "Flyer" },
                        { value: "postcard", label: "Postcard" },
                        { value: "brochure", label: "Brochure" },
                        { value: "book", label: "Book" },
                        { value: "pocket_folder", label: "Pocket Folder" },
                        { value: "letterhead", label: "Letterhead" },
                        { value: "envelope", label: "Sleeve Envelope" },
                        { value: "business_card", label: "Business Card" },
                        { value: "door_hanger", label: "Door Hanger" },
                        { value: "hang_tag", label: "Hang Tag" },
                      ]} />
                    </Field>
                    <Field label={`Pages${form.descriptionType === "folding_carton" ? " (max 2)" : ""}`}>
                      <Input type="number" min="1" max={form.descriptionType === "folding_carton" ? "2" : undefined}
                        value={form.pages}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (form.descriptionType === "folding_carton" && parseInt(v) > 2) v = "2";
                          update("pages", v);
                        }} placeholder="e.g. 28" />
                    </Field>
                    {/* Cover Type hidden for folding carton — only applies to books/brochures */}
                    {form.descriptionType !== "folding_carton" && (
                      <Field label="Cover Type">
                        <Select value={form.coverType} onChange={(e) => update("coverType", e.target.value)} options={[
                          { value: "", label: "Not specified" },
                          { value: "self_cover", label: "Self Cover" },
                          { value: "plus_cover", label: "Plus Cover" },
                        ]} />
                      </Field>
                    )}
                  </div>
                  {/* Orientation hidden for folding carton — cartons have their own construction */}
                  {form.descriptionType !== "folding_carton" && (
                    <Field label="Orientation">
                      <Select value={form.orientation} onChange={(e) => update("orientation", e.target.value)} options={[
                        { value: "", label: "Not specified" },
                        { value: "portrait", label: "Portrait" },
                        { value: "landscape", label: "Landscape" },
                      ]} />
                    </Field>
                  )}
                </Section>

                {/* 2. Line items */}
                <Section title="Versions & Quantities" subtitle="Add a line per SKU / version. Each can have its own size and die." defaultOpen={true}>
                  {lineItems.map((li, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">Line {idx + 1}</span>
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Version / SKU">
                          <Input value={li.version} onChange={(e) => updateLine(idx, { version: e.target.value })} placeholder="e.g. Version A" />
                        </Field>
                        <Field label="Quantity" required>
                          <Input type="number" value={li.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} placeholder="0" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Flat W x H (optional override)">
                          <div className="flex gap-1 items-center">
                            <Input type="number" step="0.0625" value={li.flatWidth} onChange={(e) => updateLine(idx, { flatWidth: e.target.value })} placeholder="W" />
                            <span className="text-gray-400 text-xs">x</span>
                            <Input type="number" step="0.0625" value={li.flatHeight} onChange={(e) => updateLine(idx, { flatHeight: e.target.value })} placeholder="H" />
                          </div>
                        </Field>
                        <Field label="Finished W x H x D (optional)">
                          <div className="flex gap-1 items-center">
                            <Input type="number" step="0.0625" value={li.finishedWidth} onChange={(e) => updateLine(idx, { finishedWidth: e.target.value })} placeholder="W" />
                            <span className="text-gray-400 text-xs">x</span>
                            <Input type="number" step="0.0625" value={li.finishedHeight} onChange={(e) => updateLine(idx, { finishedHeight: e.target.value })} placeholder="H" />
                            <span className="text-gray-400 text-xs">x</span>
                            <Input type="number" step="0.0625" value={li.finishedDepth} onChange={(e) => updateLine(idx, { finishedDepth: e.target.value })} placeholder="D" />
                          </div>
                        </Field>
                        {!isExactReprint && (
                          <Field label="Die # (if different)">
                            <div className="flex gap-1">
                              <Input value={li.dieNumber} onChange={(e) => updateLine(idx, { dieNumber: e.target.value })} placeholder="Die #" />
                              <label className="flex items-center gap-1 text-xs">
                                <input type="checkbox" checked={li.dieIsNew} onChange={(e) => updateLine(idx, { dieIsNew: e.target.checked })} className="h-3 w-3" />
                                New
                              </label>
                            </div>
                          </Field>
                        )}
                      </div>
                      <Field label="Line Notes">
                        <Input value={li.notes} onChange={(e) => updateLine(idx, { notes: e.target.value })} placeholder="version-specific notes..." />
                      </Field>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Version</Button>
                </Section>

                {/* 3. Art & Proofs */}
                <Section title="Art & Proofs" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Low-Res Proofs">
                      <Input type="number" value={form.lowResProofs} onChange={(e) => update("lowResProofs", e.target.value)} placeholder="1" />
                    </Field>
                    {!isExactReprint && (
                      <Field label="Hi-Res Proofs">
                        <Input type="number" value={form.hiResProofs} onChange={(e) => update("hiResProofs", e.target.value)} placeholder="1" />
                      </Field>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <Check label="New artwork (not yet supplied)" checked={form.artworkIsNew} onChange={(v) => update("artworkIsNew", v)} />
                    <Check label="Has bleeds" checked={form.hasBleeds} onChange={(v) => update("hasBleeds", v)} />
                  </div>
                  {/* File upload — lets sales/CSR attach a PDF or Word doc so Mary
                      can read dimensions off the artwork instead of risking
                      typos in the form fields. Falls back to URL paste. */}
                  <Field label="Attach artwork" hint="PDF, Word doc, or image — Mary can pull dimensions from the file">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ai,.psd,.indd"
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium hover:file:bg-brand-100"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingArtwork(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: fd });
                            const data = await res.json();
                            if (data.url) {
                              update("artworkUrl", data.url);
                              update("artworkFileName", data.fileName || file.name);
                            }
                          } catch { /* user will see empty URL; can paste manually */ }
                          setUploadingArtwork(false);
                        }}
                      />
                      {uploadingArtwork && <span className="text-xs text-gray-500">Uploading…</span>}
                      {form.artworkUrl && !uploadingArtwork && (
                        <span className="text-xs text-emerald-700 truncate">✓ {form.artworkFileName || "uploaded"}</span>
                      )}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Or paste URL (OneDrive, Dropbox, etc.)">
                      <Input value={form.artworkUrl} onChange={(e) => update("artworkUrl", e.target.value)} placeholder="https://..." />
                    </Field>
                    <Field label="File Name">
                      <Input value={form.artworkFileName} onChange={(e) => update("artworkFileName", e.target.value)} placeholder="job-art.pdf" />
                    </Field>
                  </div>
                  <Field label="Artwork Notes">
                    <Input value={form.artworkNotes} onChange={(e) => update("artworkNotes", e.target.value)} placeholder="e.g. client sending revised file Mon" />
                  </Field>
                </Section>

                {/* 4. Paper & Size */}
                <Section title="Paper & Default Size" subtitle="Used when line items don't override" defaultOpen={true}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Paper Weight / Stock" required hint="Pick 'Unsure' if you don't know — Mary will confirm">
                      <Select value={form.paperWeight} onChange={(e) => update("paperWeight", e.target.value)} options={[
                        { value: "", label: "Select..." },
                        { value: "unsure", label: "Unsure — please advise" },
                        { value: "16pt C1S", label: "16pt C1S" },
                        { value: "16pt C2S", label: "16pt C2S" },
                        { value: "18pt C1S", label: "18pt C1S" },
                        { value: "18pt C2S", label: "18pt C2S" },
                        { value: "24pt C1S", label: "24pt C1S" },
                        { value: "24pt C2S", label: "24pt C2S" },
                        { value: "custom", label: "Custom (specify →)" },
                      ]} />
                    </Field>
                    <Field label={form.paperWeight === "custom" ? "Custom Paper Description *" : "Paper Description"}>
                      <Input value={form.paperDescription} onChange={(e) => update("paperDescription", e.target.value)}
                        placeholder={form.paperWeight === "custom" ? "e.g. 100# Cougar Natural Cover" : "e.g. FSC-certified"} />
                    </Field>
                  </div>
                  <Field label="Paper Type">
                    <Select value={form.paperType} onChange={(e) => update("paperType", e.target.value)} options={[
                      { value: "cover", label: "Cover" },
                      { value: "text", label: "Text" },
                      { value: "bond", label: "Bond" },
                      { value: "board", label: "Board" },
                    ]} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Default Flat Size (W x H)">
                      <div className="flex gap-1 items-center">
                        <Input type="number" step="0.0625" value={form.flatWidth} onChange={(e) => update("flatWidth", e.target.value)} placeholder="W" />
                        <span className="text-gray-400">x</span>
                        <Input type="number" step="0.0625" value={form.flatHeight} onChange={(e) => update("flatHeight", e.target.value)} placeholder="H" />
                      </div>
                    </Field>
                    <Field label="Default Finished Size (W x H x D)">
                      <div className="flex gap-1 items-center">
                        <Input type="number" step="0.0625" value={form.finishedWidth} onChange={(e) => update("finishedWidth", e.target.value)} placeholder="W" />
                        <span className="text-gray-400">x</span>
                        <Input type="number" step="0.0625" value={form.finishedHeight} onChange={(e) => update("finishedHeight", e.target.value)} placeholder="H" />
                        <span className="text-gray-400">x</span>
                        <Input type="number" step="0.0625" value={form.finishedDepth} onChange={(e) => update("finishedDepth", e.target.value)} placeholder="D" />
                      </div>
                    </Field>
                  </div>
                </Section>

                {/* 5. Colors & Coatings */}
                <Section title="Colors & Coatings" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Colors Side 1">
                      <Select value={form.colorsSide1} onChange={(e) => update("colorsSide1", e.target.value)} options={[
                        { value: "", label: "Select..." },
                        { value: "4_process", label: "4 Process (CMYK)" },
                        { value: "process_1pms", label: "Process + 1 PMS" },
                        { value: "process_2pms", label: "Process + 2 PMS" },
                        { value: "black", label: "Black Only" },
                        { value: "pms", label: "PMS Only" },
                      ]} />
                    </Field>
                    <Field label="Colors Side 2">
                      <Select value={form.colorsSide2} onChange={(e) => update("colorsSide2", e.target.value)} options={[
                        { value: "", label: "Select..." },
                        { value: "4_process", label: "4 Process (CMYK)" },
                        { value: "process_1pms", label: "Process + 1 PMS" },
                        { value: "process_2pms", label: "Process + 2 PMS" },
                        { value: "black", label: "Black Only" },
                        { value: "pms", label: "PMS Only" },
                        { value: "none", label: "None" },
                      ]} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Coating Side 1">
                      <Select value={form.coatingSide1} onChange={(e) => update("coatingSide1", e.target.value)} options={[
                        { value: "", label: "None" },
                        { value: "gloss_aq", label: "Gloss AQ" },
                        { value: "satin_aq", label: "Satin AQ" },
                        { value: "matte_aq", label: "Matte AQ" },
                        { value: "soft_touch_aq", label: "Soft Touch AQ" },
                      ]} />
                    </Field>
                    <Field label="Coating Side 2">
                      <Select value={form.coatingSide2} onChange={(e) => update("coatingSide2", e.target.value)} options={[
                        { value: "", label: "None" },
                        { value: "gloss_aq", label: "Gloss AQ" },
                        { value: "satin_aq", label: "Satin AQ" },
                        { value: "matte_aq", label: "Matte AQ" },
                        { value: "soft_touch_aq", label: "Soft Touch AQ" },
                      ]} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 border border-gray-200 rounded-lg p-2">
                      <div className="text-xs font-semibold text-gray-700">UV</div>
                      <Check label="Flood UV" checked={form.floodUv} onChange={(v) => update("floodUv", v)} />
                      <Check label="Spot UV" checked={form.spotUv} onChange={(v) => update("spotUv", v)} />
                      {(form.floodUv || form.spotUv) && (
                        <Select value={form.uvSides} onChange={(e) => update("uvSides", e.target.value)} options={[
                          { value: "", label: "Sides..." },
                          { value: "1_side", label: "1 Side" },
                          { value: "2_sides", label: "2 Sides" },
                        ]} />
                      )}
                    </div>
                    <div className="space-y-1 border border-gray-200 rounded-lg p-2">
                      <div className="text-xs font-semibold text-gray-700">LED UV</div>
                      <Check label="Flood LED UV" checked={form.floodLedUv} onChange={(v) => update("floodLedUv", v)} />
                      <Check label="Spot LED UV" checked={form.spotLedUv} onChange={(v) => update("spotLedUv", v)} />
                      {(form.floodLedUv || form.spotLedUv) && (
                        <Select value={form.ledUvSides} onChange={(e) => update("ledUvSides", e.target.value)} options={[
                          { value: "", label: "Sides..." },
                          { value: "1_side", label: "1 Side" },
                          { value: "2_sides", label: "2 Sides" },
                        ]} />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Check label="Aqueous" checked={form.aqueous} onChange={(v) => update("aqueous", v)} />
                    <Check label="Dry trap" checked={form.drytrap} onChange={(v) => update("drytrap", v)} />
                  </div>
                  <Field label="Custom Color / Coating Notes">
                    <Input value={form.customColorCoatingNotes} onChange={(e) => update("customColorCoatingNotes", e.target.value)}
                      placeholder="e.g. PMS 186 + touch plate red" />
                  </Field>
                </Section>

                {/* 6. Finishing / Bindery */}
                <Section title="Finishing / Folding / Die" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Fold Type">
                      <Select value={form.foldType} onChange={(e) => update("foldType", e.target.value)} options={[
                        { value: "", label: "None" },
                        { value: "half", label: "Half Fold" },
                        { value: "tri_fold", label: "Tri Fold" },
                        { value: "z_fold", label: "Z Fold" },
                        { value: "gate", label: "Gate Fold" },
                        { value: "double_parallel", label: "Double Parallel" },
                        { value: "accordion", label: "Accordion" },
                        { value: "french", label: "French Fold" },
                      ]} />
                    </Field>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 items-end pb-2">
                      <Check label="Score" checked={form.score} onChange={(v) => update("score", v)} />
                      <Check label="Perf" checked={form.perf} onChange={(v) => update("perf", v)} />
                      <Check label="Die Cut" checked={form.dieCut} onChange={(v) => update("dieCut", v)} />
                    </div>
                  </div>
                  {form.dieCut && (
                    <div className="grid grid-cols-3 gap-3 border-l-2 border-brand-200 pl-3">
                      <Field label="Existing Die #">
                        <Input value={form.existingDieNumber} onChange={(e) => update("existingDieNumber", e.target.value)} placeholder="Die #" />
                      </Field>
                      <Field label="# Pockets">
                        <Input type="number" value={form.numPockets} onChange={(e) => update("numPockets", e.target.value)} />
                      </Field>
                      <Field label="V/H Die Size">
                        <Input value={form.dieVHSize} onChange={(e) => update("dieVHSize", e.target.value)} placeholder="e.g. 28x40 V" />
                      </Field>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Foil (color/type)">
                      <div className="flex gap-1">
                        <Input value={form.foil} onChange={(e) => update("foil", e.target.value)} placeholder="e.g. gold" />
                        <Check label="New" checked={form.foilIsNew} onChange={(v) => update("foilIsNew", v)} />
                      </div>
                    </Field>
                    <Field label="Emboss/Deboss">
                      <div className="flex gap-1">
                        <Input value={form.emboss} onChange={(e) => update("emboss", e.target.value)} placeholder="e.g. blind emboss logo" />
                        <Check label="New" checked={form.embossIsNew} onChange={(v) => update("embossIsNew", v)} />
                      </div>
                    </Field>
                  </div>
                  <Field label="Lamination">
                    <Select value={form.lamination} onChange={(e) => update("lamination", e.target.value)} options={[
                      { value: "", label: "None" },
                      { value: "gloss", label: "Gloss" },
                      { value: "matte", label: "Matte" },
                      { value: "soft_touch", label: "Soft Touch" },
                    ]} />
                  </Field>
                </Section>

                {/* 7. Binding */}
                <Section title="Binding" defaultOpen={false}>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <Check label="Saddle Stitch" checked={form.saddleStitch} onChange={(v) => update("saddleStitch", v)} />
                    <Check label="Corner Stitch" checked={form.cornerStitch} onChange={(v) => update("cornerStitch", v)} />
                    <Check label="Perfect Bind" checked={form.perfectBind} onChange={(v) => update("perfectBind", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Plastic Coil">
                      <Input value={form.plasticCoil} onChange={(e) => update("plasticCoil", e.target.value)} placeholder="e.g. 1/2 black" />
                    </Field>
                    <Field label="Wire-O">
                      <Input value={form.wireO} onChange={(e) => update("wireO", e.target.value)} placeholder="e.g. 3:1 white" />
                    </Field>
                    <Field label="GBC">
                      <Input value={form.gbc} onChange={(e) => update("gbc", e.target.value)} />
                    </Field>
                    <Field label="Case Bind">
                      <Input value={form.caseBind} onChange={(e) => update("caseBind", e.target.value)} />
                    </Field>
                  </div>
                </Section>

                {/* 8. Bindery Add-ons */}
                <Section title="Bindery Add-ons" defaultOpen={false}>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <Check label="Drill" checked={form.drill} onChange={(v) => update("drill", v)} />
                    <Check label="NCR Pad" checked={form.ncrPad} onChange={(v) => update("ncrPad", v)} />
                    <Check label="Punch" checked={form.punch} onChange={(v) => update("punch", v)} />
                    <Check label="Round Corner" checked={form.roundCorner} onChange={(v) => update("roundCorner", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Band In"><Input value={form.bandIn} onChange={(e) => update("bandIn", e.target.value)} placeholder="qty per band" /></Field>
                    <Field label="Wrap In"><Input value={form.wrapIn} onChange={(e) => update("wrapIn", e.target.value)} placeholder="qty per wrap" /></Field>
                    <Field label="Pad In"><Input value={form.padIn} onChange={(e) => update("padIn", e.target.value)} placeholder="qty per pad" /></Field>
                    <Field label="Numbering"><Input value={form.numbering} onChange={(e) => update("numbering", e.target.value)} placeholder="start/format" /></Field>
                  </div>
                </Section>

                {/* 9. Mailing */}
                <Section title="Mailing Services" defaultOpen={false}>
                  <Field label="Mailing Services">
                    <Input value={form.mailingServices} onChange={(e) => update("mailingServices", e.target.value)} placeholder="e.g. inkjet, bulk mail, NCOA" />
                  </Field>
                  <Check label="Wafer Seal" checked={form.waferSeal} onChange={(v) => update("waferSeal", v)} />
                  {form.waferSeal && (
                    <div className="grid grid-cols-2 gap-3 border-l-2 border-brand-200 pl-3">
                      <Field label="# of Tabs"><Input type="number" value={form.waferSealTabs} onChange={(e) => update("waferSealTabs", e.target.value)} /></Field>
                      <Field label="Location"><Input value={form.waferSealLocation} onChange={(e) => update("waferSealLocation", e.target.value)} placeholder="top / bottom / sides" /></Field>
                    </div>
                  )}
                </Section>

                {/* 10. Delivery + Notes */}
                <Section title="Delivery & Notes" defaultOpen={false}>
                  <Field label="Vendor Name (if outside)">
                    <Input value={form.vendorName} onChange={(e) => update("vendorName", e.target.value)} placeholder="vendor if outside job" />
                  </Field>
                  <Field label="Delivery Instructions">
                    <Input value={form.deliveryInstructions} onChange={(e) => update("deliveryInstructions", e.target.value)} placeholder="Delivery details..." />
                  </Field>
                  <Field label="Special Instructions">
                    <Input value={form.specialInstructions} onChange={(e) => update("specialInstructions", e.target.value)} placeholder="Any special notes for the estimator..." />
                  </Field>
                </Section>

                <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-2 border-t border-gray-100">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}</Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
