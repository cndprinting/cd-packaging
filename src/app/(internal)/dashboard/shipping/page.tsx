"use client";

// Shipping queue (rebuilt 11/17/26 for Shayla). Real shipments, tied to the
// customer record, the job and the invoice. Ship-date and tracking emails go to
// the customer from the sender's own mailbox. COD shipments can't be released
// until the linked invoice is paid.
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Truck, Plus, X, Loader2, ExternalLink, Package, Mail, Search, AlertTriangle, Trash2, Pencil, Printer, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CARRIERS, trackingUrl } from "@/lib/shipping";

type Item = { description: string; quantity: number; boxes?: string | null };
type Tally = { ordered: number; shipped: number; remaining: number; shipments: number } | null;
type Shipment = {
  id: string; shipmentNumber: string; status: string; companyId: string | null; customerName: string | null;
  jobId: string | null; jobNumber: string | null; invoiceId: string | null; invoiceNumber: string | null; poNumber: string | null;
  contactName: string | null; contactEmail: string | null; shipTo: string | null; destination: string | null;
  carrier: string | null; trackingNumber: string | null; targetShipDate: string | null; shipDate: string | null;
  estimatedDelivery: string | null; actualDelivery: string | null; cartons: number | null; pallets: number | null; weight: number | null;
  isPartial: boolean; cod: boolean; notes: string | null; notifiedAt: string | null; notifyLog: string | null;
  items: Item[]; invoicePaid: boolean | null; invoiceBalance: number | null; createdAt: string;
  freightCost: number | null; freightNote: string | null; codRequestedAt: string | null; codRequestedBy: string | null; codReleasedAt: string | null; codReleasedBy: string | null; codReleased: boolean; tally: Tally;
};
type Ready = { id: string; jobNumber: string; name: string | null; quantity: number; dueDate: string | null; companyId: string | null; customerName: string | null; poNumber: string | null; invoiceId: string | null; tally: Tally; shipTo: string | null; instructions: string | null; contactName: string | null; contactEmail: string | null };
type Cust = { id: string; name: string; where: string; email: string | null; contact: string | null; address?: string | null };
type Inv = { id: string; invoiceNumber: string; status: string; total: number; remaining: number; description: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  PREPARING: { label: "To ship", cls: "bg-amber-100 text-amber-800" },
  PICKED_UP: { label: "Picked up", cls: "bg-sky-100 text-sky-800" },
  IN_TRANSIT: { label: "In transit", cls: "bg-blue-100 text-blue-800" },
  DELIVERED: { label: "Delivered", cls: "bg-emerald-100 text-emerald-800" },
  EXCEPTION: { label: "Problem", cls: "bg-red-100 text-red-800" },
};
const TABS = [
  { key: "toship", label: "To ship", match: (s: Shipment) => s.status === "PREPARING" },
  { key: "transit", label: "In transit", match: (s: Shipment) => s.status === "PICKED_UP" || s.status === "IN_TRANSIT" || s.status === "EXCEPTION" },
  { key: "delivered", label: "Delivered", match: (s: Shipment) => s.status === "DELIVERED" },
  { key: "all", label: "All", match: () => true },
];
const inputCls = "mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none";
const d10 = (v?: string | null) => (v ? v.slice(0, 10) : "");
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");
const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const blank = { companyId: "", customerName: "", jobId: "", jobNumber: "", poNumber: "", invoiceId: "", contactName: "", contactEmail: "", shipTo: "", targetShipDate: "", carrier: "FedEx", trackingNumber: "", estimatedDelivery: "", cartons: "", pallets: "", weight: "", freightCost: "", isPartial: false, cod: false, notes: "", items: [{ description: "", quantity: "", boxes: "" }] as { description: string; quantity: string; boxes: string }[] };
const RELEASE_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING"];
const tallyText = (t: Tally) => (t && t.ordered ? `${t.shipped.toLocaleString()} of ${t.ordered.toLocaleString()} delivered${t.remaining > 0 ? `, ${t.remaining.toLocaleString()} left` : ", complete"}` : "");

