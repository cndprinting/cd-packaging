"use client";

// Darrin's machine schedules (11/18/26). Jobs land here from his routing; he
// sets the order with the arrows; each machine prints on its own sheet.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Loader2, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type J = { id: string; jobNumber: string; name: string; quantity: number; dueDate: string | null; customer: string; inks: string | null; foils: string | null; dieNumber: string | null; routeStatus: string | null; notes: string | null; priority: string; placed: boolean };
type M = { code: string; name: string; kind: string; jobs: J[] };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "");

export default function MachineSchedulesPage() {
  const [ms, setMs] = useState<M[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { fetch("/api/schedule/machines").then((r) => r.json()).then((d) => { setMs(d.machines || []); setCanEdit(!!d.canEdit); }).catch(() => setMs([])); }, []);

  const move = async (m: M, i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= m.jobs.length) return;
    const jobs = [...m.jobs]; [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
    setMs((prev) => (prev || []).map((x) => (x.code === m.code ? { ...x, jobs } : x)));
    setBusy(m.code);
    const r = await fetch("/api/schedule/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machineCode: m.code, order: jobs.map((x) => x.id) }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.machines?.[0]) setMs((prev) => (prev || []).map((x) => (x.code === m.code ? d.machines[0] : x)));
    setBusy(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/schedule" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Back to schedule"><ArrowLeft className="h-4 w-4 text-gray-600" /></Link>
          <div><h1 className="text-2xl font-bold text-gray-900">Machine schedules</h1><p className="text-sm text-gray-500">From the plant routing on each job. {canEdit ? "Use the arrows to set the order; the printout follows it." : "Darrin sets the order."}</p></div>
        </div>
        <a href="/print/schedules" target="_blank" rel="noreferrer"><Button className="gap-2"><Printer className="h-4 w-4" />Print all schedules</Button></a>
      </div>
      {!ms ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ms.map((m) => (
            <div key={m.code} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <span className="font-semibold text-gray-900">{m.name} <span className="text-sm font-normal text-gray-400">{m.jobs.length} job{m.jobs.length === 1 ? "" : "s"}</span>{busy === m.code && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-gray-400" />}</span>
                <a href={`/print/schedules?m=${m.code}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><Printer className="h-3.5 w-3.5" />Print</a>
              </div>
              {m.jobs.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">Nothing routed here yet</div> : (
                <ol className="divide-y divide-gray-50">
                  {m.jobs.map((j, i) => (
                    <li key={j.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-5 text-right text-xs text-gray-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <a href={`/dashboard/jobs/${j.id}#routing`} className="font-medium text-gray-900 hover:underline">{j.jobNumber}</a> <span className="text-gray-600">· {j.customer} · {j.name}</span>
                        <div className="text-xs text-gray-500">{[(j.quantity || 0).toLocaleString(), j.dueDate && `due ${day(j.dueDate)}`, j.inks && `ink ${j.inks}`, j.foils && `foil ${j.foils}`, j.dieNumber && `die ${j.dieNumber}`].filter(Boolean).join(" · ")}</div>
                      </div>
                      {canEdit && <div className="flex gap-1">
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
      <p className="text-xs text-gray-400">Plating, Digital, Bindery, Folder and Stitcher schedules are coming once Darrin confirms how jobs land on them.</p>
    </div>
  );
}
