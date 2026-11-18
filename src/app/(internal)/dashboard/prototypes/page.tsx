"use client";

// Prototypes (Benjy 11/18/26). Todd's board for sample boxes made during the
// quoting back-and-forth. Sales asks (usually from the lead), Todd makes it,
// sales gets it to the customer, the customer approves or asks for another round.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, X, Box, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type P = {
  id: string; number: string; status: string; round: number; leadId: string | null; companyId: string | null; customerName: string;
  requestedByName: string; request: string; style: string | null; length: number | null; width: number | null; depth: number | null;
  stock: string | null; samples: number | null; neededBy: string | null; files: { name: string; url: string }[];
  dieMatches: { exact: any[]; near: any[] } | null; dieNumber: string | null; makerNotes: string | null; feedback: string | null;
  log: { at: string; by: string; event: string }[]; jobId: string | null; createdAt: string; updatedAt: string;
};
const COLS = [
  { key: "requested", label: "New requests", who: "Todd" },
  { key: "making", label: "Making it", who: "Todd" },
  { key: "ready", label: "Ready", who: "Sales" },
  { key: "with_customer", label: "With customer", who: "Customer" },
  { key: "approved", label: "Approved", who: "" },
];
const STYLES: [string, string][] = [["STE", "Straight tuck end"], ["RTE", "Reverse tuck end"], ["TTAB", "Tuck top auto bottom"], ["TTSB", "Tuck top snap lock bottom"], ["SE", "Seal end"], ["SLV", "Sleeve"], ["RETF", "Tray"], ["OTHER", "Other / custom"]];
const inputCls = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "");
const size = (p: Pick<P, "style" | "length" | "width" | "depth">) => [p.style && p.style !== "OTHER" ? p.style : null, p.length && p.width ? `${p.length} x ${p.width}${p.depth ? ` x ${p.depth}` : ""}` : null].filter(Boolean).join(" ");

