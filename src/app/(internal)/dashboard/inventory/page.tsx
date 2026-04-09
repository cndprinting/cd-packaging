"use client";

import { useState, useEffect, useMemo } from "react";
import { Warehouse, Plus, X, Loader2, AlertTriangle, Search, Scissors } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Vendor { id: string; name: string; }
interface Material { id: string; name: string; sku?: string | null; category?: string | null; unit: string; onHand: number; allocated: number; reorderPoint: number; vendor?: string | null; }
interface Die { id: string; dieNumber: string; customerName: string | null; item: string | null; description: string | null; length: number | null; width: number | null; notes: string | null; }

export default function InventoryPage() {
  const [tab, setTab] = useState<"materials" | "dies">("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [dies, setDies] = useState<Die[]>([]);
  const [dieTotal, setDieTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", category: "", unit: "sheets", vendor: "" });
  const update = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [dieSearch, setDieSearch] = useState("");

  useEffect(() => {
    fetch("/api/materials").then(r => r.json()).then(d => { if (d.materials?.length) setMaterials(d.materials); }).catch(() => {});
    fetch("/api/companies?type=vendor").then(r => r.json()).then(d => setVendors(d.companies || [])).catch(() => {});
    fetch("/api/dies").then(r => r.json()).then(d => { setDies(d.dies || []); setDieTotal(d.total || 0); }).catch(() => {});
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
      setMaterials((p) => [...p, { ...data.material, onHand: 0, allocated: 0, reorderPoint: 0 }]);
      setShowModal(false);
      setForm({ name: "", sku: "", category: "", unit: "sheets", vendor: "" });
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

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Add Material</h2><button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. 18pt C1S Paperboard" autoFocus /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">SKU</label><Input value={form.sku} onChange={(e) => update("sku", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label><Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="substrate, ink, coating" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit</label><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="sheets, lbs, gallons" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label><Select value={form.vendor} onChange={(e) => update("vendor", e.target.value)} options={[{ value: "", label: "Select vendor..." }, ...vendors.map(v => ({ value: v.name, label: v.name }))]} /></div>
                </div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Material"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
