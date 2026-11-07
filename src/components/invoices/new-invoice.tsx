"use client";

// New invoice (Benjy 11/7/26). The customer is picked from the Customers
// module (or created there on the spot), so invoices, jobs, portal logins and
// the CRM all point at one record. Picking a job prefills the amount and rep.
import { useEffect, useState } from "react";
import { Loader2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Job = { id: string; jobNumber: string; name: string | null; quotedPrice: number | null; status: string; rep: string | null };
type Cust = { id: string; name: string; where: string; email: string | null; contact: string | null; jobs: Job[] };
const inputCls = "mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none";

export function NewInvoice({ onClose, onCreated }: { onClose: () => void; onCreated: (inv: any) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Cust[]>([]);
  const [searching, setSearching] = useState(false);
  const [cust, setCust] = useState<Cust | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [jobId, setJobId] = useState("");
  const [kind, setKind] = useState("final");
  const [description, setDescription] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [depositPercent, setDepositPercent] = useState("50");
  const [dueDate, setDueDate] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (cust) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await fetch(`/api/payments/customers?q=${encodeURIComponent(q)}`); const d = await r.json(); setList(d.customers || []); } catch { /* ignore */ }
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, cust]);

  const pick = (c: Cust) => { setCust(c); setEmail(c.email || ""); setJobId(""); };
  const pickJob = (id: string) => {
    setJobId(id);
    const j = cust?.jobs.find((x) => x.id === id);
    if (j) { if (j.quotedPrice && !subtotal) setSubtotal(String(j.quotedPrice)); if (!description) setDescription(`Job ${j.jobNumber}${j.name ? ` · ${j.name}` : ""}`); }
  };
  const createCustomer = async () => {
    if (!newName.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not create the customer"); return; }
      pick({ id: d.company.id, name: d.company.name, where: "", email: null, contact: null, jobs: [] });
      setCreating(false);
    } catch { setErr("Could not create the customer"); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!cust) { setErr("Pick a customer first"); return; }
    const sub = Number(subtotal);
    if (!(sub > 0)) { setErr("Amount is required"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_invoice", companyId: cust.id, customerName: cust.name, contactEmail: email || null, jobId: jobId || null, kind, description, subtotal: sub, taxExempt, depositPercent: Number(depositPercent) || 0, dueDate: dueDate || null }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not create the invoice"); return; }
      onCreated(d.invoice);
    } catch { setErr("Could not create the invoice"); }
    finally { setBusy(false); }
  };
  const sub = Number(subtotal) || 0, tax = taxExempt ? 0 : Math.round(sub * 7) / 100, total = Math.round((sub + tax) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">New invoice</h2><button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button></div>

        {/* Step 1: customer from the Customers module */}
        {!cust ? (
          <div className="mt-3">
            <label className="text-sm text-gray-600">Customer <span className="text-gray-400">(from Customers; one record for CRM, jobs, portal and invoices)</span></label>
            {!creating ? (<>
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing the customer name" />
              <div className="mt-2 max-h-56 overflow-auto rounded-md border border-gray-200">
                {searching && <div className="p-2 text-xs text-gray-400"><Loader2 className="inline h-3 w-3 animate-spin" /> Searching…</div>}
                {list.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c)} className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50">
                    <span><span className="font-medium text-gray-900">{c.name}</span>{c.where && <span className="text-gray-400"> · {c.where}</span>}</span>
                    <span className="text-xs text-gray-400">{c.email || "no email"}{c.jobs.length ? ` · ${c.jobs.length} jobs` : ""}</span>
                  </button>
                ))}
                {!searching && list.length === 0 && <div className="p-3 text-sm text-gray-500">No customer matches "{q}".</div>}
              </div>
              <button type="button" onClick={() => { setCreating(true); setNewName(q); }} className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" />Not there? Create a new customer record</button>
            </>) : (
              <div className="mt-1 flex gap-2">
                <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Exact company name" />
                <Button onClick={createCustomer} disabled={busy || !newName.trim()}>Create customer</Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Back</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <div><span className="font-medium text-gray-900">{cust.name}</span>{cust.where && <span className="text-gray-400"> · {cust.where}</span>}<div className="text-xs text-gray-500">Linked to the customer record. <a href={`/dashboard/customers/${cust.id}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open customer</a></div></div>
              <button type="button" onClick={() => setCust(null)} className="text-xs text-brand-600 hover:underline">Change</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 block"><span className="text-gray-600">Job (optional, prefills the amount and the rep's commission)</span>
                <select value={jobId} onChange={(e) => pickJob(e.target.value)} className={inputCls}>
                  <option value="">No job</option>
                  {cust.jobs.map((j) => <option key={j.id} value={j.id}>{j.jobNumber} · {j.name || "untitled"}{j.quotedPrice ? ` · $${j.quotedPrice.toLocaleString()}` : ""}{j.rep ? ` · ${j.rep}` : ""} ({j.status.toLowerCase().replace(/_/g, " ")})</option>)}
                </select></label>
              <label className="block"><span className="text-gray-600">Type</span>
                <select value={kind} onChange={(e) => { setKind(e.target.value); if (e.target.value === "deposit") setDepositPercent("100"); }} className={inputCls}>
                  <option value="final">Final invoice</option><option value="prebill">Prebill (job not complete)</option><option value="deposit">Deposit request</option>
                </select></label>
              <label className="block"><span className="text-gray-600">Send to (billing email)</span><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ap@customer.com" /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Description</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this bills for" /></label>
              <label className="block"><span className="text-gray-600">Amount before tax</span><Input value={subtotal} onChange={(e) => setSubtotal(e.target.value)} inputMode="decimal" placeholder="0.00" /></label>
              <label className="block"><span className="text-gray-600">Deposit %</span><Input value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} inputMode="numeric" /></label>
              <label className="block"><span className="text-gray-600">Due date</span><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /><span className="text-[11px] text-gray-400">Blank = Net 30 (7 days for deposits and prebills)</span></label>
              <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} /> <span className="text-gray-600">Tax exempt (resale certificate on file)</span></label>
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">Subtotal ${sub.toFixed(2)} · tax ${tax.toFixed(2)} · <span className="font-medium">total ${total.toFixed(2)}</span>{Number(depositPercent) > 0 && Number(depositPercent) < 100 ? ` · deposit $${(total * Number(depositPercent) / 100).toFixed(2)}` : ""}</div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invoice"}</Button></div>
            <div className="text-[11px] text-gray-400">Creating does not email anyone. Use the send button on the invoice when it is ready.</div>
          </div>
        )}
        {err && !cust && <div className="mt-2 text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}
