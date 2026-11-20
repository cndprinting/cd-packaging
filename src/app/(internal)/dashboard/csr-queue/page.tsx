"use client";

// CSR Job Queue (Benjy 11/18/26). Everything waiting to become a job ticket:
// won jobs sent from the Sales Pipeline, estimates forwarded to Jessica, and
// estimates a rep hands the CSR directly. Carrie's checklist on each one; the
// CSR creates the ticket, parks it while gathering info, or sends it back.
// Salespeople see what they sent and anything sent back to them.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Inbox, Upload, Send, Loader2, Copy } from "lucide-react";
import { ReorderDialog } from "@/components/jobs/reorder-dialog";
import { Button } from "@/components/ui/button";
import { JobIntake, type IntakePrefill } from "@/components/jobs/job-intake";
import { handoffToPrefill } from "@/components/jobs/handoff-queue";
import { ARTWORK, TERMS } from "@/components/jobs/shared";

type H = any;
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const ago = (d: string) => { const h = Math.round((Date.now() - new Date(d).getTime()) / 3600e3); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };
const label = (pairs: [string, string][], k: string) => pairs.find(([x]) => x === k)?.[1] || k || "-";

// Carrie's checklist, read off the handoff.
function checklist(h: H): [string, boolean][] {
  const list: [string, boolean][] = [
    ["Customer", !!(h.companyId || h.customerName)],
    ["Accepted estimate", !!(h.estimateNumber || h.estimateFileName)],
    ["Job, quantity, price", !!h.jobName && h.quantity > 0 && h.quotedPrice > 0],
    ["Artwork status", !!h.artworkStatus],
    ["Delivery address", !!h.deliveryAddress],
  ];
  if (h.newCustomer) list.push(["Billing contact, email, address", !!(h.billingContact && h.billingEmail && h.billingAddress)]);
  return list;
}

const TABS = [
  { key: "submitted", label: "New" },
  { key: "gathering", label: "Gathering info" },
  { key: "returned", label: "Sent back" },
  { key: "entered", label: "Done (30 days)" },
];

