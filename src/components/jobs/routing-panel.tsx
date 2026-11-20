"use client";

// Darrin's routing review on the job (11/18/26): what he checks in FileMaker
// when a new ticket comes in. Everyone can see it; the plant manager edits it.
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type M = { code: string; name: string; workCenter: string };
type R = { routedAt: string | null; routedBy: string | null; routeStatus: string | null; routeTasks: string[]; foils: string | null; inkFront: string | null; inkBack: string | null; pressAssignment: string | null; dieCutterCode: string | null; gluerCode: string | null; routeNote?: string | null };
const sel = "mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm";

export function RoutingPanel({ jobId }: { jobId: string }) {
  const [d, setD] = useState<{ routing: R; machines: { presses: M[]; dieCutters: M[]; gluers: M[] }; statuses: [string, string][]; presses: [string, string][]; tasks: [string, string][]; canEdit: boolean; canStatus?: boolean } | null>(null);
  const [f, setF] = useState<R | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => {
    const load = () => fetch(`/api/jobs/${jobId}/routing`).then((r) => r.json()).then((x) => { if (x.routing) { setD(x); setF(x.routing); } }).catch(() => {});
    load();
    // The status bar at the top of the job page changes the same fields.
    window.addEventListener("gz-routing-changed", load);
    return () => window.removeEventListener("gz-routing-changed", load);
  }, [jobId]);
  if (!d || !f) return null;
  const set = (k: keyof R, v: any) => setF({ ...f, [k]: v });
  const toggle = (k: string) => set("routeTasks", f.routeTasks.includes(k) ? f.routeTasks.filter((x) => x !== k) : [...f.routeTasks, k]);
  const lp = f.routeTasks.includes("letterpress");
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/jobs/${jobId}/routing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const x = await r.json();
      if (!r.ok) setMsg({ ok: false, t: x.error || "Could not save" }); else { setF(x.routing); setD({ ...d, routing: x.routing }); setMsg({ ok: true, t: "Saved" }); window.dispatchEvent(new Event("gz-routing-changed-panel")); }
    } catch { setMsg({ ok: false, t: "Could not save" }); }
    setBusy(false);
  };
  const ro = !d.canEdit;
  return (
    <div id="routing" className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900">Plant routing</h3>
        {d.routing.routedAt ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Routed by {d.routing.routedBy} {new Date(d.routing.routedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">New job: Darrin hasn&apos;t routed it yet</span>}
      </div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
        <label className="block"><span className="text-gray-600">Status</span><select disabled={ro} value={f.routeStatus || ""} onChange={(e) => set("routeStatus", e.target.value)} className={sel}><option value="">Choose...</option>{d.statuses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block"><span className="text-gray-600">Ink, front</span><Input disabled={ro} value={f.inkFront || ""} onChange={(e) => set("inkFront", e.target.value)} placeholder="e.g. 4 + PMS 186" /></label>
        <label className="block"><span className="text-gray-600">Ink, back</span><Input disabled={ro} value={f.inkBack || ""} onChange={(e) => set("inkBack", e.target.value)} /></label>
        <label className="block"><span className="text-gray-600">Foil(s)</span><Input disabled={ro} value={f.foils || ""} onChange={(e) => set("foils", e.target.value)} placeholder="None" /></label>
        <label className="block"><span className="text-gray-600">Press</span><select disabled={ro} value={f.pressAssignment || ""} onChange={(e) => set("pressAssignment", e.target.value)} className={sel}><option value="">Not set</option>{d.presses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}{f.pressAssignment && !d.presses.some(([k]) => k === f.pressAssignment) && <option value={f.pressAssignment}>{f.pressAssignment}</option>}</select></label>
      </div>
      <div className="mt-3">
        <div className="text-sm text-gray-600">Production</div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-sm">{d.tasks.map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" disabled={ro} checked={f.routeTasks.includes(k)} onChange={() => toggle(k)} />{l}</label>)}</div>
      </div>
      <label className="mt-3 block text-sm"><span className="text-gray-600">Plant note</span>
        <textarea disabled={ro} rows={2} value={f.routeNote || ""} onChange={(e) => set("routeNote", e.target.value)} placeholder="e.g. Reticulating varnish, dry trap varnish, inserter / inkjet notes. Prints on the schedules." className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      {lp && (
        <div className="mt-3 grid gap-3 rounded-md bg-gray-50 p-3 text-sm md:grid-cols-2">
          <label className="block"><span className="text-gray-600">Die cutter</span><select disabled={ro} value={f.dieCutterCode || ""} onChange={(e) => set("dieCutterCode", e.target.value)} className={sel}><option value="">Choose...</option>{d.machines.dieCutters.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}</select></label>
          <label className="block"><span className="text-gray-600">Gluer</span><select disabled={ro} value={f.gluerCode || ""} onChange={(e) => set("gluerCode", e.target.value)} className={sel}><option value="">No gluing / not set</option>{d.machines.gluers.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}</select></label>
        </div>
      )}
      {d.canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={save} disabled={busy || !f.routeStatus}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save routing"}</Button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.t}</span>}
        </div>
      )}
    </div>
  );
}