function Board() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<P[]>([]);
  const [canMake, setCanMake] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [me, setMe] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<P | null>(null);
  const [asking, setAsking] = useState<null | { leadId?: string; customerName?: string; companyId?: string }>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/prototypes").then((r) => r.json()).catch(() => ({}));
    setRows(d.prototypes || []); setCanMake(!!d.canMake); setCanRequest(!!d.canRequest); setMe(d.me || ""); setLoading(false);
    return d.prototypes || [];
  }, []);
  useEffect(() => {
    load().then((list: P[]) => {
      const o = sp.get("open"); if (o) setOpen(list.find((p) => p.id === o) || null);
      if (sp.get("new") === "1") setAsking({ leadId: sp.get("leadId") || undefined, customerName: sp.get("customer") || undefined, companyId: sp.get("companyId") || undefined });
    });
  }, [load, sp]);

  const shown = useMemo(() => rows.filter((p) => !mine || p.requestedByName === me), [rows, mine, me]);
  const act = async (id: string, body: any) => {
    const r = await fetch("/api/prototypes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Could not save"); return null; }
    const list = await load(); setOpen(list.find((p: P) => p.id === id) || null);
    return d.prototype;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prototypes</h1>
          <p className="mt-1 text-sm text-gray-500">Sample boxes while we're still quoting. Sales asks, Todd makes it, the customer approves or asks for another round.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMine((v) => !v)} className={`rounded-full border px-3 py-1 text-xs ${mine ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600"}`}>Only mine</button>
          {canRequest && <Button onClick={() => setAsking({})} className="gap-2"><Plus className="h-4 w-4" />Ask for a prototype</Button>}
        </div>
      </div>
      {flash && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</div>}
      {loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="grid gap-3 lg:grid-cols-5">
          {COLS.map((c) => {
            const list = shown.filter((p) => p.status === c.key);
            return (
              <div key={c.key} className="rounded-lg bg-gray-50 p-2">
                <div className="flex items-baseline justify-between px-1 pb-2"><span className="text-sm font-semibold text-gray-800">{c.label} <span className="text-gray-400">{list.length}</span></span>{c.who && <span className="text-[11px] text-gray-400">{c.who}</span>}</div>
                <div className="space-y-2">
                  {list.map((p) => {
                    const late = p.neededBy && new Date(p.neededBy).getTime() < Date.now() && !["approved", "with_customer"].includes(p.status);
                    return (
                      <button key={p.id} type="button" onClick={() => setOpen(p)} className="block w-full rounded-md border border-gray-200 bg-white p-3 text-left text-sm shadow-sm hover:border-brand-300">
                        <div className="flex items-center justify-between gap-2"><span className="font-medium text-gray-900">{p.customerName}</span>{p.round > 1 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Round {p.round}</span>}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">{p.request}</div>
                        <div className="mt-1 text-[11px] text-gray-500">{[size(p), p.stock].filter(Boolean).join(" · ")}</div>
                        {p.status === "requested" && p.round > 1 && p.feedback && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">Change: {p.feedback}</div>}
                        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400"><span>{p.number} · {p.requestedByName}</span>{p.neededBy && <span className={late ? "font-medium text-red-600" : ""}><Clock className="mr-0.5 inline h-3 w-3" />{day(p.neededBy)}</span>}</div>
                        {p.dieMatches?.exact?.length ? <div className="mt-1 text-[11px] text-emerald-700">Die {p.dieMatches.exact[0].dieNumber} fits this size</div> : null}
                      </button>
                    );
                  })}
                  {list.length === 0 && <div className="px-1 py-4 text-center text-xs text-gray-400">Nothing here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <Detail p={open} canMake={canMake} canRequest={canRequest} onClose={() => setOpen(null)} act={act} />}
      {asking && <AskForm prefill={asking} onClose={() => setAsking(null)} onDone={async (p) => { setAsking(null); setFlash(`${p.number} sent to Todd.`); await load(); }} />}
    </div>
  );
}

function Detail({ p, canMake, canRequest, onClose, act }: { p: P; canMake: boolean; canRequest: boolean; onClose: () => void; act: (id: string, b: any) => Promise<any> }) {
  const [notes, setNotes] = useState(p.makerNotes || "");
  const [die, setDie] = useState(p.dieNumber || "");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (b: any) => { setBusy(true); await act(p.id, b); setBusy(false); setFeedback(""); };
  const any = canMake || canRequest;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><div className="text-xs text-gray-400">{p.number} · round {p.round} · asked by {p.requestedByName}</div><h2 className="text-lg font-semibold text-gray-900">{p.customerName}</h2></div>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {p.leadId && <div className="text-xs text-gray-400">From the sales pipeline. Each step is noted on the lead.</div>}
        <div className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-800">{p.request}</div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-gray-500">Style / size (inside)</dt><dd>{size(p) || "Not given"}</dd></div>
          <div><dt className="text-xs text-gray-500">Stock</dt><dd>{p.stock || "Not given"}</dd></div>
          <div><dt className="text-xs text-gray-500">Samples</dt><dd>{p.samples || "-"}</dd></div>
          <div><dt className="text-xs text-gray-500">Needed by</dt><dd>{day(p.neededBy) || "-"}</dd></div>
        </dl>
        {p.files.length > 0 && <div className="mt-3 text-sm"><div className="text-xs text-gray-500">Files</div>{p.files.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="block text-brand-600 hover:underline">{f.name || f.url}</a>)}</div>}
        {p.dieMatches && (p.dieMatches.exact.length + p.dieMatches.near.length > 0) && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <div className="font-medium">Dies we already have</div>
            {p.dieMatches.exact.map((d) => <div key={d.dieNumber}>Exact: <b>{d.dieNumber}</b> {d.length} x {d.width} x {d.height}{d.customerName ? ` (${d.customerName})` : ""}{d.dielineUrl && <> · <a href={d.dielineUrl} target="_blank" rel="noreferrer" className="underline">dieline</a></>}</div>)}
            {p.dieMatches.near.slice(0, 3).map((d) => <div key={d.dieNumber}>Close: {d.dieNumber} {d.length} x {d.width} x {d.height}{d.customerName ? ` (${d.customerName})` : ""}</div>)}
          </div>
        )}
        {p.feedback && <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900"><div className="text-xs font-medium">Customer's latest</div>{p.feedback}</div>}

        {/* Actions by stage */}
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          {canMake && ["requested", "making"].includes(p.status) && (
            <div className="space-y-2">
              {p.status === "requested" && <Button disabled={busy} onClick={() => run({ action: "start" })} className="w-full">Start round {p.round}</Button>}
              <label className="block text-sm"><span className="text-gray-600">What you made (for sales)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="e.g. STE on 18pt SBS, used die 2231, window moved to the front" /></label>
              <label className="block text-sm"><span className="text-gray-600">Die used or to use</span><Input value={die} onChange={(e) => setDie(e.target.value)} placeholder="Die # (blank if a new die)" /></label>
              <Button disabled={busy} onClick={() => run({ action: "ready", makerNotes: notes, dieNumber: die })} className="w-full" variant={p.status === "requested" ? "outline" : "default"}>It's ready, tell {p.requestedByName.split(" ")[0]}</Button>
            </div>
          )}
          {any && p.status === "ready" && <Button disabled={busy} onClick={() => run({ action: "sent" })} className="w-full">It's with the customer now</Button>}
          {any && ["ready", "with_customer"].includes(p.status) && (
            <div className="space-y-2 rounded-md border border-gray-200 p-3">
              <div className="text-sm font-medium text-gray-800">What did the customer say?</div>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className={inputCls} placeholder="e.g. Make it 1/4 in taller and switch to a reverse tuck" />
              <div className="flex gap-2">
                <Button disabled={busy || !feedback.trim()} onClick={() => run({ action: "changes", feedback })} variant="outline" className="flex-1 gap-1"><RotateCcw className="h-4 w-4" />Another round</Button>
                <Button disabled={busy} onClick={() => run({ action: "approved", feedback })} className="flex-1">They approved it</Button>
              </div>
            </div>
          )}
          {p.status === "approved" && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">Approved{p.dieNumber ? `, die ${p.dieNumber}` : ""}. When the job is sold, the CSR picks this prototype on the job ticket and the structure carries over.{p.jobId ? " Already on a job." : ""}</div>}
          {any && !["approved", "dropped"].includes(p.status) && <button type="button" disabled={busy} onClick={() => { const reason = prompt("Why drop it? (optional)") ?? null; if (reason !== null) run({ action: "drop", reason }); }} className="text-xs text-gray-500 hover:underline">Drop this prototype</button>}
          {any && p.status === "dropped" && <button type="button" onClick={() => run({ action: "reopen" })} className="text-xs text-brand-600 hover:underline">Reopen</button>}
        </div>

        <div className="mt-5">
          <div className="text-xs font-medium uppercase text-gray-500">History</div>
          <ul className="mt-1 space-y-1 text-xs text-gray-600">{[...p.log].reverse().map((l, i) => <li key={i}><span className="text-gray-400">{new Date(l.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> {l.by}: {l.event}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

function AskForm({ prefill, onClose, onDone }: { prefill: { leadId?: string; customerName?: string; companyId?: string }; onClose: () => void; onDone: (p: P) => void }) {
  const [f, setF] = useState({ customerName: prefill.customerName || "", request: "", style: "", length: "", width: "", depth: "", stock: "", samples: "2", neededBy: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/prototypes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, leadId: prefill.leadId || null, companyId: prefill.companyId || null }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not send"); setBusy(false); return; }
      onDone(d.prototype);
    } catch { setErr("Could not send"); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold text-gray-900"><Box className="h-4 w-4" />Ask Todd for a prototype</h2><button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-gray-400" /></button></div>
        <div className="mt-3 space-y-3 text-sm">
          <label className="block"><span className="text-gray-600">Customer or prospect</span><Input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} disabled={!!prefill.leadId} /></label>
          <label className="block"><span className="text-gray-600">What do they want?</span><textarea value={f.request} onChange={(e) => set("request", e.target.value)} rows={4} className={inputCls} placeholder="What goes in the box, how it opens, any window, insert or special feature, and what they didn't like about the last one" /></label>
          <div className="grid grid-cols-4 gap-2">
            <label className="col-span-4 block"><span className="text-gray-600">Style (if known)</span><select value={f.style} onChange={(e) => set("style", e.target.value)} className={inputCls}><option value="">Not sure, Todd decides</option>{STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="block"><span className="text-gray-600">L (in)</span><Input value={f.length} onChange={(e) => set("length", e.target.value)} inputMode="decimal" /></label>
            <label className="block"><span className="text-gray-600">W</span><Input value={f.width} onChange={(e) => set("width", e.target.value)} inputMode="decimal" /></label>
            <label className="block"><span className="text-gray-600">D</span><Input value={f.depth} onChange={(e) => set("depth", e.target.value)} inputMode="decimal" /></label>
            <label className="block"><span className="text-gray-600">Samples</span><Input value={f.samples} onChange={(e) => set("samples", e.target.value)} inputMode="numeric" /></label>
          </div>
          <p className="-mt-1 text-[11px] text-gray-400">Inside dimensions. Leave blank if you don't have them; the Dielines page can size a box from a description.</p>
          <label className="block"><span className="text-gray-600">Stock (if known)</span><Input value={f.stock} onChange={(e) => set("stock", e.target.value)} placeholder="e.g. 18pt SBS, kraft" /></label>
          <label className="block"><span className="text-gray-600">Needed by</span><Input type="date" value={f.neededBy} onChange={(e) => set("neededBy", e.target.value)} /></label>
          {err && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{err}</div>}
          <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={busy || !f.customerName.trim() || !f.request.trim()} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to Todd"}</Button></div>
        </div>
      </div>
    </div>
  );
}

export default function PrototypesPage() {
  return <Suspense fallback={null}><Board /></Suspense>;
}