function Queue() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<H[] | null>(null);
  const [canEnter, setCanEnter] = useState(false);
  const [tab, setTab] = useState("submitted");
  const [open, setOpen] = useState<string | null>(null);
  const [intake, setIntake] = useState<{ mode: "handoff" | "job"; prefill: IntakePrefill } | null>(null);
  const [reorder, setReorder] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(null), 8000); };
  const load = () => fetch("/api/handoffs").then((r) => r.json()).then((d) => { setRows(d.handoffs || []); setCanEnter(!!d.canEnter); }).catch(() => setRows([]));
  useEffect(() => {
    load();
    // Opened from a won lead in the Sales Pipeline: start the handoff pre-filled.
    if (sp.get("handoff")) setIntake({ mode: "handoff", prefill: { leadId: sp.get("leadId") || undefined, companyId: sp.get("companyId") || undefined, customerName: sp.get("customer") || undefined, customerContact: sp.get("contact") || undefined, customerEmail: sp.get("email") || undefined } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const h of rows || []) c[h.status] = (c[h.status] || 0) + 1; return c; }, [rows]);
  const shown = (rows || []).filter((h) => h.status === tab);

  const act = async (h: H, action: "return" | "gather", prompt_: string) => {
    const text = prompt(prompt_);
    if (!text) return;
    const r = await fetch("/api/handoffs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: h.id, action, note: text }) });
    if (r.ok) { flash(action === "return" ? `Sent back to ${h.submittedByName}` : `Parked: ${h.customerName}`); load(); } else flash((await r.json()).error || "Could not save");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Inbox className="h-6 w-6 text-brand-600" />CSR Job Queue</h1>
          <p className="text-sm text-gray-500">{canEnter ? "Won jobs and estimates waiting to become job tickets." : "The won jobs you sent to Customer Service, and anything sent back to you."}</p>
        </div>
        <div className="flex gap-2">
          {canEnter && <Button variant="outline" onClick={() => setReorder(true)} className="gap-2"><Copy className="h-4 w-4" />Reorder a past job</Button>}
          {canEnter && <Button onClick={() => setIntake({ mode: "job", prefill: {} })} className="gap-2"><Upload className="h-4 w-4" />Upload an estimate</Button>}
          {!canEnter && <Button onClick={() => setIntake({ mode: "handoff", prefill: {} })} className="gap-2"><Send className="h-4 w-4" />Send a won job</Button>}
        </div>
      </div>
      {note && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</div>}

      <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
            {t.label} <span className="text-xs text-gray-400">{counts[t.key] || 0}</span>
          </button>
        ))}
      </div>

      {rows === null ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          {tab === "submitted" ? (canEnter ? "Nothing waiting. Won jobs from sales and estimates forwarded to Jessica with \"New job\" in the subject land here." : "Nothing waiting with Customer Service.") : "Nothing here."}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {shown.map((h) => {
            const checks = checklist(h); const missing = checks.filter(([, ok]) => !ok).length;
            return (
              <div key={h.id} className="p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setOpen(open === h.id ? null : h.id)} className="min-w-0 flex-1 text-left">
                    <div>
                      <span className="font-medium text-gray-900">{h.customerName}</span>
                      {h.newCustomer && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">new customer</span>}
                      {h.source === "email" && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] text-sky-800">forwarded estimate</span>}
                      <span className="text-gray-600"> · {h.jobName}{h.quantity ? ` · ${h.quantity.toLocaleString()}` : ""}{h.quotedPrice ? ` at ${money(h.quotedPrice)}` : ""}</span>
                    </div>
                    <div className="text-xs text-gray-400">From {h.submittedByName} · {ago(h.createdAt)}{h.estimateNumber ? ` · estimate ${h.estimateNumber}` : ""}{h.paymentTerms ? ` · rep says ${label(TERMS, h.paymentTerms)}` : ""}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">{checks.map(([l, ok]) => <span key={l} className={`inline-flex items-center gap-1 ${ok ? "text-emerald-700" : "text-amber-700"}`}>{ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}{l}</span>)}</div>
                    {h.intakeNote && h.status === "submitted" && <div className="mt-1 text-xs text-amber-700">{h.intakeNote}</div>}
                    {h.status === "gathering" && h.gatherNote && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Gathering: {h.gatherNote}{h.gatheringBy ? ` (${h.gatheringBy})` : ""}</div>}
                    {h.status === "returned" && h.returnedNote && <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Sent back by {h.handledByName}: {h.returnedNote}</div>}
                    {h.status === "entered" && <div className="mt-1 text-xs text-emerald-700">Entered by {h.handledByName || "CSR"}</div>}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {canEnter && ["submitted", "gathering"].includes(h.status) && <>
                      <Button size="sm" variant="outline" onClick={() => act(h, "return", `What's missing on ${h.customerName}, ${h.jobName}? This goes back to ${h.submittedByName}.`)}>Send back</Button>
                      {h.status === "submitted" && <Button size="sm" variant="outline" onClick={() => act(h, "gather", `What are you waiting on for ${h.customerName}? (e.g. billing info from the customer)`)}>Gathering info</Button>}
                      <Button size="sm" onClick={() => setIntake({ mode: "job", prefill: handoffToPrefill(h) })}>{missing ? `Create job ticket (${missing} missing)` : "Create job ticket"}</Button>
                    </>}
                    {!canEnter && h.status === "returned" && <Button size="sm" variant="outline" className="gap-1" onClick={() => setIntake({ mode: "handoff", prefill: { ...handoffToPrefill(h), handoffId: undefined } })}><Send className="h-3.5 w-3.5" />Fix and resend</Button>}
                  </div>
                </div>
                {open === h.id && (
                  <div className="mt-2 grid gap-2 rounded-md bg-gray-50 p-3 text-xs text-gray-700 md:grid-cols-2">
                    <div><b>Estimate</b> {h.estimateNumber || h.estimateFileName || "-"}{h.customerPO ? ` · PO ${h.customerPO}` : ""}{h.dueDate ? ` · due ${String(h.dueDate).slice(0, 10)}` : ""}</div>
                    <div><b>Artwork</b> {label(ARTWORK, h.artworkStatus)}{h.artworkNotes ? `: ${h.artworkNotes}` : ""}</div>
                    <div className="whitespace-pre-line"><b>Specs</b> {h.specs || "-"}</div>
                    <div className="whitespace-pre-line"><b>Deliver to</b> {h.deliveryAddress || "-"}{h.shippingNotes ? `\n${h.shippingNotes}` : ""}</div>
                    {h.newCustomer && <div className="whitespace-pre-line"><b>Billing</b> {[h.billingContact, h.billingEmail, h.billingPhone, h.billingAddress].filter(Boolean).join("\n") || "-"}{h.taxExempt ? "\nTax exempt" : ""}</div>}
                    {h.specialNotes && <div className="whitespace-pre-line"><b>Also agreed</b> {h.specialNotes}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reorder && <ReorderDialog onClose={() => setReorder(false)} />}
      {intake && <JobIntake mode={intake.mode} prefill={intake.prefill} onClose={() => setIntake(null)} onDone={(m) => { setIntake(null); flash(m); load(); }} />}
    </div>
  );
}

export default function CsrQueuePage() {
  return <Suspense fallback={null}><Queue /></Suspense>;
}
