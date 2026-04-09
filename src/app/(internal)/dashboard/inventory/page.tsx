"use client";

import { useState, useEffect, useMemo } from "react";
import { Warehouse, Plus, X, Loader2, AlertTriangle, Search, Scissors, ArrowDownUp, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Vendor { id: string; name: string; }
interface Material { id: string; name: string; sku?: string | null; category?: string | null; unit: string; onHand: number; allocated: number; reorderPoint: number; vendor?: string | null; }
interface Die { id: string; dieNumber: string; customerName: string | null; item: string | null; description: string | null; length: number | null; width: number | null; notes: string | null; }

interface PaperUsageRecord { id: string; itemNumber: string | null; jobNumber: string | null; wipStatus: string | null; date: string | null; source: string | null; direction: string | null; quantityOut: number; weight: string | null; size: string | null; description: string | null; pricePerM: number | null; totalOut: number | null; }
interface VendorPurchaseRecord { id: string; jobNumber: string | null; date: string | null; vendor: string | null; quantity: number; weight: string | null; size: string | null; description: string | null; pricePerM: number | null; total: number | null; quotedPricePerM: number | null; savings: number | null; }

export default function InventoryPage() {
  const [tab, setTab] = useState<"materials" | "dies" | "usage" | "purchases">("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [dies, setDies] = useState<Die[]>([]);
  const [dieTotal, setDieTotal] = useState(0);
  const [paperUsage, setPaperUsage] = useState<PaperUsageRecord[]>([]);
  const [usageTotal, setUsageTotal] = useState(0);
  const [usageSearch, setUsageSearch] = useState("");
  const [purchases, setPurchases] = useState<VendorPurchaseRecord[]>([]);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseVendors, setPurchaseVendors] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", category: "board", unit: "sheets", vendor: "", weight: "", coating: "", size: "", pricePerM: "", initialQty: "" });
  const update = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));
  const [showDieModal, setShowDieModal] = useState(false);
  const [creatingDie, setCreatingDie] = useState(false);
  const [dieError, setDieError] = useState("");
  const [dieForm, setDieForm] = useState({ dieNumber: "", customerName: "", item: "", description: "", length: "", width: "", height: "", notes: "" });
  const updateDie = (f: string, v: string) => setDieForm((p) => ({ ...p, [f]: v }));
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [dieSearch, setDieSearch] = useState("");

  useEffect(() => {
    fetch("/api/materials").then(r => r.json()).then(d => { if (d.materials?.length) setMaterials(d.materials); }).catch(() => {});
    fetch("/api/companies?type=vendor").then(r => r.json()).then(d => setVendors(d.companies || [])).catch(() => {});
    fetch("/api/dies").then(r => r.json()).then(d => { setDies(d.dies || []); setDieTotal(d.total || 0); }).catch(() => {});
    fetch("/api/paper-usage").then(r => r.json()).then(d => { setPaperUsage(d.records || []); setUsageTotal(d.total || 0); }).catch(() => {});
    fetch("/api/vendor-purchases").then(r => r.json()).then(d => { setPurchases(d.records || []); setPurchaseTotal(d.total || 0); setPurchaseVendors(d.vendors || []); }).catch(() => {});
  }, []);

  const searchDies = async (q: string) => {
    setDieSearch(q);
    if (q.length < 2) {
      fetch("/api/dies").then(r => r.json()).then(d => { setDies(d.dies || []); setDieTotal(d.total || 0); }).catch(() => {});
      return;
    }
    fetch(`/api/dies?search=${encodeURIComponent(q)}`).then(r => r.json()).then(d => { setDies(d.dies || []); setDieTotal(d.total || 0); }).catch(() => {});
  };

  const shortages = materials.filter((m) => m.onHand < m.allocated);
  const lowStock = materials.filter((m) => m.onHand < m.reorderPoint && m.onHand >= m.allocated);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name) { setError("Name required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); setCreating(false); return; }
      const qty = parseInt(form.initialQty) || 0;
      setMaterials((p) => [...p, { ...data.material, onHand: qty, allocated: 0, reorderPoint: Math.max(Math.round(qty * 0.2), 50) }]);
      setShowModal(false);
      setForm({ name: "", sku: "", category: "board", unit: "sheets", vendor: "", weight: "", coating: "", size: "", pricePerM: "", initialQty: "" });
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500">{materials.length} materials, {dieTotal} cutting dies</p>
          </div>
        </div>
        {tab === "materials" && (
          <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />Add Material</Button>
        )}
        {tab === "dies" && (
          <Button onClick={() => setShowDieModal(true)} className="gap-2"><Plus className="h-4 w-4" />Add Die</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("materials")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "materials" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          <Warehouse className="h-4 w-4 inline mr-2" />Materials ({materials.length})
        </button>
        <button
          onClick={() => setTab("dies")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "dies" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          <Scissors className="h-4 w-4 inline mr-2" />Cutting Dies ({dieTotal})
        </button>
        <button
          onClick={() => setTab("usage")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "usage" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          <ArrowDownUp className="h-4 w-4 inline mr-2" />Paper Usage ({usageTotal})
        </button>
        <button
          onClick={() => setTab("purchases")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "purchases" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          <ShoppingCart className="h-4 w-4 inline mr-2" />Purchases ({purchaseTotal})
        </button>
      </div>

      {/* Materials Tab */}
      {tab === "materials" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{materials.length}</p><p className="text-xs text-gray-500">Total Materials</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{shortages.length}</p><p className="text-xs text-gray-500">Shortages</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{lowStock.length}</p><p className="text-xs text-gray-500">Low Stock</p></Card>
          </div>

          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search materials..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </Card>

          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Vendor</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead className="text-right">On Hand</TableHead><TableHead className="text-right">Allocated</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Reorder Pt</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {materials.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.vendor || "").toLowerCase().includes(search.toLowerCase()) || (m.sku || "").toLowerCase().includes(search.toLowerCase())).map((m) => {
                  const available = m.onHand - m.allocated;
                  const isShort = m.onHand < m.allocated;
                  const isLow = !isShort && m.onHand < m.reorderPoint;
                  return (
                    <TableRow key={m.id} className={`hover:bg-gray-50 transition-colors ${isShort ? "bg-red-50 hover:bg-red-100" : isLow ? "bg-amber-50 hover:bg-amber-100" : ""}`}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">{m.vendor || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{m.sku || "—"}</TableCell>
                      <TableCell><Badge className="bg-gray-100 text-gray-600">{m.category || "—"}</Badge></TableCell>
                      <TableCell className="text-right">{m.onHand.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{m.allocated.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-medium ${available < 0 ? "text-red-600" : "text-gray-900"}`}>{available.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{m.reorderPoint.toLocaleString()}</TableCell>
                      <TableCell>
                        {isShort ? <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Shortage</Badge>
                        : isLow ? <Badge className="bg-amber-100 text-amber-700">Low</Badge>
                        : <Badge variant="success">In Stock</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {materials.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400">
                    <Warehouse className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No materials yet</p>
                    <p className="text-xs mt-1">Click "Add Material" or wait for Darrin's inventory import</p>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Cutting Dies Tab */}
      {tab === "dies" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{dieTotal}</p><p className="text-xs text-gray-500">Total Dies</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold text-brand-600">{new Set(dies.map(d => d.customerName).filter(Boolean)).size}</p><p className="text-xs text-gray-500">Customers with Dies</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{dies.filter(d => d.notes?.includes("up")).length}</p><p className="text-xs text-gray-500">Multi-Up Dies</p></Card>
          </div>

          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by die number, customer, item..."
                value={dieSearch}
                onChange={(e) => searchDies(e.target.value)}
                className="pl-9"
              />
            </div>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Die #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Original Job</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dies.map((die) => (
                  <TableRow key={die.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono font-medium text-brand-600">{die.dieNumber}</TableCell>
                    <TableCell className="font-medium">{die.customerName || "—"}</TableCell>
                    <TableCell>{die.item || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{die.description || "—"}</TableCell>
                    <TableCell className="text-sm">{die.length && die.width ? `${die.length} x ${die.width}` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{(die as any).originalJobNumber || "—"}</TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">{die.notes || "—"}</TableCell>
                  </TableRow>
                ))}
                {dies.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-400">
                    <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>{dieSearch ? `No dies matching "${dieSearch}"` : "No cutting dies found"}</p>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {dieTotal > 100 && dies.length === 100 && (
              <p className="text-xs text-gray-400 text-center py-3">Showing first 100 of {dieTotal} dies — use search to find specific dies</p>
            )}
          </Card>
        </>
      )}

      {/* Paper Usage Tab */}
      {tab === "usage" && (
        <>
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by job number or description..."
                value={usageSearch}
                onChange={(e) => {
                  setUsageSearch(e.target.value);
                  const q = e.target.value;
                  if (q.length >= 2) fetch(`/api/paper-usage?search=${encodeURIComponent(q)}`).then(r => r.json()).then(d => { setPaperUsage(d.records || []); setUsageTotal(d.total || 0); }).catch(() => {});
                  else fetch("/api/paper-usage").then(r => r.json()).then(d => { setPaperUsage(d.records || []); setUsageTotal(d.total || 0); }).catch(() => {});
                }}
                className="pl-9"
              />
            </div>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Qty Out</TableHead>
                  <TableHead className="text-right">$/M</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paperUsage.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-xs">{r.jobNumber || "—"}</TableCell>
                    <TableCell className="text-xs">{r.itemNumber || "—"}</TableCell>
                    <TableCell className="text-sm">{r.description || "—"}</TableCell>
                    <TableCell className="text-xs">{r.weight || "—"}</TableCell>
                    <TableCell className="text-xs">{r.size || "—"}</TableCell>
                    <TableCell><Badge className={r.direction === "OUT" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{r.direction || "—"}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{r.quantityOut > 0 ? r.quantityOut.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{r.pricePerM ? `$${r.pricePerM.toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{r.totalOut ? `$${r.totalOut.toFixed(2)}` : "—"}</TableCell>
                    <TableCell><Badge className="bg-gray-100 text-gray-600 text-xs">{r.wipStatus || "—"}</Badge></TableCell>
                  </TableRow>
                ))}
                {paperUsage.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-gray-400">No paper usage records found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {usageTotal > 100 && <p className="text-xs text-gray-400 text-center py-3">Showing first 100 of {usageTotal} records — use search to filter</p>}
          </Card>
        </>
      )}

      {/* Vendor Purchases Tab */}
      {tab === "purchases" && (
        <>
          <Card className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search purchases..."
                  value={purchaseSearch}
                  onChange={(e) => {
                    setPurchaseSearch(e.target.value);
                    const q = e.target.value;
                    const vf = vendorFilter ? `&vendor=${encodeURIComponent(vendorFilter)}` : "";
                    if (q.length >= 2) fetch(`/api/vendor-purchases?search=${encodeURIComponent(q)}${vf}`).then(r => r.json()).then(d => { setPurchases(d.records || []); setPurchaseTotal(d.total || 0); }).catch(() => {});
                    else fetch(`/api/vendor-purchases${vf ? `?${vf.slice(1)}` : ""}`).then(r => r.json()).then(d => { setPurchases(d.records || []); setPurchaseTotal(d.total || 0); }).catch(() => {});
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={vendorFilter}
                onChange={(e) => {
                  setVendorFilter(e.target.value);
                  const v = e.target.value;
                  const url = v ? `/api/vendor-purchases?vendor=${encodeURIComponent(v)}` : "/api/vendor-purchases";
                  fetch(url).then(r => r.json()).then(d => { setPurchases(d.records || []); setPurchaseTotal(d.total || 0); }).catch(() => {});
                }}
                options={[{ value: "", label: "All Vendors" }, ...purchaseVendors.map(v => ({ value: v, label: v }))]}
                className="w-44"
              />
            </div>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">$/M</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-xs">{r.jobNumber || "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{r.vendor || "—"}</TableCell>
                    <TableCell className="text-sm">{r.description || "—"}</TableCell>
                    <TableCell className="text-xs">{r.weight || "—"}</TableCell>
                    <TableCell className="text-xs">{r.size || "—"}</TableCell>
                    <TableCell className="text-right">{r.quantity > 0 ? r.quantity.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{r.pricePerM ? `$${r.pricePerM.toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{r.total ? `$${r.total.toFixed(2)}` : "—"}</TableCell>
                    <TableCell className={`text-right font-medium ${(r.savings || 0) > 0 ? "text-emerald-600" : ""}`}>{r.savings ? `$${r.savings.toFixed(2)}` : "—"}</TableCell>
                    <TableCell><Badge className="bg-gray-100 text-gray-600 text-xs">{(r as any).wipStatus || "—"}</Badge></TableCell>
                  </TableRow>
                ))}
                {purchases.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-gray-400">No purchase records found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {purchaseTotal > 100 && <p className="text-xs text-gray-400 text-center py-3">Showing first 100 of {purchaseTotal} records — use search or vendor filter</p>}
          </Card>
        </>
      )}

      {/* Add Material Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Add Material</h2><button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Stallion C/2/S White" autoFocus />
                  {form.name.length >= 3 && materials.some(m => m.name.toLowerCase().includes(form.name.toLowerCase())) && (
                    <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <p className="text-xs font-medium text-amber-800">Possible duplicate:</p>
                      {materials.filter(m => m.name.toLowerCase().includes(form.name.toLowerCase())).slice(0, 3).map(m => (
                        <p key={m.id} className="text-xs text-amber-700">{m.name} ({m.sku || "no SKU"})</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Weight</label><Input value={form.weight} onChange={(e) => update("weight", e.target.value)} placeholder="e.g. 18pt, 100lb" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Coating</label><Select value={form.coating} onChange={(e) => update("coating", e.target.value)} options={[{ value: "", label: "Select..." }, { value: "C/1/S", label: "C/1/S" }, { value: "C/2/S", label: "C/2/S" }, { value: "Dull", label: "Dull" }, { value: "Gloss", label: "Gloss" }, { value: "Matte", label: "Matte" }, { value: "Uncoated", label: "Uncoated" }]} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><Select value={form.category} onChange={(e) => update("category", e.target.value)} options={[{ value: "board", label: "Board" }, { value: "cover", label: "Cover" }, { value: "text", label: "Text" }, { value: "substrate", label: "Other Substrate" }, { value: "ink", label: "Ink" }, { value: "coating", label: "Coating" }, { value: "adhesive", label: "Adhesive" }]} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Size</label><Input value={form.size} onChange={(e) => update("size", e.target.value)} placeholder="e.g. 20 x 26" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">SKU / Item #</label><Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="e.g. INV-374" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Price per M ($)</label><Input type="number" step="0.01" value={form.pricePerM} onChange={(e) => update("pricePerM", e.target.value)} placeholder="e.g. 212.00" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Initial Qty</label><Input type="number" value={form.initialQty} onChange={(e) => update("initialQty", e.target.value)} placeholder="On hand" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit</label><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="sheets" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label><Select value={form.vendor} onChange={(e) => update("vendor", e.target.value)} options={[{ value: "", label: "Select vendor..." }, ...vendors.map(v => ({ value: v.name, label: v.name }))]} /></div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Material"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Add Die Modal */}
      {showDieModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowDieModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Add Cutting Die</h2><button onClick={() => setShowDieModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setDieError("");
                if (!dieForm.dieNumber) { setDieError("Die number required"); return; }
                setCreatingDie(true);
                try {
                  const res = await fetch("/api/dies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dieForm) });
                  const data = await res.json();
                  if (res.ok) {
                    setDies(prev => [data.die, ...prev]);
                    setDieTotal(prev => prev + 1);
                    setShowDieModal(false);
                    setDieForm({ dieNumber: "", customerName: "", item: "", description: "", length: "", width: "", height: "", notes: "" });
                  } else setDieError(data.error || "Failed");
                } catch { setDieError("Something went wrong"); }
                setCreatingDie(false);
              }} className="space-y-4">
                {dieError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{dieError}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Die Number *</label><Input value={dieForm.dieNumber} onChange={(e) => updateDie("dieNumber", e.target.value)} placeholder="e.g. RA-637" autoFocus /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer</label><Input value={dieForm.customerName} onChange={(e) => updateDie("customerName", e.target.value)} placeholder="Customer name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Item</label><Input value={dieForm.item} onChange={(e) => updateDie("item", e.target.value)} placeholder="e.g. Tuck box" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><Input value={dieForm.description} onChange={(e) => updateDie("description", e.target.value)} placeholder="Details" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Length</label><Input type="number" step="0.25" value={dieForm.length} onChange={(e) => updateDie("length", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Width</label><Input type="number" step="0.25" value={dieForm.width} onChange={(e) => updateDie("width", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Height</label><Input type="number" step="0.25" value={dieForm.height} onChange={(e) => updateDie("height", e.target.value)} /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><Input value={dieForm.notes} onChange={(e) => updateDie("notes", e.target.value)} placeholder="e.g. 4up, returned to customer" /></div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowDieModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creatingDie}>{creatingDie ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Die"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
