"use client";

import { useState, useEffect, useMemo } from "react";
import { Building2, ExternalLink, Plus, X, Loader2 } from "lucide-react";
import { demoCompanies, demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Company { id: string; name: string; slug?: string; industry?: string; phone?: string; }

export default function CustomersPage() {
  const [companies, setCompanies] = useState<Company[]>(demoCompanies);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", industry: "", phone: "", address: "" });
  const update = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  useEffect(() => {
    fetch("/api/companies").then(r => r.json()).then(d => { if (d.companies?.length) setCompanies(d.companies); }).catch(() => {});
  }, []);

  const [allJobs, setAllJobs] = useState(demoJobs);
  useEffect(() => { fetch("/api/jobs").then(r => r.json()).then(d => { if (d.jobs?.length) setAllJobs(d.jobs); }).catch(() => {}); }, []);

  const customerData = useMemo(() => companies.map((c) => {
    const jobs = allJobs.filter((j) => j.companyId === c.id);
    const activeJobs = jobs.filter((j) => j.status !== "DELIVERED" && j.status !== "INVOICED").length;
    return { ...c, activeJobs, totalOrders: new Set(jobs.map((j) => j.orderId)).size };
  }), [companies, allJobs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name) { setError("Company name is required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); setCreating(false); return; }
      setCompanies((p) => [...p, data.company]);
      setShowModal(false);
      setForm({ name: "", industry: "", phone: "", address: "" });
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Customers</h1><p className="text-sm text-gray-500 mt-1">{companies.length} companies</p></div>
        <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />Add Customer</Button>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Industry</TableHead><TableHead className="text-right">Active Jobs</TableHead><TableHead className="text-right">Total Orders</TableHead></TableRow></TableHeader>
          <TableBody>
            {customerData.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/orders?customer=${encodeURIComponent(c.name)}`}>
                <TableCell><div className="flex items-center gap-3"><div className="rounded-lg bg-gray-100 p-2"><Building2 className="h-4 w-4 text-gray-600" /></div><p className="font-medium text-brand-600 hover:underline">{c.name}</p></div></TableCell>
                <TableCell><Badge className="bg-gray-100 text-gray-600">{c.industry || "—"}</Badge></TableCell>
                <TableCell className="text-right"><span className={`font-medium ${c.activeJobs > 0 ? "text-green-700" : "text-gray-400"}`}>{c.activeJobs}</span></TableCell>
                <TableCell className="text-right font-medium">{c.totalOrders}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Add Customer</h2><button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label><Input value={form.name} onChange={(e) => update("name", e.target.value)} autoFocus /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Industry</label><Input value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Food & Beverage" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
                </div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Customer"}</Button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
