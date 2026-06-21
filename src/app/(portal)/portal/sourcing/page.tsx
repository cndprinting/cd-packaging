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
  sourcingArtworkUrl: string | null;
  sourcingArtworkName: string | null;
  sourcingItems: string | null;
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

type Line = { id: string; sku: string; quantity: number; artworkUrl?: string; artworkName?: string; landedCost?: number; unitCost?: number; leadTime?: string; moq?: number; fileUrl?: string; fileName?: string; vendorNotes?: string };

function RequestCard({ req, onSaved }: { req: SourcingRequest; onSaved: () => void }) {
  const initialLines: Line[] = (() => {
    try { const p = req.sourcingItems ? JSON.parse(req.sourcingItems) : []; if (Array.isArray(p) && p.length) return p; } catch {}
    // Legacy single-item request → one synthetic line.
    return [{ id: "legacy", sku: req.productName, quantity: req.quantity, artworkUrl: req.sourcingArtworkUrl || undefined, artworkName: req.sourcingArtworkName || undefined, landedCost: req.vendorLandedCost || undefined, vendorNotes: req.vendorQuoteNotes || undefined }];
  })();
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [uploadRow, setUploadRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateLine = (id: string, patch: Partial<Line>) => setLines((p) => p.map((l) => l.id === id ? { ...l, ...patch } : l));
  // Total landed for a line = per-unit × qty (vendor enters per-unit, Benjy 6/16).
  const lineTotal = (l: Line) => (Number(l.unitCost) || 0) * (Number(l.quantity) || 0);

  const handleLineFile = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadRow(id); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) { setError(d.message || d.error || "Upload failed"); return; }
      updateLine(id, { fileUrl: d.url, fileName: d.fileName });
    } catch { setError("Upload failed — try again"); }
    finally { setUploadRow(null); }
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.id, vendorUpload: true,
          // Send the FULL line objects (incl. sku/qty/artwork the portal
          // loaded) so the server can upsert even if C&D's stored items were
          // empty or ids don't line up (Benjy 6/20 — was dropping costs).
          items: lines.map((l) => ({ ...l, landedCost: lineTotal(l) })),
          vendorLandedCost: lines.reduce((s, l) => s + lineTotal(l), 0),
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
            <p className="text-sm text-gray-500 mt-0.5">{req.description || `${lines.length} item${lines.length !== 1 ? "s" : ""} to quote`}</p>
          </div>
          <span className="text-xs text-gray-400">{formatDate(req.createdAt)}</span>
        </div>

        {/* Per-SKU rows: download artwork, enter per-unit price, lead time,
            MOQ, attach a quote/spec file, and notes. (Benjy 6/16) */}
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.id} className="rounded-md border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">{l.sku || "Item"}{l.quantity ? ` · qty ${l.quantity.toLocaleString()}` : ""}</span>
                {l.artworkUrl && (
                  <a href={l.artworkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                    <FileText className="h-4 w-4" /> Artwork{l.artworkName ? ` (${l.artworkName})` : ""}
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Price per unit ($)</label>
                  <Input type="number" step="0.0001" value={l.unitCost ?? ""} onChange={(e) => updateLine(l.id, { unitCost: Number(e.target.value) })} placeholder="e.g. 1.85" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Total (auto)</label>
                  <div className="h-9 flex items-center px-2 text-sm font-semibold text-gray-700">${lineTotal(l).toFixed(2)}</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Lead time</label>
                  <Input value={l.leadTime || ""} onChange={(e) => updateLine(l.id, { leadTime: e.target.value })} placeholder="e.g. 3 weeks" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">MOQ</label>
                  <Input type="number" value={l.moq ?? ""} onChange={(e) => updateLine(l.id, { moq: Number(e.target.value) })} placeholder="e.g. 5000" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
                <textarea rows={2} value={l.vendorNotes || ""} onChange={(e) => updateLine(l.id, { vendorNotes: e.target.value })} placeholder="Anything else C&D should know — terms, substitutions, FOB point, etc." className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-brand-600 hover:text-brand-800">
                  <Upload className="h-4 w-4" />
                  {uploadRow === l.id ? "Uploading…" : l.fileName ? "Replace quote file" : "Attach quote file (PDF or Excel)"}
                  <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => handleLineFile(l.id, e)} disabled={uploadRow === l.id} />
                </label>
                {l.fileName && <a href={l.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:underline inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{l.fileName}</a>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex-1" />
          <Button onClick={save} disabled={saving || !!uploadRow || !lines.some((l) => lineTotal(l) > 0)}>
            {saving ? "Saving…" : submitted ? "Update quote" : "Submit quote to C&D"}
          </Button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
