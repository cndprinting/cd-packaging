"use client";

// Fields from C&D's FileMaker job ticket that Godzilla didn't have yet
// (Darrin's sample ticket #263686, 11/20/26). They print in the same spots
// on the ticket: Customer # / Rep job # / due TIME / partials in the header,
// the Proofs + MAILS box, the Size / Quantity / Stock rows, the samples count,
// and the text on each bindery line ("Wrap: 100'S").
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

type Stock = { size: string; qty: string; description: string; detail: string };
const inp = "h-9 w-full rounded-md border border-gray-300 px-2 text-sm focus:border-brand-500 focus:outline-none";
const lab = "block text-xs font-medium uppercase tracking-wide text-gray-500";
const day = (v: any) => (v ? String(v).slice(0, 10) : "");

async function save(jobId: string, body: Record<string, unknown>) {
  try { await fetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch {}
}
function useJob(jobId: string) {
  const [j, setJ] = useState<any>(null);
  useEffect(() => { fetch(`/api/jobs/${jobId}`).then((r) => r.json()).then((d) => d.job && setJ(d.job)).catch(() => {}); }, [jobId]);
  return j;
}

function Field({ label, value, onSave, type = "text", placeholder }: { label: string; value: any; onSave: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className={lab}>{label}</span>
      <input type={type} defaultValue={value ?? ""} placeholder={placeholder} onBlur={(e) => { if (e.target.value !== String(value ?? "")) onSave(e.target.value); }} className={`mt-1 ${inp}`} />
    </label>
  );
}

export function TicketDetails({ jobId }: { jobId: string }) {
  const j = useJob(jobId);
  const [stock, setStock] = useState<Stock[] | null>(null);
  useEffect(() => {
    if (!j || stock) return;
    const rows = Array.isArray(j.stockLines) ? j.stockLines : [];
    setStock(rows.length ? rows : [{ size: j.runningSize || "", qty: "", description: j.stockDescription || "", detail: "" }]);
  }, [j, stock]);
  if (!j || !stock) return null;
  const put = (k: string) => (v: string) => save(jobId, { [k]: v });
  const putStock = (rows: Stock[]) => { setStock(rows); save(jobId, { stockLines: rows }); };
  const editStock = (i: number, k: keyof Stock, v: string) => { const rows = stock.map((r, x) => (x === i ? { ...r, [k]: v } : r)); setStock(rows); };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">Ticket details</h3>
      <p className="mt-0.5 text-xs text-gray-500">The rest of the FileMaker ticket. Everything here prints where it did on the paper ticket.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Customer #" value={j.order?.company?.customerNumber} onSave={put("customerNumber")} />
        <Field label="Rep job #" value={j.repJobNumber} onSave={put("repJobNumber")} />
        <Field label="Due time" value={j.dueTime} onSave={put("dueTime")} placeholder="e.g. 10 AM" />
        <Field label="Partial qty" type="number" value={j.partialQty} onSave={put("partialQty")} />
        <Field label="Partial due" type="date" value={day(j.partialDue)} onSave={put("partialDue")} />
        <Field label="Samples in ticket" type="number" value={j.samplesQty} onSave={put("samplesQty")} placeholder="e.g. 5" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block sm:col-span-1 lg:col-span-1">
          <span className={lab}>Proofs</span>
          <textarea defaultValue={j.proofsNote ?? ""} rows={3} placeholder={"PDF\nEpson 99\nSh 2"} onBlur={(e) => { if (e.target.value !== (j.proofsNote ?? "")) save(jobId, { proofsNote: e.target.value }); }} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
          <span className="mt-0.5 block text-[11px] text-gray-400">Epson = hi-res proof · Sh = Sherpa, low-res imposition proof</span>
        </label>
        <Field label="Mails" value={j.mailDate} onSave={put("mailDate")} placeholder="Mail date" />
        <Field label="Mail qty" type="number" value={j.mailQty} onSave={put("mailQty")} />
        <Field label="Drop city" value={j.mailDropCity} onSave={put("mailDropCity")} />
        <Field label="Weight" value={j.mailWeight} onSave={put("mailWeight")} />
        <Field label="Postage" value={j.mailPostage} onSave={put("mailPostage")} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className={lab}>Stock (Size / Quantity / Stock description)</span>
          {stock.length < 10 && <button type="button" onClick={() => setStock([...stock, { size: "", qty: "", description: "", detail: "" }])} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><Plus className="h-3 w-3" />Add stock row</button>}
        </div>
        <div className="mt-1 space-y-2">
          {stock.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input aria-label="Stock size" value={r.size} onChange={(e) => editStock(i, "size", e.target.value)} onBlur={() => putStock(stock)} placeholder="23 X 29" className={`col-span-3 sm:col-span-2 ${inp}`} />
              <input aria-label="Stock quantity" value={r.qty} onChange={(e) => editStock(i, "qty", e.target.value)} onBlur={() => putStock(stock)} placeholder="20,875" className={`col-span-3 sm:col-span-2 ${inp}`} />
              <input aria-label="Stock description" value={r.description} onChange={(e) => editStock(i, "description", e.target.value)} onBlur={() => putStock(stock)} placeholder="80# MACGREGOR GLOSS COVER" className={`col-span-6 sm:col-span-4 ${inp}`} />
              <input aria-label="Second line" value={r.detail} onChange={(e) => editStock(i, "detail", e.target.value)} onBlur={() => putStock(stock)} placeholder="$184.70 /M or vendor + item #" className={`col-span-11 sm:col-span-3 ${inp}`} />
              <button type="button" aria-label="Remove stock row" onClick={() => putStock(stock.filter((_, x) => x !== i))} className="col-span-1 flex items-center justify-center text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">Use the rows for notes too, like FileMaker. Start a line with ** to print it in red. Add a row for boxes or anything else pulled or bought for the job (e.g. 15 x 12 x 10&quot; | 77 | 32 ECT corrugated boxes | ULINE S-20464).</p>
      </div>
    </div>
  );
}

/** Bindery boxes with the text line next to each, like FileMaker. */
const BINDERY: [string, string, string][] = [
  ["score", "Score", "binderyScore"], ["perf", "Perf", "binderyPerf"], ["drill", "Drill", "binderyDrill"], ["pad", "Pad", "binderyPad"],
  ["fold", "Fold", "binderyFold"], ["count", "Count", "binderyCount"], ["stitch", "Stitch", "binderyStitch"], ["collate", "Collate", "binderyCollate"],
  ["pockets", "Pockets", "binderyPockets"], ["glue", "Glue", "binderyGlue"], ["wrap", "Wrap", "binderyWrap"], ["other", "Other", ""],
];
export function BinderyLines({ jobId }: { jobId: string }) {
  const j = useJob(jobId);
  const [vals, setVals] = useState<Record<string, string> | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!j || vals) return;
    const v = { ...(j.binderyValues || {}) } as Record<string, string>;
    if (!v.other && j.binderyOther && j.binderyOther !== "true") v.other = j.binderyOther;
    setVals(v);
    setOn(Object.fromEntries(BINDERY.map(([k, , col]) => [k, col ? !!j[col] || !!v[k] : !!v[k]])));
  }, [j, vals]);
  if (!j || !vals) return null;
  const toggle = (k: string, col: string) => { const nv = !on[k]; setOn({ ...on, [k]: nv }); if (col) save(jobId, { [col]: nv }); };
  const saveVal = (k: string, col: string, v: string) => {
    const next = { ...vals, [k]: v }; setVals(next); save(jobId, { binderyValues: next, ...(col && v && !on[k] ? { [col]: true } : {}) });
    if (v && !on[k]) setOn({ ...on, [k]: true });
  };
  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {BINDERY.map(([k, l, col]) => (
        <div key={k} className="flex items-center gap-2">
          <label className="flex w-24 shrink-0 items-center gap-1.5 text-sm"><input type="checkbox" checked={!!on[k]} disabled={!col} onChange={() => toggle(k, col)} />{l}</label>
          <input aria-label={`${l} instructions`} defaultValue={vals[k] || ""} onBlur={(e) => { if (e.target.value !== (vals[k] || "")) saveVal(k, col, e.target.value.trim()); }} placeholder={k === "wrap" ? "e.g. 100'S" : k === "other" ? "e.g. CTN PACK 1,000 PER BOX" : ""} className="h-8 flex-1 border-0 border-b border-gray-300 px-1 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
      ))}
    </div>
  );
}