export default function ShippingPage() {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [ready, setReady] = useState<Ready[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("toship");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  useEffect(() => { fetch("/api/auth/session").then((r) => r.json()).then((d) => setRole(d?.user?.role || "")).catch(() => {}); }, []);
  const cod = async (s: Shipment, action: "cod_request" | "cod_release") => {
    const r = await fetch(`/api/shipments/${s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await r.json();
    if (!r.ok) { flash(false, d.error || "Could not save"); return; }
    flash(true, action === "cod_request" ? `Asked accounting to release ${s.shipmentNumber}${d.emailed?.length ? ` (emailed ${d.emailed.length})` : ""}` : `${s.shipmentNumber} is OK to release`);
    load();
  };
  const [notify, setNotify] = useState<{ s: Shipment; kind: "shipdate" | "tracking"; to: string; note: string; html: string; subject: string; busy: boolean } | null>(null);

  const load = async () => {
    try { const r = await fetch("/api/shipments"); const d = await r.json(); setRows(d.shipments || []); setReady(d.ready || []); } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 6000); };

  const counts = useMemo(() => ({
    toship: rows.filter((s) => s.status === "PREPARING").length,
    late: rows.filter((s) => s.status === "PREPARING" && s.targetShipDate && d10(s.targetShipDate) < today()).length,
    transit: rows.filter((s) => ["PICKED_UP", "IN_TRANSIT", "EXCEPTION"].includes(s.status)).length,
    delivered: rows.filter((s) => s.status === "DELIVERED").length,
  }), [rows]);

  const shown = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    const needle = q.trim().toLowerCase();
    return rows.filter(t.match).filter((s) => !needle || [s.shipmentNumber, s.customerName, s.jobNumber, s.poNumber, s.invoiceNumber, s.trackingNumber, s.destination].some((v) => (v || "").toLowerCase().includes(needle)))
      .sort((a, b) => (tab === "toship" ? (d10(a.targetShipDate) || "9999").localeCompare(d10(b.targetShipDate) || "9999") : 0));
  }, [rows, tab, q]);

  const put = async (s: Shipment, body: Record<string, unknown>, okText?: string) => {
    const r = await fetch(`/api/shipments/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (r.status === 409 && d.cod) {
      if (RELEASE_ROLES.includes(role) && confirm(`${d.error}\n\nRelease it anyway?`)) return put(s, { ...body, override: true }, okText);
      flash(false, d.error);
      return false;
    }
    if (!r.ok) { flash(false, d.error || "Could not save"); return false; }
    if (okText) flash(true, okText);
    await load(); return true;
  };

  const startNew = (r?: Ready) => { setEditId(null); setForm({ ...blank, items: [{ description: "", quantity: "", boxes: "" }], ...(r ? { jobId: r.id, jobNumber: r.jobNumber, poNumber: r.poNumber || "", invoiceId: r.invoiceId || "", companyId: r.companyId || "", customerName: r.customerName || "", shipTo: r.shipTo || "", notes: r.instructions || "", contactName: r.contactName || "", contactEmail: r.contactEmail || "", items: [{ description: r.name || "", quantity: String(r.tally?.remaining ?? r.quantity ?? ""), boxes: "" }] } : {}) }); };
  const startEdit = (s: Shipment) => {
    setEditId(s.id);
    setForm({ ...blank, companyId: s.companyId || "", customerName: s.customerName || "", jobId: s.jobId || "", jobNumber: s.jobNumber || "", poNumber: s.poNumber || "", invoiceId: s.invoiceId || "", contactName: s.contactName || "", contactEmail: s.contactEmail || "", shipTo: s.shipTo || "", targetShipDate: d10(s.targetShipDate), carrier: s.carrier || "FedEx", trackingNumber: s.trackingNumber || "", estimatedDelivery: d10(s.estimatedDelivery), cartons: s.cartons?.toString() || "", pallets: s.pallets?.toString() || "", weight: s.weight?.toString() || "", freightCost: s.freightCost?.toString() || "", isPartial: s.isPartial, cod: s.cod, notes: s.notes || "", items: s.items.length ? s.items.map((i) => ({ description: i.description, quantity: String(i.quantity), boxes: i.boxes || "" })) : [{ description: "", quantity: "", boxes: "" }] });
  };

  const openNotify = async (s: Shipment, kind: "shipdate" | "tracking") => {
    const r = await fetch(`/api/shipments/${s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "notify", kind, preview: true }) });
    const d = await r.json();
    if (!r.ok) { flash(false, d.error || "Could not build the email"); return; }
    setNotify({ s, kind, to: d.to || "", note: "", html: d.html, subject: d.subject, busy: false });
  };
  const refreshPreview = async (n: NonNullable<typeof notify>) => {
    const r = await fetch(`/api/shipments/${n.s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "notify", kind: n.kind, note: n.note, preview: true }) });
    const d = await r.json(); if (r.ok) setNotify({ ...n, html: d.html, subject: d.subject });
  };
  const sendNotify = async () => {
    if (!notify) return;
    setNotify({ ...notify, busy: true });
    const r = await fetch(`/api/shipments/${notify.s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "notify", kind: notify.kind, to: notify.to, note: notify.note }) });
    const d = await r.json();
    if (!r.ok) { flash(false, d.error || "Email failed"); setNotify({ ...notify, busy: false }); return; }
    flash(true, `Emailed ${d.to}`); setNotify(null); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-brand-600" />
          <div><h1 className="text-2xl font-bold text-gray-900">Shipping</h1><p className="text-sm text-gray-500">Every shipment is tied to the customer, the job and the invoice.</p></div>
        </div>
        <Button onClick={() => startNew()} className="gap-2"><Plus className="h-4 w-4" />New shipment</Button>
      </div>

      {msg && <div className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><p className="text-2xl font-bold text-amber-600">{counts.toship}</p><p className="text-xs text-gray-500">To ship</p></Card>
        <Card className="p-4"><p className={`text-2xl font-bold ${counts.late ? "text-red-600" : "text-gray-400"}`}>{counts.late}</p><p className="text-xs text-gray-500">Past target ship date</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-blue-600">{counts.transit}</p><p className="text-xs text-gray-500">In transit</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-emerald-600">{counts.delivered}</p><p className="text-xs text-gray-500">Delivered</p></Card>
      </div>

      {ready.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900"><Package className="h-4 w-4 text-amber-600" />Packed and ready to ship</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <div><div className="font-mono font-medium">{r.jobNumber}</div><div className="text-xs text-gray-600">{r.customerName || "No customer"} · {r.name}</div>{r.tally && r.tally.shipped > 0 && <div className="text-[11px] font-medium text-amber-800">Partial: {tallyText(r.tally)}</div>}</div>
                <Button size="sm" onClick={() => startNew(r)}>Ship</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="flex gap-1">
            {TABS.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-md px-3 py-1.5 text-sm ${tab === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{t.label}</button>)}
          </div>
          <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer, job, PO, invoice, tracking" className="pl-8" /></div>
        </div>
        {loading ? <div className="p-6 text-sm text-gray-400"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading</div> : shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{rows.length === 0 ? "No shipments yet. Click New shipment to add one." : "Nothing in this view."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Shipment</th><th className="px-2 py-2">Customer</th><th className="px-2 py-2">Job / PO</th><th className="px-2 py-2">Invoice</th><th className="px-2 py-2">Target ship</th><th className="px-2 py-2">Carrier / tracking</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Customer emailed</th>
              </tr></thead>
              <tbody>
                {shown.map((s) => {
                  const url = trackingUrl(s.carrier, s.trackingNumber);
                  const late = s.status === "PREPARING" && s.targetShipDate && d10(s.targetShipDate) < today();
                  return (
                    <Fragment key={s.id}>
                      <tr onClick={() => setOpen(open === s.id ? null : s.id)} className="cursor-pointer border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs">{s.shipmentNumber}{s.isPartial && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-600">partial</span>}{s.tally && s.tally.shipped > 0 && <div className="font-sans text-[10px] text-gray-500">{tallyText(s.tally)}</div>}</td>
                        <td className="px-2 py-2">{s.companyId ? <Link onClick={(e) => e.stopPropagation()} href={`/dashboard/customers/${s.companyId}`} className="text-brand-600 hover:underline">{s.customerName}</Link> : <span className="text-amber-700">{s.customerName || "No customer"}</span>}</td>
                        <td className="px-2 py-2 text-xs"><div className="font-mono">{s.jobNumber || "-"}</div>{s.poNumber && <div className="text-gray-500">PO {s.poNumber}</div>}</td>
                        <td className="px-2 py-2 text-xs">
                          {s.invoiceNumber ? <div className="font-mono">{s.invoiceNumber}</div> : <span className="text-gray-400">not linked</span>}
                          {s.invoiceNumber && s.invoicePaid !== null && <span className={`rounded px-1 text-[10px] font-semibold ${s.invoicePaid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>{s.invoicePaid ? "paid" : `${money(s.invoiceBalance || 0)} open`}</span>}
                          {s.cod && <span title={s.codReleasedAt ? `Released by ${s.codReleasedBy}` : s.codRequestedAt ? `Asked by ${s.codRequestedBy}` : "Not asked yet"} className={`ml-1 rounded px-1 text-[10px] font-semibold ${s.codReleased ? "bg-emerald-100 text-emerald-800" : s.codRequestedAt ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>{s.codReleased ? "COD: OK to release" : s.codRequestedAt ? "COD: waiting on accounting" : "COD: hold"}</span>}
                        </td>
                        <td className={`px-2 py-2 text-xs ${late ? "font-semibold text-red-600" : ""}`}>{fmt(s.targetShipDate) || "-"}{late && <AlertTriangle className="ml-1 inline h-3 w-3" />}</td>
                        <td className="px-2 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <div>{s.carrier || "-"}</div>
                          {s.trackingNumber && (url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline">{s.trackingNumber}<ExternalLink className="h-3 w-3" /></a> : <span className="font-mono">{s.trackingNumber}</span>)}
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <select value={s.status} onChange={(e) => put(s, { status: e.target.value }, `${s.shipmentNumber} is now ${STATUS[e.target.value]?.label || e.target.value}`)} className={`rounded-md border-0 px-2 py-1 text-xs font-medium ${STATUS[s.status]?.cls || ""}`}>
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-500">{s.notifiedAt ? fmt(s.notifiedAt) : "-"}</td>
                      </tr>
                      {open === s.id && (
                        <tr className="bg-gray-50"><td colSpan={8} className="px-4 py-3">
                          <div className="grid gap-4 text-sm md:grid-cols-3">
                            <div>
                              <div className="text-xs font-medium uppercase text-gray-500">Ship to</div>
                              <div className="whitespace-pre-line">{s.shipTo || s.destination || "-"}</div>
                              <div className="mt-1 text-xs text-gray-500">Contact: {s.contactName || "-"}{s.contactEmail ? ` · ${s.contactEmail}` : " · no email"}</div>
                              <div className="text-xs text-gray-500">{[s.cartons && `${s.cartons} cartons`, s.pallets && `${s.pallets} pallets`, s.weight && `${s.weight} lb`].filter(Boolean).join(" · ") || ""}</div>
                              {(s.freightCost || s.freightNote) && <div className={`text-xs ${s.freightNote?.includes("already went") ? "text-amber-700" : "text-gray-600"}`}>Freight {s.freightCost ? money(s.freightCost) : "-"}{s.freightNote ? `. ${s.freightNote}` : ""}</div>}
                              {s.tally && <div className="text-xs text-gray-600">Job: {tallyText(s.tally)}</div>}
                              {s.estimatedDelivery && <div className="text-xs text-gray-500">Expected delivery {fmt(s.estimatedDelivery)}</div>}
                              {s.shipDate && <div className="text-xs text-gray-500">Shipped {fmt(s.shipDate)}</div>}
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase text-gray-500">In this shipment</div>
                              {s.items.length ? <ul className="list-disc pl-4">{s.items.map((i, k) => <li key={k}>{i.quantity.toLocaleString()} x {i.description}{i.boxes ? ` (${i.boxes})` : ""}</li>)}</ul> : <div className="text-gray-400">-</div>}
                              {s.notes && <div className="mt-1 text-xs text-gray-600">{s.notes}</div>}
                              {s.notifyLog && <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] text-gray-500">{s.notifyLog}</pre>}
                            </div>
                            <div className="flex flex-wrap content-start gap-2">
                              <a href={`/print/packing-slip/${s.id}`} target="_blank" rel="noreferrer"><Button size="sm" className="gap-1"><Printer className="h-3.5 w-3.5" />Packing slip</Button></a>
                              {s.cod && !s.codReleased && <Button size="sm" variant="outline" className="gap-1 border-amber-400 text-amber-800" onClick={() => cod(s, "cod_request")}><Mail className="h-3.5 w-3.5" />{s.codRequestedAt ? "Ask accounting again" : "Ask Denise to release"}</Button>}
                              {s.cod && !s.codReleased && RELEASE_ROLES.includes(role) && <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => cod(s, "cod_release")}><CheckCircle2 className="h-3.5 w-3.5" />OK to release</Button>}
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => openNotify(s, "shipdate")}><Mail className="h-3.5 w-3.5" />Email ship date</Button>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => openNotify(s, "tracking")}><Mail className="h-3.5 w-3.5" />Email tracking</Button>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => startEdit(s)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                              {s.status === "PREPARING" && <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={async () => { if (!confirm(`Delete ${s.shipmentNumber}?`)) return; const r = await fetch(`/api/shipments/${s.id}`, { method: "DELETE" }); if (r.ok) { flash(true, "Deleted"); load(); } else flash(false, (await r.json()).error || "Could not delete"); }}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form && <ShipmentForm form={form} setForm={setForm} editId={editId} onClose={() => setForm(null)} onSaved={(t) => { setForm(null); flash(true, t); load(); }} onError={(t) => flash(false, t)} />}

      {notify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setNotify(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{notify.kind === "tracking" ? "Email tracking" : "Email ship date"} · {notify.s.customerName}</h2><button onClick={() => setNotify(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <div className="mt-3 grid gap-3 text-sm">
              <label className="block"><span className="text-gray-600">To</span><Input value={notify.to} onChange={(e) => setNotify({ ...notify, to: e.target.value })} placeholder="customer@company.com" /></label>
              <label className="block"><span className="text-gray-600">Add a note (optional)</span><textarea value={notify.note} onChange={(e) => setNotify({ ...notify, note: e.target.value })} onBlur={() => refreshPreview(notify)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <div className="text-xs text-gray-500">Subject: {notify.subject}</div>
            </div>
            <iframe title="preview" srcDoc={notify.html} className="mt-2 min-h-[260px] flex-1 rounded border border-gray-200" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Sends from your own mailbox, so replies come back to you.</span>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setNotify(null)}>Cancel</Button><Button onClick={sendNotify} disabled={notify.busy || !notify.to}>{notify.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}</Button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShipmentForm({ form, setForm, editId, onClose, onSaved, onError }: { form: typeof blank; setForm: (f: typeof blank) => void; editId: string | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Cust[]>([]);
  const [total, setTotal] = useState(0);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank, v: unknown) => setForm({ ...form, [k]: v } as typeof blank);

  useEffect(() => {
    if (form.companyId) return;
    const t = setTimeout(async () => { try { const r = await fetch(`/api/payments/customers?q=${encodeURIComponent(q)}`); const d = await r.json(); setList(d.customers || []); setTotal(d.total || 0); } catch { /* ignore */ } }, 250);
    return () => clearTimeout(t);
  }, [q, form.companyId]);
  useEffect(() => {
    if (!form.companyId) { setInvs([]); return; }
    fetch(`/api/shipments?invoicesFor=${form.companyId}`).then((r) => r.json()).then((d) => setInvs(d.invoices || [])).catch(() => {});
  }, [form.companyId]);

  const pick = (c: Cust) => setForm({ ...form, companyId: c.id, customerName: c.name, contactEmail: form.contactEmail || c.email || "", contactName: form.contactName || c.contact || "", shipTo: form.shipTo || c.address || "" });
  const save = async () => {
    if (!form.companyId) { onError("Pick the customer first"); return; }
    setBusy(true);
    const body = { ...form, items: form.items.filter((i) => i.description.trim()).map((i) => ({ description: i.description, quantity: Number(String(i.quantity).replace(/,/g, "")) || 0, boxes: i.boxes || null })) };
    const r = editId ? await fetch(`/api/shipments/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) : await fetch("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { onError(d.error || "Could not save"); return; }
    onSaved(editId ? `${d.shipment.shipmentNumber} saved` : `${d.shipment.shipmentNumber} created for ${d.shipment.customerName}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{editId ? "Edit shipment" : "New shipment"}</h2><button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button></div>

        {!form.companyId ? (
          <div className="mt-3">
            <label className="text-sm text-gray-600">Customer <span className="text-gray-400">(from the Customers list)</span></label>
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing the customer name" />
            <div className="mt-1 text-[11px] text-gray-400">{total > list.length ? `Showing ${list.length} of ${total.toLocaleString()} customers. Keep typing to narrow it down.` : `${total.toLocaleString()} match${total === 1 ? "" : "es"}`}</div>
            <div className="mt-2 max-h-56 overflow-auto rounded-md border border-gray-200">
              {list.map((c) => <button key={c.id} type="button" onClick={() => pick(c)} className="flex w-full justify-between border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"><span className="font-medium">{c.name}{c.where && <span className="font-normal text-gray-400"> · {c.where}</span>}</span><span className="text-xs text-gray-400">{c.email || ""}</span></button>)}
              {list.length === 0 && <div className="p-3 text-sm text-gray-500">No match. If the customer isn't set up yet, ask a CSR to add them in Customers.</div>}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"><span className="font-medium">{form.customerName}</span>{!editId && <button type="button" onClick={() => set("companyId", "")} className="text-xs text-brand-600 hover:underline">Change</button>}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-gray-600">Job #</span><Input value={form.jobNumber} onChange={(e) => set("jobNumber", e.target.value)} placeholder="FileMaker or Godzilla job #" autoComplete="off" /></label>
              <label className="block"><span className="text-gray-600">Customer PO #</span><Input value={form.poNumber} onChange={(e) => set("poNumber", e.target.value)} autoComplete="off" /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Invoice</span>
                <select value={form.invoiceId} onChange={(e) => set("invoiceId", e.target.value)} className={inputCls}>
                  <option value="">Not linked yet</option>
                  {invs.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} · {i.description || ""} · {i.remaining > 0 ? `${money(i.remaining)} open` : "paid"}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-gray-600">Contact name</span><Input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
              <label className="block"><span className="text-gray-600">Contact email (gets the ship emails)</span><Input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Ship to</span><textarea value={form.shipTo} onChange={(e) => set("shipTo", e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-gray-600">Target ship date</span><Input type="date" value={form.targetShipDate} onChange={(e) => set("targetShipDate", e.target.value)} /></label>
              <label className="block"><span className="text-gray-600">Carrier</span><select value={form.carrier} onChange={(e) => set("carrier", e.target.value)} className={inputCls}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="block"><span className="text-gray-600">Tracking #</span><Input value={form.trackingNumber} onChange={(e) => set("trackingNumber", e.target.value)} placeholder="Add when it ships" autoComplete="off" /></label>
              <label className="block"><span className="text-gray-600">Expected delivery</span><Input type="date" value={form.estimatedDelivery} onChange={(e) => set("estimatedDelivery", e.target.value)} /></label>
              <label className="block"><span className="text-gray-600">Cartons</span><Input value={form.cartons} onChange={(e) => set("cartons", e.target.value)} inputMode="numeric" /></label>
              <label className="block"><span className="text-gray-600">Pallets</span><Input value={form.pallets} onChange={(e) => set("pallets", e.target.value)} inputMode="numeric" /></label>
              <label className="block"><span className="text-gray-600">Weight (lb)</span><Input value={form.weight} onChange={(e) => set("weight", e.target.value)} inputMode="decimal" /></label>
              <label className="block"><span className="text-gray-600">Shipping cost ($)</span><Input value={form.freightCost} onChange={(e) => set("freightCost", e.target.value)} inputMode="decimal" placeholder="UPS / freight charge" /><span className="text-[11px] text-gray-400">Goes on the invoice's freight line</span></label>
              <div className="flex flex-col justify-end gap-1 pb-1">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPartial} onChange={(e) => set("isPartial", e.target.checked)} /> Partial shipment <span className="text-[11px] text-gray-400">(set for you when the quantity is short)</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.cod} onChange={(e) => set("cod", e.target.checked)} /> COD, hold for accounting's OK</label>
              </div>
            </div>
            <div>
              <div className="text-gray-600">In this shipment</div>
              {form.items.map((it, k) => (
                <div key={k} className="mt-1 flex gap-2">
                  <Input value={it.quantity} onChange={(e) => { const items = [...form.items]; items[k] = { ...it, quantity: e.target.value }; set("items", items); }} placeholder="Qty" className="w-24" inputMode="numeric" />
                  <Input value={it.description} onChange={(e) => { const items = [...form.items]; items[k] = { ...it, description: e.target.value }; set("items", items); }} placeholder="Description" />
                  <Input value={it.boxes} onChange={(e) => { const items = [...form.items]; items[k] = { ...it, boxes: e.target.value }; set("items", items); }} placeholder="Boxes, e.g. 8 bxs @ 250" className="w-48" />
                </div>
              ))}
              <button type="button" onClick={() => set("items", [...form.items, { description: "", quantity: "", boxes: "" }])} className="mt-1 text-xs text-brand-600 hover:underline">+ Add line</button>
            </div>
            <label className="block"><span className="text-gray-600">Special shipping instructions <span className="text-gray-400">(print on the packing slip)</span></span><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Must deliver COC with each version. Deliver before 3:00." /></label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Save" : "Create shipment"}</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}
