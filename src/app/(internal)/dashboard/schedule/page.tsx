"use client";

// Schedule = Darrin's machine schedules (11/18/26; the old work-center calendar
// was retired the same day so there's one schedule, not two). Jobs land here
// from his routing; he sets the order with the arrows; each prints on its own sheet.
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Printer } from "lucide-react";
import { ToRouteList } from "@/components/jobs/routing-panel";
import { Button } from "@/components/ui/button";

type J = { plate?: boolean; press?: string | null; id: string; jobNumber: string; name: string; quantity: number; dueDate: string | null; customer: string; inks: string | null; foils: string | null; dieNumber: string | null; routeStatus: string | null; notes: string | null; priority: string; placed: boolean };
type M = { code: string; name: string; kind: string; plateDate?: string; jobs: J[] };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "");

export default function SchedulePage() {
  const [ms, setMs] = useState<M[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [plateDate, setPlateDate] = useState("");
  const load = (d?: string) => fetch(`/api/schedule/machines${d ? `?plateDate=${d}` : ""}`).then((r) => r.json()).then((x) => { setMs(x.machines || []); setCanEdit(!!x.canEdit); setPlateDate(x.plateDate || ""); }).catch(() => setMs([]));
  useEffect(() => { load(); }, []);
  // Darrin's nightly plating pick: the jobs printing on plateDate.
  const plate = async (j: J, on: boolean) => {
    setBusy("PLATING");
    const r = await fetch("/api/schedule/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "plate", jobId: j.id, plateDate, on }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setMs(d.machines || []);
    setBusy(null);
  };

  const move = async (m: M, i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= m.jobs.length) return;
    const jobs = [...m.jobs]; [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
    setMs((prev) => (prev || []).map((x) => (x.code === m.code ? { ...x, jobs } : x)));
    setBusy(m.code);
    const r = await fetch("/api/schedule/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machineCode: m.code, order: jobs.map((x) => x.id), plateDate }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.machines?.[0]) setMs((prev) => (prev || []).map((x) => (x.code === m.code ? d.machines[0] : x)));
    if (r.ok && m.kind === "press") load(plateDate); // plating follows press order
    setBusy(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div><h1 className="text-2xl font-bold text-gray-900">Schedule</h1><p className="text-sm text-gray-500">From the plant routing on each job. {canEdit ? "Use the arrows to set the order; the printout follows it." : "Darrin sets the order."}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">Plating for<input type="date" value={plateDate} onChange={(e) => { setPlateDate(e.target.value); load(e.target.value); }} className="h-9 rounded-md border border-gray-300 px-2 text-sm" /></label>
          <a href={`/print/schedules${plateDate ? `?plateDate=${plateDate}` : ""}`} target="_blank" rel="noreferrer"><Button className="gap-2"><Printer className="h-4 w-4" />Print all schedules</Button></a>
        </div>
      </div>
      <ToRouteList />
      {!ms ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ms.map((m) => (
            <div key={m.code} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <span className="font-semibold text-gray-900">{m.name} <span className="text-sm font-normal text-gray-400">{m.jobs.length} job{m.jobs.length === 1 ? "" : "s"}</span>{busy === m.code && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-gray-400" />}</span>
                <a href={`/print/schedules?m=${m.code}${plateDate ? `&plateDate=${plateDate}` : ""}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><Printer className="h-3.5 w-3.5" />Print</a>
              </div>
              {m.kind === "plating" && <div className="border-b border-gray-50 px-4 py-1.5 text-xs text-gray-500">Jobs printing {plateDate ? new Date(`${plateDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "tomorrow"}. {canEdit ? "Tick \"Plate\" on the press lists below." : ""}</div>}
              {m.jobs.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">{m.kind === "plating" ? "Nothing picked for plating yet" : "Nothing routed here yet"}</div> : (
                <ol className="divide-y divide-gray-50">
                  {m.jobs.map((j, i) => (
                    <li key={j.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-5 text-right text-xs text-gray-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <a href={`/dashboard/jobs/${j.id}#routing`} className="font-medium text-gray-900 hover:underline">{j.jobNumber}</a> <span className="text-gray-600">· {j.customer} · {j.name}</span>
                        <div className="text-xs text-gray-500">{[(j.quantity || 0).toLocaleString(), j.dueDate && `due ${day(j.dueDate)}`, j.inks && `ink ${j.inks}`, j.foils && `foil ${j.foils}`, j.dieNumber && `die ${j.dieNumber}`].filter(Boolean).join(" · ")}</div>
                      </div>
                      {canEdit && m.kind === "press" && <label className="flex items-center gap-1 text-xs text-gray-600" title="Plate tonight for this print date"><input type="checkbox" checked={!!j.plate} disabled={busy === "PLATING"} onChange={(e) => plate(j, e.target.checked)} />Plate</label>}
                      {canEdit && m.kind !== "plating" && <div className="flex gap-1">
                        <button type="button" aria-label={`Move ${j.jobNumber} up`} disabled={i === 0 || !!busy} onClick={() => move(m, i, -1)} className="rounded border border-gray-200 p-1 disabled:opacity-30 hover:bg-gray-50"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Move ${j.jobNumber} down`} disabled={i === m.jobs.length - 1 || !!busy} onClick={() => move(m, i, 1)} className="rounded border border-gray-200 p-1 disabled:opacity-30 hover:bg-gray-50"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">Digital and Bindery follow the job's status (DIG, BND). Plating is your nightly pick from the press lists. Hand Bindery stays on your own sheet.</p>
    </div>
  );
}
