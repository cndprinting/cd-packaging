"use client";

import { useState } from "react";
import { Truck, Plus, X, Loader2 } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";

const initialShipments = [
  { id: "s-1", jobNumber: "PKG-2026-008", customer: "Luxe Cosmetics", carrier: "FedEx", tracking: "7489201384756", shipDate: "2026-04-02", status: "DELIVERED", destination: "New York, NY" },
  { id: "s-2", jobNumber: "PKG-2026-015", customer: "Artisan Spirits", carrier: "UPS", tracking: "1Z999AA10123456784", shipDate: "2026-03-30", status: "DELIVERED", destination: "Nashville, TN" },
  { id: "s-3", jobNumber: "PKG-2026-024", customer: "Artisan Spirits", carrier: "FedEx", tracking: "7489201399812", shipDate: "2026-04-04", status: "IN_TRANSIT", destination: "Austin, TX" },
];

export default function ShippingPage() {
  const packedJobs = demoJobs.filter((j) => j.status === "PACKED");
  const [shipments, setShipments] = useState(initialShipments);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ carrier: "", trackingNumber: "", destination: "", cartons: "", notes: "", jobNumber: "" });

  const update = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.carrier || !form.trackingNumber) { setError("Carrier and tracking number required"); return; }
    setCreating(true);
    try {
      // Try API first
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "demo", ...form }),
      });
      if (res.ok) {
        const data = await res.json();
        setShipments((p) => [{ id: data.shipment?.id || `s-${Date.now()}`, jobNumber: form.jobNumber || "NEW", customer: "", carrier: form.carrier, tracking: form.trackingNumber, shipDate: new Date().toISOString().split("T")[0], status: "PREPARING", destination: form.destination }, ...p]);
      } else {
        // Fallback: add locally
        setShipments((p) => [{ id: `s-${Date.now()}`, jobNumber: form.jobNumber || "NEW", customer: "", carrier: form.carrier, tracking: form.trackingNumber, shipDate: new Date().toISOString().split("T")[0], status: "PREPARING", destination: form.destination }, ...p]);
      }
      setShowModal(false);
      setForm({ carrier: "", trackingNumber: "", destination: "", cartons: "", notes: "", jobNumber: "" });
    } catch {
      setShipments((p) => [{ id: `s-${Date.now()}`, jobNumber: form.jobNumber || "NEW", customer: "", carrier: form.carrier, tracking: form.trackingNumber, shipDate: new Date().toISOString().split("T")[0], status: "PREPARING", destination: form.destination }, ...p]);
      setShowModal(false);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipping</h1>
            <p className="text-sm text-gray-500">{packedJobs.length} ready to ship, {shipments.length} shipments</p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />Create Shipment</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{packedJobs.length}</p><p className="text-xs text-gray-500">Ready to Ship</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{shipments.filter(s => s.status === "IN_TRANSIT" || s.status === "PREPARING").length}</p><p className="text-xs text-gray-500">In Transit</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{shipments.filter(s => s.status === "DELIVERED").length}</p><p className="text-xs text-gray-500">Delivered</p></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Shipments</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Job #</TableHead><TableHead>Customer</TableHead><TableHead>Carrier</TableHead><TableHead>Tracking</TableHead><TableHead>Ship Date</TableHead><TableHead>Status</TableHead><TableHead>Destination</TableHead></TableRow></TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/jobs?search=${encodeURIComponent(s.jobNumber)}`}>
                  <TableCell className="font-mono font-medium text-brand-600 hover:underline">{s.jobNumber}</TableCell>
                  <TableCell>{s.customer}</TableCell>
                  <TableCell>{s.carrier}</TableCell>
                  <TableCell className="font-mono text-xs">{s.tracking}</TableCell>
                  <TableCell>{formatDate(s.shipDate)}</TableCell>
                  <TableCell><Badge className={getStatusColor(s.status)}>{getStatusLabel(s.status)}</Badge></TableCell>
                  <TableCell className="text-gray-500">{s.destination}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Create Shipment</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Job Number</label><Input placeholder="PKG-2026-XXX" value={form.jobNumber} onChange={(e) => update("jobNumber", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Carrier *</label><Input placeholder="FedEx, UPS..." value={form.carrier} onChange={(e) => update("carrier", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Tracking # *</label><Input placeholder="Tracking number" value={form.trackingNumber} onChange={(e) => update("trackingNumber", e.target.value)} /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination</label><Input placeholder="City, State" value={form.destination} onChange={(e) => update("destination", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Cartons</label><Input type="number" value={form.cartons} onChange={(e) => update("cartons", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><Input value={form.notes} onChange={(e) => update("notes", e.target.value)} /></div>
                </div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Shipment"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
