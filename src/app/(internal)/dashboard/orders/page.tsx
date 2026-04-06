"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ExternalLink, Plus, X, Loader2 } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusColor, getStatusLabel, getPriorityColor, formatDate } from "@/lib/utils";

interface Order {
  orderId: string;
  orderNumber: string;
  companyName: string;
  jobs: typeof demoJobs;
  status: string;
  priority: string;
  dueDate: string;
}

function getOrders(): Order[] {
  const map = new Map<string, Order>();
  for (const job of demoJobs) {
    if (!map.has(job.orderId)) {
      map.set(job.orderId, { orderId: job.orderId, orderNumber: job.orderNumber, companyName: job.companyName, jobs: [], status: job.status, priority: job.priority, dueDate: job.dueDate });
    }
    const order = map.get(job.orderId)!;
    order.jobs.push(job);
    if (new Date(job.dueDate) < new Date(order.dueDate)) order.dueDate = job.dueDate;
    const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    if (priorities.indexOf(job.priority) > priorities.indexOf(order.priority)) order.priority = job.priority;
  }
  return Array.from(map.values());
}

const STATUSES = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(() => getOrders());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ customerName: "", poNumber: "", dueDate: "", priority: "NORMAL", notes: "", itemName: "", itemQty: "" });
  const update = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const filtered = useMemo(() => orders.filter((o) => {
    if (search && !o.orderNumber.toLowerCase().includes(search.toLowerCase()) && !o.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && !o.jobs.some((j) => j.status === statusFilter)) return false;
    return true;
  }), [orders, search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName) { setError("Customer name required"); return; }
    setCreating(true);
    try {
      const items = form.itemName ? [{ name: form.itemName, quantity: form.itemQty || "1" }] : [];
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: form.customerName, poNumber: form.poNumber, dueDate: form.dueDate, priority: form.priority, notes: form.notes, items }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) => [{ orderId: data.order.id, orderNumber: data.order.orderNumber, companyName: data.order.companyName || form.customerName, jobs: [], status: "QUOTE", priority: form.priority, dueDate: form.dueDate }, ...prev]);
        setShowModal(false);
        setForm({ customerName: "", poNumber: "", dueDate: "", priority: "NORMAL", notes: "", itemName: "", itemQty: "" });
      } else {
        setError(data.error || "Failed to create order");
      }
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Orders</h1><p className="text-sm text-gray-500 mt-1">{filtered.length} orders</p></div>
        <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />New Order</Button>
      </div>

      <Card><CardContent className="p-4"><div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search by order number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, ...STATUSES.map((s) => ({ value: s, label: getStatusLabel(s) }))]} />
      </div></CardContent></Card>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Due Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow key={order.orderId}>
                <TableCell><span className="font-mono font-medium text-gray-900">{order.orderNumber}</span></TableCell>
                <TableCell>{order.companyName}</TableCell>
                <TableCell><span className="text-gray-700">{order.jobs.length} job{order.jobs.length !== 1 ? "s" : ""}</span></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{Array.from(new Set(order.jobs.map((j) => j.status))).map((s) => <Badge key={s} className={getStatusColor(s)}>{getStatusLabel(s)}</Badge>)}</div></TableCell>
                <TableCell><Badge className={getPriorityColor(order.priority)}>{order.priority}</Badge></TableCell>
                <TableCell>{formatDate(order.dueDate)}</TableCell>
                <TableCell><Link href={`/dashboard/orders/${order.orderId}`}><Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4 mr-1" />View</Button></Link></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No orders match your filters.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Create New Order</h2><button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label><Input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Company name" autoFocus /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label><Input value={form.poNumber} onChange={(e) => update("poNumber", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label><Input type="date" value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label><Select value={form.priority} onChange={(e) => update("priority", e.target.value)} options={[{ value: "LOW", label: "Low" },{ value: "NORMAL", label: "Normal" },{ value: "HIGH", label: "High" },{ value: "URGENT", label: "Urgent" }]} /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><Input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Order notes..." /></div>
                <div className="border-t pt-4"><p className="text-sm font-medium text-gray-700 mb-2">First Item (optional)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2"><Input value={form.itemName} onChange={(e) => update("itemName", e.target.value)} placeholder="Item name" /></div>
                    <div><Input type="number" value={form.itemQty} onChange={(e) => update("itemQty", e.target.value)} placeholder="Qty" /></div>
                  </div>
                </div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Order"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
