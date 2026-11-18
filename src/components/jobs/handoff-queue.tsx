"use client";

// Sales handoffs waiting on Customer Service (Benjy 11/17). CSRs enter a job in
// one click (the form opens already filled in) or send it back with a note.
// Salespeople see their own handoffs and why one came back.
import { useEffect, useState } from "react";
import { Inbox, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ARTWORK, TERMS } from "./shared";
import type { IntakePrefill } from "./job-intake";

type Handoff = any;
const label = (pairs: [string, string][], k: string) => pairs.find(([x]) => x === k)?.[1] || k;
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const ago = (d: string) => { const h = Math.round((Date.now() - new Date(d).getTime()) / 3600e3); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

export function handoffToPrefill(h: Handoff): IntakePrefill {
  return {
    handoffId: h.id, leadId: h.leadId || undefined, companyId: h.companyId || undefined, customerName: h.customerName, newCustomer: h.newCustomer && !h.companyId,
    billingContact: h.billingContact || "", billingEmail: h.billingEmail || "", billingPhone: h.billingPhone || "", billingAddress: h.billingAddress || "", taxExempt: h.taxExempt,
    estimateNumber: h.estimateNumber || "", estimateFileName: h.estimateFileName || "", jobName: h.jobName, specs: h.specs || "",
    quantity: h.quantity ? String(h.quantity) : "", quotedPrice: h.quotedPrice ? String(h.quotedPrice) : "", productType: h.productType || "FOLDING_CARTON",
    customerPO: h.customerPO || "", dueDate: h.dueDate ? String(h.dueDate).slice(0, 10) : "", salesRepId: h.salesRepId || "",
    artworkStatus: h.artworkStatus, artworkNotes: h.artworkNotes || "", paymentTerms: h.paymentTerms, deliveryAddress: h.deliveryAddress,
    shippingNotes: h.shippingNotes || "", specialNotes: h.specialNotes || "",
  };
}

export function HandoffQueue({ reloadKey, onEnter, onResend, flash }: { reloadKey: number; onEnter: (p: IntakePrefill) => void; onResend: (p: IntakePrefill) => void; flash: (t: string) => void }) {
  const [rows, setRows] = useState<Handoff[]>([]);
  const [canEnter, setCanEnter] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => fetch("/api/handoffs").then((r) => r.json()).then((d) => { setRows(d.handoffs || []); setCanEnter(!!d.canEnter); }).catch(() => {});
  useEffect(() => { load(); }, [reloadKey]);

  const waiting = rows.filter((h) => h.status === "submitted");
  const returned = rows.filter((h) => h.status === "returned");
  const shown = canEnter ? waiting : rows.filter((h) => h.status !== "entered").concat(rows.filter((h) => h.status === "entered").slice(0, 5));
  if (!shown.length) return null;

  const sendBack = async (h: Handoff) => {
    const note = prompt(`What's missing on ${h.customerName}, ${h.jobName}? This goes back to ${h.submittedByName}.`);
    if (!note) return;
    const r = await fetch("/api/handoffs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: h.id, action: "return", note }) });
    if (r.ok) { flash(`Sent back to ${h.submittedByName}`); load(); } else flash((await r.json()).error || "Could not send it back");
  };

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
        <Inbox className="h-4 w-4 text-brand-600" />{canEnter ? `From sales, waiting to be entered (${waiting.length})` : `My handoffs to Customer Service${returned.length ? ` · ${returned.length} sent back` : ""}`}
      </div>
      <div className="divide-y divide-gray-100">
        {shown.map((h) => (
          <div key={h.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setOpen(open === h.id ? null : h.id)} className="text-left">
                <span className="font-medium text-gray-900">{h.customerName}</span>{h.newCustomer && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">new customer</span>}
                <span className="text-gray-600"> · {h.jobName} · {h.quantity?.toLocaleString()} at {money(h.quotedPrice || 0)}</span>
                <div className="text-xs text-gray-400">{h.submittedByName} · {ago(h.createdAt)} · {label(TERMS, h.paymentTerms)}{h.status === "entered" ? " · entered" : ""}</div>
              </button>
              {canEnter && h.status === "submitted" && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => sendBack(h)}>Send back</Button><Button size="sm" onClick={() => onEnter(handoffToPrefill(h))}>Enter job</Button></div>}
              {!canEnter && h.status === "returned" && <Button size="sm" variant="outline" className="gap-1" onClick={() => onResend({ ...handoffToPrefill(h), handoffId: undefined })}><Send className="h-3.5 w-3.5" />Fix and resend</Button>}
            </div>
            {h.status === "returned" && h.returnedNote && <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Sent back by {h.handledByName}: {h.returnedNote}</div>}
            {open === h.id && (
              <div className="mt-2 grid gap-2 rounded-md bg-gray-50 p-3 text-xs text-gray-700 md:grid-cols-2">
                <div><b>Estimate</b> {h.estimateNumber || h.estimateFileName || "-"}{h.customerPO ? ` · PO ${h.customerPO}` : ""}{h.dueDate ? ` · due ${String(h.dueDate).slice(0, 10)}` : ""}</div>
                <div><b>Artwork</b> {label(ARTWORK, h.artworkStatus)}{h.artworkNotes ? `: ${h.artworkNotes}` : ""}</div>
                <div className="whitespace-pre-line"><b>Specs</b> {h.specs || "-"}</div>
                <div className="whitespace-pre-line"><b>Deliver to</b> {h.deliveryAddress}{h.shippingNotes ? `\n${h.shippingNotes}` : ""}</div>
                {h.newCustomer && <div className="whitespace-pre-line"><b>Billing</b> {[h.billingContact, h.billingEmail, h.billingPhone, h.billingAddress].filter(Boolean).join("\n")}{h.taxExempt ? "\nTax exempt" : ""}</div>}
                {h.specialNotes && <div className="whitespace-pre-line"><b>Also agreed</b> {h.specialNotes}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
