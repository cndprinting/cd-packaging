"use client";

// Receivables (Benjy + Denise 11/7/26): the one place everyone looks to answer
// "did they pay?". Stripe card/ACH payments post themselves; checks and wires
// are recorded here; reminders go out automatically; commissions release when
// the invoice is paid; Sage gets a monthly CSV. GL stays in Sage.
import { useState, useEffect, useMemo } from "react";
import { DollarSign, Search, Send, Loader2, Link2, Banknote, Download, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewInvoice } from "@/components/invoices/new-invoice";

interface Payment { id: string; amount: number; method: string; reference: string | null; receivedAt: string; recordedBy: string | null; note: string | null }
interface Invoice {
  id: string; invoiceNumber: string; customerName: string; contactEmail: string | null; description: string | null;
  subtotal: number; taxAmount: number; total: number; depositAmount: number; depositPaid: boolean; status: string; kind: string;
  jobId: string | null; companyId: string | null; dueDate: string | null; createdAt: string; paidAmount: number; remaining: number; payUrl?: string;
  remindedAt: string | null; remindCount: number; salesRepName: string | null; commissionAmount: number | null; commissionPct: number | null; commissionStatus: string; notes: string | null;
  payments: Payment[];
}

const statusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-700", partial: "bg-amber-100 text-amber-700", deposit_paid: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", overdue: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-400" };
const statusLabels: Record<string, string> = { pending: "Open", partial: "Partly paid", deposit_paid: "Deposit paid", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" };
const kindLabels: Record<string, string> = { final: "Invoice", prebill: "Prebill", deposit: "Deposit" };
const METHODS = [["check", "Check"], ["ach", "ACH / bank"], ["wire", "Wire"], ["card", "Card (outside Stripe)"], ["other", "Other"]];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pay, setPay] = useState<{ inv: Invoice; amount: string; method: string; reference: string; receivedAt: string } | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = () => fetch("/api/payments").then((r) => r.json()).then((d) => setInvoices(d.invoices || [])).finally(() => setLoading(false));
  useEffect(() => { load(); fetch("/api/auth/session").then((r) => r.json()).then((d) => setRole(d.user?.role || "")).catch(() => {}); }, []);
  const canMoney = ["OWNER", "GM", "ADMIN", "ACCOUNTING"].includes(role);
  const canCreate = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ACCOUNTING", "CSR"].includes(role);

  const act = async (inv: Invoice, body: Record<string, unknown>, okMsg?: string) => {
    setBusy(inv.id + body.action); setMsg(null);
    try {
      const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: inv.id, ...body }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Failed"); return false; }
      if (okMsg) setMsg(okMsg);
      await load(); return true;
    } catch { setMsg("Failed"); return false; }
    finally { setBusy(null); }
  };

  const sendInvoice = async (inv: Invoice) => {
    let to = inv.contactEmail || "";
    if (!to) { to = prompt("Customer email address:") || ""; if (!to) return; }
    await act(inv, { action: "send_invoice", to }, `Invoice ${inv.invoiceNumber} sent to ${to}`);
  };
  const copyLink = async (inv: Invoice) => { if (inv.payUrl) { await navigator.clipboard.writeText(inv.payUrl); setMsg(`Pay link for ${inv.invoiceNumber} copied. Paste it in any email or text.`); } };
  const submitPayment = async () => {
    if (!pay) return;
    const ok = await act(pay.inv, { action: "record_payment", amount: Number(pay.amount), method: pay.method, reference: pay.reference, receivedAt: pay.receivedAt }, `Payment recorded on ${pay.inv.invoiceNumber}`);
    if (ok) setPay(null);
  };

  const filtered = useMemo(() => invoices.filter((inv) => {
    const q = search.toLowerCase();
    const m = !q || inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q) || (inv.salesRepName || "").toLowerCase().includes(q);
    const s = statusFilter === "all" ? true : statusFilter === "open" ? !["paid", "cancelled"].includes(inv.status) : statusFilter === "commission" ? inv.commissionStatus === "payable" : inv.status === statusFilter;
    return m && s;
  }), [invoices, search, statusFilter]);

  const openInv = invoices.filter((i) => !["paid", "cancelled"].includes(i.status));
  const outstanding = openInv.reduce((s, i) => s + i.remaining, 0);
  const overdue = openInv.filter((i) => i.dueDate && new Date(i.dueDate) < new Date()).reduce((s, i) => s + i.remaining, 0);
  const commPayable = invoices.filter((i) => i.commissionStatus === "payable").reduce((s, i) => s + (i.commissionAmount || 0), 0);
  const paidThisMonth = invoices.filter((i) => i.status !== "cancelled").flatMap((i) => i.payments).filter((p) => p.receivedAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, p) => s + p.amount, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices & payments</h1>
            <p className="text-sm text-gray-500">Card and bank payments post themselves from Stripe. Record checks and wires here. Reminders go out automatically at the due date, then 7, 14 and 28 days after.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {canCreate && <Button onClick={() => setShowNew(true)}><Plus className="mr-1 h-4 w-4" />New invoice</Button>}
        {canMoney && (
          <>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            <a href={`/api/payments/export?month=${month}`} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"><Download className="h-4 w-4" />Sage export (CSV)</a>
          </>
        )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{formatCurrency(outstanding)}</p><p className="text-xs text-gray-500">Outstanding · {openInv.length} open</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{formatCurrency(overdue)}</p><p className="text-xs text-gray-500">Past due</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{formatCurrency(paidThisMonth)}</p><p className="text-xs text-gray-500">Received this month</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{formatCurrency(commPayable)}</p><p className="text-xs text-gray-500">Commissions payable</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice, customer, rep" className="pl-9" /></div>
        <div className="flex flex-wrap gap-1 text-xs">
          {[["open", "Open"], ["overdue", "Overdue"], ["paid", "Paid"], ["commission", "Commission payable"], ["all", "All"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)} className={`rounded-full border px-2.5 py-1 ${statusFilter === k ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        {msg && <div className="text-sm text-gray-600">{msg}</div>}
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-6" /><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>Last reminder</TableHead><TableHead>Rep · commission</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={10} className="py-10 text-center text-sm text-gray-500">No invoices match.</TableCell></TableRow>}
            {filtered.map((inv) => {
              const late = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.remaining > 0;
              return (
                <>
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpen(open === inv.id ? null : inv.id)}>
                    <TableCell>{open === inv.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}</TableCell>
                    <TableCell><div className="font-mono text-sm text-gray-900">{inv.invoiceNumber}</div><div className="text-[11px] text-gray-400">{kindLabels[inv.kind] || inv.kind} · {formatDate(inv.createdAt)}</div></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}><div className="text-sm text-gray-900">{inv.companyId ? <a href={`/dashboard/customers/${inv.companyId}`} className="hover:text-brand-600 hover:underline">{inv.customerName}</a> : <span title="Not linked to a customer record">{inv.customerName}</span>}</div><div className="text-[11px] text-gray-400">{inv.contactEmail || "no email"}{!inv.companyId && <span className="text-amber-600"> · no customer link</span>}</div></TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(inv.total)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${inv.remaining > 0 ? "text-gray-900" : "text-gray-400"}`}>{formatCurrency(inv.remaining)}</TableCell>
                    <TableCell><span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[inv.status] || "bg-gray-100 text-gray-600"}`}>{statusLabels[inv.status] || inv.status}</span></TableCell>
                    <TableCell className={`text-sm ${late ? "text-red-600" : "text-gray-600"}`}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</TableCell>
                    <TableCell className="text-xs text-gray-500">{inv.remindedAt ? `${formatDate(inv.remindedAt)} (#${inv.remindCount})` : "none"}</TableCell>
                    <TableCell className="text-xs text-gray-600">{inv.salesRepName || "—"}{inv.commissionAmount ? <div className={inv.commissionStatus === "payable" ? "text-emerald-700" : inv.commissionStatus === "paid" ? "text-gray-400" : "text-gray-500"}>{formatCurrency(inv.commissionAmount)} · {inv.commissionStatus}</div> : null}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" title="Email the invoice with the pay link" disabled={!!busy} onClick={() => sendInvoice(inv)}>{busy === inv.id + "send_invoice" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}</Button>
                        <Button size="sm" variant="outline" title="Copy the pay link" onClick={() => copyLink(inv)}><Link2 className="h-3.5 w-3.5" /></Button>
                        {canMoney && inv.remaining > 0 && inv.status !== "cancelled" && <Button size="sm" variant="outline" title="Record a check, ACH or wire" onClick={() => setPay({ inv, amount: String(inv.remaining), method: "check", reference: "", receivedAt: new Date().toISOString().slice(0, 10) })}><Banknote className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  {open === inv.id && (
                    <TableRow key={inv.id + "-d"}><TableCell colSpan={10} className="bg-gray-50">
                      <div className="grid gap-4 p-2 text-sm md:grid-cols-3">
                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Payments</div>
                          {inv.payments.length === 0 ? <div className="text-gray-500">None yet.</div> : inv.payments.map((p) => (
                            <div key={p.id} className="flex justify-between border-b border-gray-100 py-1"><span>{formatDate(p.receivedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}<span className="text-gray-400"> · {p.recordedBy || ""}</span></span><span className="font-medium">{formatCurrency(p.amount)}</span></div>
                          ))}
                          {inv.depositAmount > 0 && <div className="mt-1 text-xs text-gray-500">Deposit {formatCurrency(inv.depositAmount)} {inv.depositPaid ? "received" : "not yet received"}.</div>}
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Details</div>
                          <div>{inv.description || "—"}</div>
                          <div className="text-xs text-gray-500">Subtotal {formatCurrency(inv.subtotal)} · tax {formatCurrency(inv.taxAmount)}</div>
                          {inv.payUrl && <div className="mt-1 truncate text-xs"><a href={inv.payUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{inv.payUrl}</a></div>}
                          {inv.notes && <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-gray-500">{inv.notes}</pre>}
                        </div>
                        {canMoney && (
                          <div className="flex flex-wrap content-start gap-2">
                            {inv.kind !== "final" && inv.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => act(inv, { action: "convert_to_final" }, "Converted to a final invoice")}>Convert to final invoice</Button>}
                            {inv.commissionStatus === "payable" && <Button size="sm" variant="outline" onClick={() => act(inv, { action: "commission_paid" }, "Commission marked paid")}>Commission paid to {inv.salesRepName}</Button>}
                            <label className="inline-flex items-center gap-1 text-xs text-gray-600">Due <input type="date" defaultValue={inv.dueDate ? inv.dueDate.slice(0, 10) : ""} onChange={(e) => act(inv, { action: "set_due", dueDate: e.target.value })} className="rounded border border-gray-300 px-1 py-0.5" /></label>
                            {inv.status !== "cancelled" && inv.remaining > 0 && <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm(`Cancel ${inv.invoiceNumber}?`)) act(inv, { action: "cancel" }, "Cancelled"); }}>Cancel invoice</Button>}
                          </div>
                        )}
                      </div>
                    </TableCell></TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {showNew && <NewInvoice onClose={() => setShowNew(false)} onCreated={(inv) => { setShowNew(false); setMsg(`${inv.invoiceNumber} created for ${inv.customerName}. Use the send button when it is ready.`); setStatusFilter("open"); load(); }} />}
      {pay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setPay(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Record a payment · {pay.inv.invoiceNumber}</h2><button onClick={() => setPay(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <p className="mt-1 text-xs text-gray-500">{pay.inv.customerName} · balance {formatCurrency(pay.inv.remaining)}. Stripe payments post on their own; use this for checks, ACH and wires that came to the bank.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <label className="block"><span className="text-gray-600">Amount</span><Input value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} inputMode="decimal" /></label>
              <label className="block"><span className="text-gray-600">Method</span><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-2 text-sm">{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="block"><span className="text-gray-600">Check # / reference</span><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
              <label className="block"><span className="text-gray-600">Received</span><Input type="date" value={pay.receivedAt} onChange={(e) => setPay({ ...pay, receivedAt: e.target.value })} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setPay(null)}>Cancel</Button><Button onClick={submitPayment} disabled={!!busy || !(Number(pay.amount) > 0)}>Record payment</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
