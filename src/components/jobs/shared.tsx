"use client";

// Shared pieces for New Job and the sales handoff (Benjy 11/17): pick the
// customer from the Customers list, and let AI read Mary's estimate.
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

export type Cust = { id: string; name: string; where?: string; email: string | null; contact: string | null; address?: string | null; terms?: string | null; termsBy?: string | null; termsAt?: string | null };
export type Rep = { id: string; name: string };
export type EstimateRead = {
  customerName: string | null; contactName: string | null; estimateNumber: string | null; estimateDate: string | null; salesRep: string | null;
  jobName: string | null; productType: "FOLDING_CARTON" | "COMMERCIAL_PRINT" | null; quantities: { quantity: number; price: number | null }[];
  specs: string | null; dieNumber: string | null; notes: string | null;
};

export const TERMS: [string, string][] = [
  ["deposit50", "50% deposit, balance before delivery"],
  ["prepaid", "Prepaid in full before press"],
  ["net30", "Net 30 (approved credit)"],
  ["cod", "COD, paid on delivery"],
];
export const ARTWORK: [string, string][] = [
  ["ready", "Print-ready art is in hand"],
  ["coming", "Customer is sending art"],
  ["design", "We're designing it"],
  ["reprint", "Exact reprint, no art changes"],
];
export const inputCls = "mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none";
export const areaCls = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

export function CustomerPicker({ onPick, onReps, initialQuery = "" }: { onPick: (c: Cust) => void; onReps?: (r: Rep[]) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [list, setList] = useState<Cust[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      try { const r = await fetch(`/api/payments/customers?q=${encodeURIComponent(q)}`); const d = await r.json(); setList(d.customers || []); setTotal(d.total || 0); if (d.reps && onReps) onReps(d.reps); } catch { /* ignore */ }
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing the customer name" autoComplete="off" />
      <div className="mt-1 text-[11px] text-gray-400">{busy ? "Searching..." : total > list.length ? `Showing ${list.length} of ${total.toLocaleString()} customers. Keep typing.` : `${total.toLocaleString()} match${total === 1 ? "" : "es"}`}</div>
      <div className="mt-1 max-h-48 overflow-auto rounded-md border border-gray-200">
        {list.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c)} className="flex w-full justify-between border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50">
            <span className="font-medium text-gray-900">{c.name}{c.where && <span className="font-normal text-gray-400"> · {c.where}</span>}</span>
            <span className="text-xs text-gray-400">{c.email || ""}</span>
          </button>
        ))}
        {!busy && list.length === 0 && <div className="p-3 text-sm text-gray-500">No match for "{q}".</div>}
      </div>
    </div>
  );
}

/** Drop Mary's estimate (PDF or photo), or paste its text; AI fills the form. */
export function EstimateReader({ onRead }: { onRead: (r: EstimateRead, matches: Cust[], fileName: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async (body: Record<string, unknown>, name: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/handoffs/read-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't read it"); return; }
      onRead(d.read, d.customerMatches || [], name); setDone(name);
    } catch { setErr("Couldn't read it. Fill in the fields by hand."); }
    finally { setBusy(false); }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setErr("That file is over 4 MB. Try the PDF straight from E&M."); return; }
    const buf = await f.arrayBuffer();
    let bin = ""; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    await send({ base64: btoa(bin), mediaType: f.type || "application/pdf" }, f.name);
  };

  return (
    <div className="rounded-md border border-dashed border-brand-300 bg-brand-50/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <span className="font-medium text-gray-900">Start from Mary's estimate</span>
        <span className="text-gray-500">and Godzilla fills in the rest.</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? "Reading the estimate..." : "Attach estimate (PDF or photo)"}
        </button>
        <button type="button" onClick={() => setPaste(!paste)} className="text-xs text-brand-600 hover:underline">or paste the estimate text</button>
        {done && !busy && <span className="text-xs text-emerald-700">Read {done}. Check the fields below.</span>}
      </div>
      {paste && (
        <div className="mt-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={areaCls} placeholder="Paste the estimate from Mary's email" />
          <button type="button" disabled={busy || !text.trim()} onClick={() => send({ text }, "pasted text")} className="mt-1 rounded-md bg-gray-900 px-3 py-1 text-xs text-white disabled:opacity-40">Read it</button>
        </div>
      )}
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
    </div>
  );
}
