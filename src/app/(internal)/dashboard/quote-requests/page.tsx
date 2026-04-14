"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, X, Loader2, Search, Clock, Check, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  estimating: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-400",
};

interface Company { id: string; name: string; }
interface Vendor { id: string; name: string; }

export default function QuoteRequestsPage() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [userRole, setUserRole] = useState("");

  const [form, setForm] = useState({
    dateNeeded: "", jobType: "new", pickupJobNumber: "", customerName: "", productType: "komori",
    descriptionType: "", jobTitle: "",
    quantity1: "", quantity2: "", quantity3: "", quantity4: "", quantity5: "",
    pages: "", coverType: "self_cover",
    colorsSide1: "", colorsSide2: "", coatingSide1: "", coatingSide2: "",
    flatWidth: "", flatHeight: "", finishedWidth: "", finishedHeight: "", finishedDepth: "",
    paperWeight: "", paperDescription: "", paperType: "cover",
    finishing: "", specialInstructions: "", vendorName: "", deliveryInstructions: "",
  });
  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    fetch("/api/quote-requests").then(r => r.json()).then(d => setRequests(d.requests || [])).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/companies").then(r => r.json()).then(d => setCompanies(d.companies || [])).catch(() => {});
    fetch("/api/companies?type=vendor").then(r => r.json()).then(d => setVendors(d.companies || [])).catch(() => {});
    fetch("/api/auth/session").then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role); }).catch(() => {});
  }, []);

  const isEstimator = ["OWNER", "GM", "ADMIN", "ESTIMATOR", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"].includes(userRole);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName) { setError("Customer name required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setRequests(prev => [data.request, ...prev]); setShowModal(false); }
      else setError(data.error || "Failed");
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  const pending = requests.filter(r => r.status === "pending").length;
  const estimating = requests.filter(r => r.status === "estimating").length;

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
        <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />New Request</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{pending}</p><p className="text-xs text-gray-500">Pending</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{estimating}</p><p className="text-xs text-gray-500">Being Estimated</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{requests.length}</p><p className="text-xs text-gray-500">Total Requests</p></Card>
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {requests.map((req) => (
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
                    {req.quantity1 && <span className="mr-3">Qty: {req.quantity1.toLocaleString()}</span>}
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
        {requests.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No quote requests yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "New Request" to submit specs for estimating</p>
          </Card>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">New Quote Request</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

                {/* Row 1: Job Type + Date + Pickup */}
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Job Type</label>
                    <Select value={form.jobType} onChange={(e) => update("jobType", e.target.value)} options={[
                      { value: "new", label: "New Job" },
                      { value: "exact_reprint", label: "Exact Reprint" },
                      { value: "reprint_with_changes", label: "Reprint w/ Changes" },
                    ]} />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Date Needed</label>
                    <Input type="date" value={form.dateNeeded} onChange={(e) => update("dateNeeded", e.target.value)} />
                  </div>
                  {form.jobType !== "new" && (
                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Pickup Job #</label>
                      <Input value={form.pickupJobNumber} onChange={(e) => update("pickupJobNumber", e.target.value)} placeholder="Previous job #" />
                    </div>
                  )}
                </div>

                {/* Row 2: Customer + Product Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Customer *</label>
                    <Combobox value={form.customerName} onChange={(_id, label) => update("customerName", label)}
                      options={companies.map(c => ({ id: c.id, label: c.name }))} placeholder="Select customer..." allowCreate />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Product Type</label>
                    <Select value={form.productType} onChange={(e) => update("productType", e.target.value)} options={[
                      { value: "komori", label: "Komori (Offset)" },
                      { value: "digital", label: "Digital" },
                      { value: "letterpress", label: "Letterpress" },
                      { value: "bindery", label: "Bindery Only" },
                      { value: "vendor", label: "Outside Vendor" },
                    ]} />
                  </div>
                </div>

                {/* Row 3: Description + Job Title */}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <Select value={form.descriptionType} onChange={(e) => update("descriptionType", e.target.value)} options={[
                      { value: "", label: "Select type..." },
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
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
                    <Input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} placeholder="Job name / description" />
                  </div>
                </div>

                {/* Row 4: Quantities */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantities (up to 5 tiers)</label>
                  <div className="grid grid-cols-5 gap-2">
                    <Input type="number" value={form.quantity1} onChange={(e) => update("quantity1", e.target.value)} placeholder="Qty 1" />
                    <Input type="number" value={form.quantity2} onChange={(e) => update("quantity2", e.target.value)} placeholder="Qty 2" />
                    <Input type="number" value={form.quantity3} onChange={(e) => update("quantity3", e.target.value)} placeholder="Qty 3" />
                    <Input type="number" value={form.quantity4} onChange={(e) => update("quantity4", e.target.value)} placeholder="Qty 4" />
                    <Input type="number" value={form.quantity5} onChange={(e) => update("quantity5", e.target.value)} placeholder="Qty 5" />
                  </div>
                </div>

                {/* Row 5: Pages + Cover */}
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Pages</label>
                    <Input type="number" value={form.pages} onChange={(e) => update("pages", e.target.value)} placeholder="e.g. 28" />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Cover Type</label>
                    <Select value={form.coverType} onChange={(e) => update("coverType", e.target.value)} options={[
                      { value: "self_cover", label: "Self Cover" },
                      { value: "plus_cover", label: "Plus Cover" },
                    ]} />
                  </div>
                </div>

                {/* Row 6: Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Colors Side 1</label>
                    <Select value={form.colorsSide1} onChange={(e) => update("colorsSide1", e.target.value)} options={[
                      { value: "", label: "Select..." },
                      { value: "4_process", label: "4 Process (CMYK)" },
                      { value: "process_1pms", label: "Process + 1 PMS" },
                      { value: "process_2pms", label: "Process + 2 PMS" },
                      { value: "black", label: "Black Only" },
                      { value: "pms", label: "PMS Only" },
                    ]} />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Colors Side 2</label>
                    <Select value={form.colorsSide2} onChange={(e) => update("colorsSide2", e.target.value)} options={[
                      { value: "", label: "Select..." },
                      { value: "4_process", label: "4 Process (CMYK)" },
                      { value: "process_1pms", label: "Process + 1 PMS" },
                      { value: "process_2pms", label: "Process + 2 PMS" },
                      { value: "black", label: "Black Only" },
                      { value: "pms", label: "PMS Only" },
                      { value: "none", label: "None" },
                    ]} />
                  </div>
                </div>

                {/* Row 7: Coatings */}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Coating Side 1</label>
                    <Select value={form.coatingSide1} onChange={(e) => update("coatingSide1", e.target.value)} options={[
                      { value: "", label: "None" },
                      { value: "gloss_aq", label: "Gloss AQ" },
                      { value: "satin_aq", label: "Satin AQ" },
                      { value: "matte_aq", label: "Matte AQ" },
                      { value: "soft_touch_aq", label: "Soft Touch AQ" },
                      { value: "flood_led_uv", label: "Flood LED UV" },
                      { value: "spot_led_uv", label: "Spot LED UV" },
                    ]} />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Coating Side 2</label>
                    <Select value={form.coatingSide2} onChange={(e) => update("coatingSide2", e.target.value)} options={[
                      { value: "", label: "None" },
                      { value: "gloss_aq", label: "Gloss AQ" },
                      { value: "satin_aq", label: "Satin AQ" },
                      { value: "matte_aq", label: "Matte AQ" },
                      { value: "soft_touch_aq", label: "Soft Touch AQ" },
                      { value: "flood_led_uv", label: "Flood LED UV" },
                      { value: "spot_led_uv", label: "Spot LED UV" },
                    ]} />
                  </div>
                </div>

                {/* Row 8: Sizes */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Flat Size</label>
                    <div className="flex gap-2 items-center">
                      <Input type="number" step="0.0625" value={form.flatWidth} onChange={(e) => update("flatWidth", e.target.value)} placeholder="W" />
                      <span className="text-gray-400">x</span>
                      <Input type="number" step="0.0625" value={form.flatHeight} onChange={(e) => update("flatHeight", e.target.value)} placeholder="H" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Finished Size</label>
                    <div className="flex gap-2 items-center">
                      <Input type="number" step="0.0625" value={form.finishedWidth} onChange={(e) => update("finishedWidth", e.target.value)} placeholder="W" />
                      <span className="text-gray-400">x</span>
                      <Input type="number" step="0.0625" value={form.finishedHeight} onChange={(e) => update("finishedHeight", e.target.value)} placeholder="H" />
                      <span className="text-gray-400">x</span>
                      <Input type="number" step="0.0625" value={form.finishedDepth} onChange={(e) => update("finishedDepth", e.target.value)} placeholder="D" />
                    </div>
                  </div>
                </div>

                {/* Row 9: Paper */}
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Paper Weight</label>
                    <Input value={form.paperWeight} onChange={(e) => update("paperWeight", e.target.value)} placeholder="e.g. 18pt, 100lb" />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Paper Description</label>
                    <Input value={form.paperDescription} onChange={(e) => update("paperDescription", e.target.value)} placeholder="e.g. C1S SBS" />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Paper Type</label>
                    <Select value={form.paperType} onChange={(e) => update("paperType", e.target.value)} options={[
                      { value: "cover", label: "Cover" },
                      { value: "text", label: "Text" },
                      { value: "board", label: "Board" },
                    ]} />
                  </div>
                </div>

                {/* Row 10: Finishing */}
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Finishing Operations</label>
                  <Input value={form.finishing} onChange={(e) => update("finishing", e.target.value)} placeholder="e.g. Score, Perf, Fold, Die Cut, Glue, Stitch" />
                </div>

                {/* Row 11: Special Instructions */}
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Special Bindery Instructions</label>
                  <Input value={form.specialInstructions} onChange={(e) => update("specialInstructions", e.target.value)} placeholder="Any special notes..." />
                </div>

                {/* Row 12: Vendor + Delivery */}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor</label>
                    <Select value={form.vendorName} onChange={(e) => update("vendorName", e.target.value)} options={[{ value: "", label: "Select vendor..." }, ...vendors.map(v => ({ value: v.name, label: v.name }))]} />
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Delivery Instructions</label>
                    <Input value={form.deliveryInstructions} onChange={(e) => update("deliveryInstructions", e.target.value)} placeholder="Delivery details..." />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
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
