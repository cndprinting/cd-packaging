"use client";

// One form for both ends of Carrie's step 3-4 (Benjy 11/17):
//  mode "handoff": a salesperson sends a won job to Customer Service. It can't
//                  be sent until her checklist is complete.
//  mode "job":     a CSR enters the job (fresh, or from a sales handoff).
// Either way it can start from Mary's estimate: AI reads it and fills the form.
import { useEffect, useMemo, useState } from "react";
import { Loader2, X, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARTWORK, CustomerPicker, EstimateReader, TERMS, areaCls, inputCls, type Cust, type EstimateRead, type Rep } from "./shared";

export type IntakePrefill = Partial<{
  handoffId: string; leadId: string; companyId: string; customerName: string; customerEmail: string; customerContact: string; customerAddress: string;
  newCustomer: boolean; billingContact: string; billingEmail: string; billingPhone: string; billingAddress: string; taxExempt: boolean;
  estimateNumber: string; estimateFileName: string; jobName: string; specs: string; quantity: string; quotedPrice: string; productType: string;
  customerPO: string; dueDate: string; salesRepId: string; artworkStatus: string; artworkNotes: string; paymentTerms: string;
  deliveryAddress: string; shippingNotes: string; specialNotes: string;
}>;

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function JobIntake({ mode, prefill = {}, onClose, onDone }: { mode: "handoff" | "job"; prefill?: IntakePrefill; onClose: () => void; onDone: (msg: string) => void }) {
  const [f, setF] = useState({
    companyId: prefill.companyId || "", customerName: prefill.customerName || "", newCustomer: !!prefill.newCustomer,
    billingContact: prefill.billingContact || prefill.customerContact || "", billingEmail: prefill.billingEmail || prefill.customerEmail || "", billingPhone: prefill.billingPhone || "", billingAddress: prefill.billingAddress || "", taxExempt: !!prefill.taxExempt,
    estimateNumber: prefill.estimateNumber || "", estimateFileName: prefill.estimateFileName || "", jobName: prefill.jobName || "", specs: prefill.specs || "",
    quantity: prefill.quantity || "", quotedPrice: prefill.quotedPrice || "", productType: prefill.productType || "FOLDING_CARTON", customerPO: prefill.customerPO || "",
    dueDate: prefill.dueDate || "", salesRepId: prefill.salesRepId || "", artworkStatus: prefill.artworkStatus || "", artworkNotes: prefill.artworkNotes || "",
    paymentTerms: prefill.paymentTerms || "deposit50", deliveryAddress: prefill.deliveryAddress || prefill.customerAddress || "", shippingNotes: prefill.shippingNotes || "", specialNotes: prefill.specialNotes || "",
    jobNumber: "", priority: "NORMAL", estimatedHours: "",
  });
  const [reps, setReps] = useState<Rep[]>([]);
  const [read, setRead] = useState<EstimateRead | null>(null);
  const [matches, setMatches] = useState<Cust[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  // Reps for the dropdown, even when the customer is already filled in.
  useEffect(() => { fetch("/api/payments/customers?q=%23%23none%23%23").then((r) => r.json()).then((d) => { if (d.reps) setReps(d.reps); }).catch(() => {}); }, []);

  const pickCustomer = (c: Cust) => setF((p) => ({ ...p, companyId: c.id, customerName: c.name, newCustomer: false, billingEmail: p.billingEmail || c.email || "", billingContact: p.billingContact || c.contact || "", deliveryAddress: p.deliveryAddress || c.address || "" }));

  const onRead = (r: EstimateRead, m: Cust[], fileName: string) => {
    setRead(r); setMatches(m);
    const tier = r.quantities.length === 1 ? r.quantities[0] : null;
    const specs = [r.specs, r.dieNumber ? `Die ${r.dieNumber}` : null, r.notes ? `Estimate notes: ${r.notes}` : null].filter(Boolean).join("\n");
    const rep = r.salesRep ? reps.find((x) => x.name.toLowerCase().includes(r.salesRep!.toLowerCase().split(/\s+/)[0])) : null;
    setF((p) => ({
      ...p, estimateFileName: fileName, estimateNumber: r.estimateNumber || p.estimateNumber, jobName: r.jobName || p.jobName, specs: specs || p.specs,
      productType: r.productType || p.productType, quantity: tier ? String(tier.quantity) : p.quantity, quotedPrice: tier?.price ? String(tier.price) : p.quotedPrice,
      salesRepId: p.salesRepId || rep?.id || "", billingContact: p.billingContact || r.contactName || "",
    }));
    if (!f.companyId && m.length === 1) pickCustomer(m[0]);
    else if (!f.companyId && m.length === 0 && r.customerName) setF((p) => ({ ...p, customerName: r.customerName || "", newCustomer: true }));
  };

  // Carrie's checklist, live.
  const checks = useMemo(() => {
    const email = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(f.billingEmail.trim());
    const list: [string, boolean][] = [
      ["Customer", !!f.companyId || (f.newCustomer && !!f.customerName.trim())],
      ["Accepted estimate", !!f.estimateNumber.trim() || !!f.estimateFileName],
      ["Job name, quantity and price", !!f.jobName.trim() && Number(f.quantity) > 0 && Number(f.quotedPrice) > 0],
      ["Artwork status", !!f.artworkStatus],
      ["Payment terms", !!f.paymentTerms],
      ["Delivery address", !!f.deliveryAddress.trim()],
    ];
    if (f.newCustomer) list.push(["New customer billing info", !!f.billingContact.trim() && email && !!f.billingAddress.trim()]);
    return list;
  }, [f]);
  const ready = mode === "handoff" ? checks.every(([, ok]) => ok) : (!!f.companyId || (f.newCustomer && !!f.customerName.trim())) && !!f.jobName.trim() && Number(f.quantity) > 0;

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      let r: Response;
      if (mode === "handoff") {
        r = await fetch("/api/handoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, leadId: prefill.leadId || null, estimateRead: read }) });
      } else {
        const notes = [f.artworkNotes && `Artwork: ${f.artworkNotes}`, f.specialNotes && `Special instructions: ${f.specialNotes}`].filter(Boolean).join("\n");
        r = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          name: f.jobName, description: f.specs, quantity: f.quantity, dueDate: f.dueDate || null, priority: f.priority, productType: f.productType,
          estimatedHours: f.estimatedHours || null, jobNumber: f.jobNumber || null, estimateNumber: f.estimateNumber, customerPO: f.customerPO,
          quotedPrice: f.quotedPrice, salesRepId: f.salesRepId || null, paymentTerms: f.paymentTerms, artworkStatus: f.artworkStatus || null,
          deliveryTo: [f.deliveryAddress, f.shippingNotes && `Shipping: ${f.shippingNotes}`].filter(Boolean).join("\n"), generalNotes: notes,
          contactName: f.billingContact, taxExempt: f.taxExempt, billingEmail: f.billingEmail, handoffId: prefill.handoffId || null,
          companyId: f.newCustomer ? null : f.companyId, newCustomer: f.newCustomer ? { name: f.customerName, contact: f.billingContact, email: f.billingEmail, phone: f.billingPhone, address: f.billingAddress } : null,
        }) });
      }
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save"); return; }
      onDone(mode === "handoff" ? `Sent to Customer Service: ${f.customerName}, ${f.jobName}` : `Job ${d.job.jobNumber} entered for ${d.job.companyName}.${d.depositInvoice ? ` Deposit invoice ${d.depositInvoice} drafted for accounting.` : ""}`);
    } catch { setErr("Could not save"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{mode === "handoff" ? "Send a won job to Customer Service" : prefill.handoffId ? "Enter job from sales handoff" : "New job"}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div className="mt-3"><EstimateReader onRead={onRead} /></div>
        {read && read.quantities.length > 1 && (
          <div className="mt-2 rounded-md bg-amber-50 p-2 text-sm">
            <div className="text-gray-700">The estimate has {read.quantities.length} quantities. Which one did the customer accept?</div>
            <div className="mt-1 flex flex-wrap gap-2">{read.quantities.map((q, i) => (
              <button key={i} type="button" onClick={() => setF((p) => ({ ...p, quantity: String(q.quantity), quotedPrice: q.price ? String(q.price) : p.quotedPrice }))} className={`rounded-full border px-2.5 py-1 text-xs ${String(q.quantity) === f.quantity ? "border-brand-600 bg-white text-brand-700" : "border-gray-300 bg-white text-gray-700"}`}>{q.quantity.toLocaleString()}{q.price ? ` · ${money(q.price)}` : ""}</button>
            ))}</div>
          </div>
        )}

        <div className="mt-4 grid gap-4 text-sm md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            {/* Customer */}
            <div>
              <div className="text-gray-600">Customer</div>
              {f.companyId ? (
                <div className="mt-1 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"><span className="font-medium">{f.customerName}</span><button type="button" onClick={() => set("companyId", "")} className="text-xs text-brand-600 hover:underline">Change</button></div>
              ) : f.newCustomer ? (
                <div className="mt-1 space-y-2 rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase text-gray-500">New customer setup</span><button type="button" onClick={() => set("newCustomer", false)} className="text-xs text-brand-600 hover:underline">Pick existing instead</button></div>
                  <Input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="Company name" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={f.billingContact} onChange={(e) => set("billingContact", e.target.value)} placeholder="Billing contact" />
                    <Input value={f.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} placeholder="Billing email" />
                    <Input value={f.billingPhone} onChange={(e) => set("billingPhone", e.target.value)} placeholder="Phone" />
                    <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={f.taxExempt} onChange={(e) => set("taxExempt", e.target.checked)} />Tax exempt (resale cert)</label>
                  </div>
                  <textarea value={f.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} rows={2} className={areaCls} placeholder={"Billing address\nCity, ST 12345"} />
                </div>
              ) : (
                <div className="mt-1">
                  {matches.length > 1 && <div className="mb-2 flex flex-wrap gap-1 text-xs">Looks like: {matches.map((m) => <button key={m.id} type="button" onClick={() => pickCustomer(m)} className="rounded-full border border-brand-300 px-2 py-0.5 text-brand-700 hover:bg-brand-50">{m.name}</button>)}</div>}
                  <CustomerPicker onPick={pickCustomer} onReps={setReps} initialQuery={read?.customerName?.split(/\s+/)[0] || ""} />
                  <button type="button" onClick={() => set("newCustomer", true)} className="mt-1 text-xs text-brand-600 hover:underline">New customer? Set them up here</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 block"><span className="text-gray-600">Job name</span><Input value={f.jobName} onChange={(e) => set("jobName", e.target.value)} placeholder="e.g. Chunks o Fruti 6-pack carton" /></label>
              <label className="block"><span className="text-gray-600">Mary's estimate #</span><Input value={f.estimateNumber} onChange={(e) => set("estimateNumber", e.target.value)} autoComplete="off" /></label>
              <label className="block"><span className="text-gray-600">Customer PO #</span><Input value={f.customerPO} onChange={(e) => set("customerPO", e.target.value)} autoComplete="off" /></label>
              <label className="block"><span className="text-gray-600">Quantity</span><Input value={f.quantity} onChange={(e) => set("quantity", e.target.value)} inputMode="numeric" /></label>
              <label className="block"><span className="text-gray-600">Accepted price (total)</span><Input value={f.quotedPrice} onChange={(e) => set("quotedPrice", e.target.value)} inputMode="decimal" placeholder="0.00" /></label>
              <label className="block"><span className="text-gray-600">Product</span><select value={f.productType} onChange={(e) => set("productType", e.target.value)} className={inputCls}><option value="FOLDING_CARTON">Folding carton</option><option value="COMMERCIAL_PRINT">Commercial print</option></select></label>
              <label className="block"><span className="text-gray-600">Due date</span><Input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Specs</span><textarea value={f.specs} onChange={(e) => set("specs", e.target.value)} rows={4} className={areaCls} placeholder="Size, stock, inks, coating, die, finishing" /></label>
              <label className="block"><span className="text-gray-600">Artwork</span><select value={f.artworkStatus} onChange={(e) => set("artworkStatus", e.target.value)} className={inputCls}><option value="">Choose...</option>{ARTWORK.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="block"><span className="text-gray-600">Payment terms</span><select value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} className={inputCls}>{TERMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="col-span-2 block"><span className="text-gray-600">Artwork notes</span><Input value={f.artworkNotes} onChange={(e) => set("artworkNotes", e.target.value)} placeholder="Where the files are, or what's coming" /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Deliver to</span><textarea value={f.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} rows={2} className={areaCls} /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Shipping instructions</span><Input value={f.shippingNotes} onChange={(e) => set("shippingNotes", e.target.value)} placeholder="Dock hours, liftgate, split shipments" /></label>
              <label className="col-span-2 block"><span className="text-gray-600">Anything else agreed with the customer</span><textarea value={f.specialNotes} onChange={(e) => set("specialNotes", e.target.value)} rows={2} className={areaCls} /></label>
              <label className="block"><span className="text-gray-600">Sales rep</span><select value={f.salesRepId} onChange={(e) => set("salesRepId", e.target.value)} className={inputCls}><option value="">{mode === "handoff" ? "Me" : "None / house"}</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              {mode === "job" && <>
                <label className="block"><span className="text-gray-600">Job # <span className="text-gray-400">(FileMaker #, or blank)</span></span><Input value={f.jobNumber} onChange={(e) => set("jobNumber", e.target.value)} autoComplete="off" /></label>
                <label className="block"><span className="text-gray-600">Priority</span><select value={f.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
                <label className="block"><span className="text-gray-600">Estimated hours <span className="text-gray-400">(optional)</span></span><Input value={f.estimatedHours} onChange={(e) => set("estimatedHours", e.target.value)} inputMode="decimal" /></label>
              </>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md bg-gray-50 p-3">
              <div className="text-xs font-medium uppercase text-gray-500">{mode === "handoff" ? "Before it can go to CSR" : "Checklist"}</div>
              <ul className="mt-2 space-y-1">{checks.map(([label, ok]) => <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-700" : "text-gray-500"}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}{label}</li>)}</ul>
            </div>
            {mode === "job" && f.paymentTerms !== "net30" && f.paymentTerms !== "cod" && Number(f.quotedPrice) > 0 && <div className="rounded-md bg-sky-50 p-3 text-xs text-sky-900">Entering this job drafts the {f.paymentTerms === "prepaid" ? "prepaid" : "50% deposit"} invoice for accounting. It can't go to press until that's paid and a proof is approved.</div>}
            {err && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{err}</div>}
            <Button className="w-full" onClick={submit} disabled={busy || !ready}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "handoff" ? "Send to Customer Service" : "Enter job"}</Button>
            <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
