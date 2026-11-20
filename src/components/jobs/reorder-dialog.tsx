"use client";

// Reorder / duplicate a past job (Kelsey 11/20/26): "for an existing customer we
// usually duplicate a job" - find the customer's last one, give the new FileMaker
// job #, quantity, due date and price, and the whole ticket carries over.
import { useEffect, useState } from "react";
import { Loader2, Search, X, Copy } from "lucide-react";

type Src = { id: string; jobNumber: string; name: string; companyName: string; quantity: number; dueDate?: string };
const inp = "mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm";

export function ReorderDialog({ source, onClose }: { source?: Src | null; onClose: () => void }) {
  const [src, setSrc] = useState<Src | null>(source || null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Src[]>([]);
  const [searching, setSearching] = useState(false);
  const [f, setF] = useState({ jobNumber: "", quantity: "", dueDate: "", quotedPrice: "", jobType: "EXACT_REPRINT" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (src) setF((p) => ({ ...p, quantity: String(src.quantity || "") })); }, [src]);
  useEffect(() => {
    if (src || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await fetch(`/api/jobs/search?q=${encodeURIComponent(q.trim())}`); const d = await r.json(); setHits(d.jobs || []); } catch { setHits([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, src]);
  const go = async () => {
    if (!src) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/jobs/${src.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not copy the job"); setBusy(false); return; }
      window.location.href = `/dashboard/jobs/${d.job.id}`;
    } catch { setErr("Could not copy the job"); setBusy(false); }
  };
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Reorder a past job" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Reorder a past job</h2><button aria-label="Close" onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button></div>
        {!src ? (
          <div className="mt-3">
            <label className="block text-sm text-gray-600">Find the job to copy <span className="text-gray-400">(customer, job #, job name, die #...)</span>
              <div className="relative mt-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm" placeholder="e.g. Florida Nutrition" /></div>
            </label>
            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-gray-200">
              {searching && <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>}
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => setSrc(h)} className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <span><span className="font-mono text-xs text-gray-500">{h.jobNumber}</span> <b className="text-gray-900">{h.companyName}</b><br /><span className="text-gray-700">{h.name}</span></span>
                  <span className="shrink-0 text-xs text-gray-500">{(h.quantity || 0).toLocaleString()}{h.dueDate ? ` · ${h.dueDate}` : ""}</span>
                </button>
              ))}
              {!searching && q.trim().length >= 2 && !hits.length && <div className="p-3 text-sm text-gray-500">No jobs found. If it&apos;s a FileMaker-only job, enter it as a new job and put the old job # in &quot;Last Job #&quot;.</div>}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-md bg-gray-50 p-3">Copying <span className="font-mono">{src.jobNumber}</span> · <b>{src.companyName}</b> · {src.name}
              {!source && <button type="button" onClick={() => setSrc(null)} className="ml-2 text-xs text-brand-700 hover:underline">pick another</button>}
              <div className="mt-1 text-xs text-gray-500">Everything on the ticket carries over: specs, versions, stock, bindery, delivery, notes, proofs, terms. Change what&apos;s different after it opens.</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="text-gray-600">New job # <span className="text-gray-400">(FileMaker #)</span></span><input value={f.jobNumber} onChange={(e) => set("jobNumber", e.target.value)} className={inp} placeholder="e.g. 263720" /></label>
              <label className="block"><span className="text-gray-600">Quantity</span><input value={f.quantity} onChange={(e) => set("quantity", e.target.value)} inputMode="numeric" className={inp} /></label>
              <label className="block"><span className="text-gray-600">Due date</span><input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={inp} /></label>
              <label className="block"><span className="text-gray-600">Sell price</span><input value={f.quotedPrice} onChange={(e) => set("quotedPrice", e.target.value)} inputMode="decimal" className={inp} placeholder="$" /></label>
              <label className="block sm:col-span-2"><span className="text-gray-600">Type</span>
                <select value={f.jobType} onChange={(e) => set("jobType", e.target.value)} className={inp}>
                  <option value="EXACT_REPRINT">Exact reprint</option><option value="REPRINT_WITH_CHANGES">Reprint with changes</option><option value="REPRINT_NEW_FILE">Reprint, new file supplied</option>
                </select></label>
            </div>
            {err && <div className="rounded-md bg-red-50 px-3 py-2 text-red-700">{err}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="button" disabled={busy} onClick={go} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Create the new job</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
