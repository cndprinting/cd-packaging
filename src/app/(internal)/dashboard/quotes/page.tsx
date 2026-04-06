"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DollarSign, Plus, X, Loader2, Send, Package, Search, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Quote { id: string; quoteNumber: string; customerName: string; productType: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; status: string; validUntil: string; createdAt: string; }

const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700", converted: "bg-purple-100 text-purple-700" };

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ customerName: "", productType: "FOLDING_CARTON", productName: "", description: "", quantity: "", unitPrice: "", validUntil: "" });
  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => { fetch("/api/quotes").then(r => r.json()).then(d => setQuotes(d.quotes || [])).catch(() => {}); }, []);

  const filtered = useMemo(() => quotes.filter(q => {
    if (search && !q.quoteNumber.toLowerCase().includes(search.toLowerCase()) && !q.customerName.toLowerCase().includes(search.toLowerCase()) && !q.productName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && q.status !== statusFilter) return false;
    if (typeFilter && q.productType !== typeFilter) return false;
    return true;
  }), [quotes, search, statusFilter, typeFilter]);

  const totalValue = quotes.reduce((s, q) => s + q.totalPrice, 0);
  const pending = quotes.filter(q => q.status === "sent").length;
  const approved = quotes.filter(q => q.status === "approved").length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName || !form.productName || !form.quantity) { setError("Customer, product, and quantity are required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setQuotes(p => [data.quote, ...p]); setShowModal(false); setForm({ customerName: "", productType: "FOLDING_CARTON", productName: "", description: "", quantity: "", unitPrice: "", validUntil: "" }); }
      else setError(data.error || "Failed");
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><DollarSign className="h-6 w-6 text-brand-600" /><div><h1 className="text-2xl font-bold text-gray-900">Quotes & Estimates</h1><p className="text-sm text-gray-500">{quotes.length} quotes</p></div></div>
        <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />New Quote</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{quotes.length}</p><p className="text-xs text-gray-500">Total Quotes</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{pending}</p><p className="text-xs text-gray-500">Pending Approval</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{approved}</p><p className="text-xs text-gray-500">Approved</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</p><p className="text-xs text-gray-500">Total Value</p></Card>
      </div>

      <Card className="p-4"><div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search quotes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, { value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "converted", label: "Converted" }]} className="w-36" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: "", label: "All Types" }, { value: "FOLDING_CARTON", label: "Folding Carton" }, { value: "COMMERCIAL_PRINT", label: "Commercial Print" }]} className="w-40" />
      </div></Card>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Quote #</TableHead><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead>Valid Until</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(q => (
              <TableRow key={q.id}>
                <TableCell className="font-mono font-medium">{q.quoteNumber}</TableCell>
                <TableCell>{q.customerName}</TableCell>
                <TableCell className="font-medium">{q.productName}</TableCell>
                <TableCell><Badge className={q.productType === "FOLDING_CARTON" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}>{q.productType === "FOLDING_CARTON" ? "Carton" : "Print"}</Badge></TableCell>
                <TableCell className="text-right">{q.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(q.totalPrice)}</TableCell>
                <TableCell><Badge className={statusColors[q.status] || "bg-gray-100 text-gray-600"}>{q.status}</Badge></TableCell>
                <TableCell className="text-gray-500">{formatDate(q.validUntil)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {q.status === "draft" && <Button variant="ghost" size="sm" className="gap-1 text-blue-600" onClick={() => setQuotes(p => p.map(x => x.id === q.id ? { ...x, status: "sent" } : x))}><Send className="h-3.5 w-3.5" />Send</Button>}
                    {q.status === "approved" && <Button variant="ghost" size="sm" className="gap-1 text-purple-600" onClick={() => setQuotes(p => p.map(x => x.id === q.id ? { ...x, status: "converted" } : x))}><Package className="h-3.5 w-3.5" />Convert</Button>}
                    <Button variant="ghost" size="sm"><FileText className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-400">No quotes found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">New Quote</h2><button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label><Input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Company name" autoFocus /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Product Type *</label><Select value={form.productType} onChange={(e) => update("productType", e.target.value)} options={[{ value: "FOLDING_CARTON", label: "Folding Carton" }, { value: "COMMERCIAL_PRINT", label: "Commercial Print" }]} /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label><Input value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="e.g. Cereal Box - 12oz" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Specs and details" /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label><Input type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($)</label><Input type="number" step="0.01" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label><Input type="date" value={form.validUntil} onChange={(e) => update("validUntil", e.target.value)} /></div>
                </div>
                <div className="flex gap-2 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Quote"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
