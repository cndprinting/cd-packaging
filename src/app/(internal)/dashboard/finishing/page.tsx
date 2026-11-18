"use client";

// Finishing (Benjy 11/18/26, Todd). Every job coming off press and through
// coating, die cutting, gluing and packing, plus every open job whose die isn't
// in hand yet, so a new die gets ordered when the job is entered, not when it
// reaches the cutter.
import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Scissors } from "lucide-react";
import { Input } from "@/components/ui/input";

type J = {
  id: string; jobNumber: string; name: string; status: string; quantity: number; dueDate: string | null; priority: string;
  customer: string; csr: string | null; rep: string | null; coating: string | null; productType: string; dieNumber: string | null;
  die: { state: string; label: string }; late: boolean; test: boolean;
};
type Col = { key: string; label: string; statuses: string[]; jobs: J[] };
const NEXT: Record<string, [string, string][]> = {
  SCHEDULED: [], PRINTING: [["COATING_FINISHING", "Coating / foil"], ["DIE_CUTTING", "Die cutting"]],
  COATING_FINISHING: [["DIE_CUTTING", "Die cutting"], ["GLUING_FOLDING", "Gluing"], ["QA", "QA / packing"]],
  DIE_CUTTING: [["GLUING_FOLDING", "Gluing"], ["QA", "QA / packing"], ["PACKED", "Packed"]],
  GLUING_FOLDING: [["QA", "QA / packing"], ["PACKED", "Packed"]],
  QA: [["PACKED", "Packed, to shipping"]],
};
const DIE_CLS: Record<string, string> = { rack: "text-emerald-700", received: "text-emerald-700", ordered: "text-sky-700", needed: "text-red-600 font-medium", unknown: "text-amber-700", none: "text-gray-400" };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "");

export default function FinishingPage() {
  const [cols, setCols] = useState<Col[]>([]);
  const [toOrder, setToOrder] = useState<J[]>([]);
  const [onOrder, setOnOrder] = useState<J[]>([]);
  const [canAct, setCanAct] = useState(false);
  const [all, setAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [dieEdit, setDieEdit] = useState<string | null>(null);
  const [dieVal, setDieVal] = useState("");
  const [vendor, setVendor] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/finishing${all ? "?all=1" : ""}`).then((r) => r.json()).catch(() => ({}));
    setCols(d.columns || []); setToOrder(d.diesToOrder || []); setOnOrder(d.diesOnOrder || []); setCanAct(!!d.canAct); setLoading(false);
  }, [all]);
  useEffect(() => { load(); }, [load]);

  const post = async (body: any) => {
    setBusy(body.jobId);
    const r = await fetch("/api/finishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) alert(d.error || "Could not save");
    setDieEdit(null); setDieVal(""); setVendor("");
    await load(); setBusy(null);
  };

  const dieBox = (j: J) => (
    <div className="mt-1">
      <div className={`text-[11px] ${DIE_CLS[j.die.state] || "text-gray-500"}`}><Scissors className="mr-0.5 inline h-3 w-3" />{j.die.label}</div>
      {canAct && j.die.state !== "none" && j.die.state !== "rack" && j.die.state !== "received" && (dieEdit === j.id ? (
        <div className="mt-1 space-y-1 rounded bg-gray-50 p-2">
          <Input value={dieVal} onChange={(e) => setDieVal(e.target.value)} placeholder="Die # from the rack" className="h-7 text-xs" />
          <button type="button" disabled={!dieVal.trim() || busy === j.id} onClick={() => post({ action: "set_die", jobId: j.id, dieNumber: dieVal })} className="w-full rounded bg-emerald-600 px-2 py-1 text-[11px] text-white disabled:opacity-50">Use this die</button>
          {j.die.state !== "ordered" ? <>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Or: die maker (e.g. Ameriken)" className="h-7 text-xs" />
            <button type="button" disabled={busy === j.id} onClick={() => post({ action: "die_ordered", jobId: j.id, vendor })} className="w-full rounded border border-sky-600 px-2 py-1 text-[11px] text-sky-700">New die ordered</button>
          </> : <button type="button" disabled={busy === j.id} onClick={() => post({ action: "die_received", jobId: j.id, dieNumber: dieVal })} className="w-full rounded border border-emerald-600 px-2 py-1 text-[11px] text-emerald-700">New die is in</button>}
          <button type="button" onClick={() => setDieEdit(null)} className="w-full text-[11px] text-gray-400">Cancel</button>
        </div>
      ) : <button type="button" onClick={() => { setDieEdit(j.id); setDieVal(j.dieNumber || ""); }} className="text-[11px] text-brand-600 hover:underline">Update die</button>)}
    </div>
  );

  const card = (j: J) => (
    <div key={j.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-2"><a href={`/dashboard/jobs/${j.id}`} className="font-medium text-gray-900 hover:underline">{j.customer || j.name}</a>{j.priority === "URGENT" || j.priority === "HIGH" ? <span className="rounded bg-red-100 px-1.5 text-[10px] font-medium text-red-700">{j.priority}</span> : null}</div>
      <div className="text-xs text-gray-600">{j.jobNumber} · {j.name}</div>
      <div className="mt-0.5 flex justify-between text-[11px] text-gray-500"><span>{j.quantity?.toLocaleString()}{j.coating ? ` · ${j.coating}` : ""}</span>{j.dueDate && <span className={j.late ? "font-medium text-red-600" : ""}>due {day(j.dueDate)}</span>}</div>
      {dieBox(j)}
      {canAct && (NEXT[j.status] || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">{NEXT[j.status].map(([s, l]) => <button key={s} type="button" disabled={busy === j.id} onClick={() => post({ action: "move", jobId: j.id, status: s })} className="rounded border border-gray-300 px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50">{l} &rarr;</button>)}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Finishing</h1><p className="mt-1 text-sm text-gray-500">Coating, foil, die cutting, gluing and packing. Packed jobs go to Shipping.</p></div>
        <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Include test jobs</label>
      </div>
      {loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : <>
        {(toOrder.length > 0 || onOrder.length > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" />Dies to sort out ({toOrder.length} need a die, {onOrder.length} on order)</div>
            <p className="text-xs text-amber-800">Open jobs whose die isn't in hand yet, including jobs still in pre-press. Pick one from the rack or order a new one now.</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-4">{[...toOrder, ...onOrder].map((j) => card(j))}</div>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-5">
          {cols.map((c) => (
            <div key={c.key} className="rounded-lg bg-gray-50 p-2">
              <div className="px-1 pb-2 text-sm font-semibold text-gray-800">{c.label} <span className="text-gray-400">{c.jobs.length}</span></div>
              <div className="space-y-2">{c.jobs.map((j) => card(j))}{c.jobs.length === 0 && <div className="px-1 py-4 text-center text-xs text-gray-400">Nothing here</div>}</div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