/** Darrin's list of new jobs he hasn't routed yet. */
export function ToRouteList() {
  const [d, setD] = useState<{ jobs: any[]; canRoute: boolean } | null>(null);
  useEffect(() => { fetch("/api/routing").then((r) => r.json()).then((x) => { if (x.jobs) setD(x); }).catch(() => {}); }, []);
  if (!d || !d.canRoute || !d.jobs.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 text-sm font-semibold text-amber-900">New jobs to route ({d.jobs.length})</div>
      <div className="divide-y divide-amber-100">
        {d.jobs.map((j) => (
          <a key={j.id} href={`/dashboard/jobs/${j.id}#routing`} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm hover:bg-amber-100/50">
            <span><span className="font-mono font-medium">{j.jobNumber}</span> · {j.customer} · {j.name}</span>
            <span className="text-xs text-gray-600">{(j.quantity || 0).toLocaleString()}{j.dueDate ? ` · due ${new Date(j.dueDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}` : ""} · entered {new Date(j.enteredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{j.csr ? ` by ${j.csr}` : ""}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Top of the job page: Darrin's Status + Press, the same drop-downs as the Jobs list (11/20/26). */
export function WipBar({ jobId, waitingOn, onShowStages, stagesOpen }: { jobId: string; waitingOn?: string; onShowStages: () => void; stagesOpen: boolean }) {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const load = () => fetch(`/api/jobs/${jobId}/routing`).then((r) => r.json()).then((x) => { if (x.routing) setD(x); }).catch(() => {});
    load();
    window.addEventListener("gz-routing-changed-panel", load);
    return () => window.removeEventListener("gz-routing-changed-panel", load);
  }, [jobId]);
  if (!d) return null;
  const r = d.routing;
  const change = async (field: "routeStatus" | "pressAssignment", value: string) => {
    setMsg(null);
    const res = await fetch(`/api/jobs/${jobId}/routing`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    const x = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(x.error || "Could not save"); return; }
    setD({ ...d, routing: { ...r, routeStatus: x.routeStatus, pressAssignment: x.pressAssignment } });
    setMsg("Saved");
    window.dispatchEvent(new Event("gz-routing-changed"));
  };
  const pressLabel = (d.presses as [string, string][]).find(([k]) => k === r.pressAssignment)?.[1] || r.pressAssignment || "Not set";
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border-2 border-brand-200 bg-brand-50/40 px-4 py-3">
      {d.routing.isTest && <span className="rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-yellow-900" title="December test mode: never reaches invoicing, shipping, customers or the live team">TEST JOB</span>}
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">Status
        {d.canStatus ? (
          <select aria-label="Job status" value={r.routeStatus || ""} onChange={(e) => change("routeStatus", e.target.value)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm font-semibold">
            {!r.routeStatus && <option value="">New (no status yet)</option>}
            {(d.statuses as [string, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        ) : <span className="rounded bg-white px-2 py-1 font-semibold">{(d.statuses as [string, string][]).find(([k]) => k === r.routeStatus)?.[1] || "New"}</span>}
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">Press
        {d.canEdit ? (
          <select aria-label="Job press" value={r.pressAssignment || ""} onChange={(e) => change("pressAssignment", e.target.value)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm font-semibold">
            <option value="">Not set</option>
            {(d.presses as [string, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        ) : <span className="rounded bg-white px-2 py-1 font-semibold">{pressLabel}</span>}
      </label>
      {waitingOn && <span className="text-sm text-gray-600">Waiting on: <b className="text-gray-900">{waitingOn}</b></span>}
      {msg && <span className={`text-sm ${msg === "Saved" ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      <button type="button" onClick={onShowStages} className="ml-auto text-xs text-brand-700 hover:underline">{stagesOpen ? "Hide production stages" : "Show production stages"}</button>
    </div>
  );
}
