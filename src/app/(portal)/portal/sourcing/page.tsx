"use client";

import { useState, useEffect } from "react";
import { Loader2, Upload, Check, FileText, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface SourcingRequest {
  id: string;
  quoteNumber: string;
  productName: string;
  description: string | null;
  quantity: number;
  sourcingStatus: string | null;
  vendorLandedCost: number | null;
  vendorQuoteFileUrl: string | null;
  vendorQuoteFileName: string | null;
  vendorQuoteNotes: string | null;
  specs: string | null;
  createdAt: string;
}

// Vendor portal (Benjy 6/16) — MWI/Martin sees sourcing requests assigned to
// their vendor, uploads a landed-cost quote against each specific request.
export default function VendorSourcingPage() {
  const [reqs, setReqs] = useState<SourcingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((d) => setReqs(d.quotes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sourcing Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Upload your landed-cost quote (shipped to St. Pete) for each request from C&amp;D Printing.</p>
      </div>

      {reqs.length === 0 && (
        <Card><CardContent className="py-12 text-center text-gray-500">
          <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          No open sourcing requests right now.
        </CardContent></Card>
      )}

      <div className="space-y-4">
        {reqs.map((r) => <RequestCard key={r.id} req={r} onSaved={load} />)}
      </div>
    </div>
  );
}

function RequestCard({ req, onSaved }: { req: SourcingRequest; onSaved: () => void }) {
  const [cost, setCost] = useState(req.vendorLandedCost ? String(req.vendorLandedCost) : "");
  const [notes, setNotes] = useState(req.vendorQuoteNotes || "");
  const [fileUrl, setFileUrl] = useState(req.vendorQuoteFileUrl || "");
  const [fileName, setFileName] = useState(req.vendorQuoteFileName || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  let specs: any = {};
  try { specs = req.specs ? JSON.parse(req.specs) : {}; } catch {}
  const dims = specs.dimensions || (specs.estimateData ? `${specs.estimateData.finishedWidth}×${specs.estimateData.finishedHeight}` : "");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) { setError(d.message || d.error || "Upload failed"); return; }
      setFileUrl(d.url); setFileName(d.fileName);
    } catch { setError("Upload failed — try again"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.id, vendorUpload: true,
          vendorLandedCost: cost, vendorQuoteFileUrl: fileUrl,
          vendorQuoteFileName: fileName, vendorQuoteNotes: notes,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
      onSaved();
    } catch { setError("Save failed — try again"); }
    finally { setSaving(false); }
  };

  const submitted = req.sourcingStatus === "quoted" || req.sourcingStatus === "priced";

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{req.productName}</span>
              <Badge className="bg-gray-100 text-gray-600">{req.quoteNumber}</Badge>
              {submitted && <Badge className="bg-emerald-100 text-emerald-700"><Check className="h-3 w-3 mr-1" />Quote submitted</Badge>}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Qty {req.quantity.toLocaleString()}{dims ? ` · ${dims}` : ""}{req.description ? ` · ${req.description}` : ""}
            </p>
          </div>
          <span className="text-xs text-gray-400">{formatDate(req.createdAt)}</span>
        </div>

        {/* Artwork from C&D (if attached in specs) */}
        {specs.artworkUrl && (
          <a href={specs.artworkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mb-3">
            <FileText className="h-4 w-4" /> Download artwork from C&D
          </a>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Landed cost ($, to St. Pete)</label>
            <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 4250.00" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (lead time, MOQ, etc.)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 3 wk lead, min 5,000, FOB St. Pete" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-brand-600 hover:text-brand-800">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : fileName ? "Replace quote file" : "Attach quote file (PDF)"}
            <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          {fileName && <span className="text-xs text-gray-500 inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{fileName}</span>}
          <div className="flex-1" />
          <Button onClick={save} disabled={saving || uploading || (!cost && !fileUrl)}>
            {saving ? "Saving…" : submitted ? "Update quote" : "Submit quote to C&D"}
          </Button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
