"use client";

// Dashboard rebuilt on real data only (Benjy 11/23/26). Every number comes from the same
// /api/jobs feed the Jobs list uses (role-scoped, test-aware). No typed-in trends, no
// placeholder zeros, no canned insights. Old pre-go-live jobs never count.
import { ToRouteList } from "@/components/jobs/routing-panel";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Clock, Inbox, Package, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = {
  id: string; jobNumber: string; name: string; companyName: string; dueDate: string; isLate: boolean;
  tab: string; waitingOn: string; test: boolean; isTest?: boolean;
};

function Stat({ icon: Icon, tone, value, label, hint }: { icon: LucideIcon; tone: string; value: number; label: string; hint: string }) {
  return (
    <Link href="/dashboard/jobs" title={hint}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex items-start justify-between p-5">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-400">{hint}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
        </CardContent>
      </Card>
    </Link>
  );
}

const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [withTest, setWithTest] = useState(true);
  const [alerts, setAlerts] = useState<{ id: string; severity: string; message: string; createdAt: string }[]>([]);

  useEffect(() => {
    fetch("/api/jobs").then((r) => r.json()).then((d) => { setJobs(d.jobs || []); setTestMode(!!d.testMode); }).catch(() => setJobs([]));
    // Real alerts only (QA failures write these); hidden when there are none.
    fetch("/api/dashboard").then((r) => r.json()).then((d) => setAlerts(d.alerts || [])).catch(() => {});
  }, []);

  // Old jobs from before go-live never count. Test jobs count only for testers, only when ticked.
  const all = jobs || [];
  // j.test = before go-live OR a QA- number; only the QA- ones are current test jobs.
  const preLive = (j: Job) => j.test && !/^QA-/i.test(j.jobNumber);
  const testCount = all.filter((j) => !preLive(j) && (j.isTest || j.test)).length;
  const real = useMemo(() => all.filter((j) => !preLive(j) && (j.isTest || j.test ? withTest : true)), [all, withTest]);
  const wip = real.filter((j) => j.tab !== "DEL");
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10);
  const late = wip.filter((j) => j.isLate);
  const dueSoon = wip.filter((j) => !j.isLate && j.dueDate && j.dueDate >= today && j.dueDate <= week);
  const ready = wip.filter((j) => j.tab === "COMP");
  const newJobs = wip.filter((j) => j.tab === "new");

  // What every open job is waiting on, biggest pile first.
  const waiting = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of wip) { const k = j.waitingOn || "Not tracked"; m.set(k, [...(m.get(k) || []), j]); }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [wip]);
  const urgent = [...late, ...dueSoon].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Live from the job tickets. Click anything to open it.</p>
        {testCount > 0 && (
          <label className="mt-2 inline-flex items-center gap-2 rounded-md bg-yellow-100 px-2 py-1 text-xs text-yellow-900">
            <input type="checkbox" checked={withTest} onChange={(e) => setWithTest(e.target.checked)} />
            <span><b>{testMode ? "December test mode: " : ""}</b>Counting {testCount} test job{testCount === 1 ? "" : "s"}. Untick to see real jobs only.</span>
          </label>
        )}
      </div>

      <ToRouteList />

      {alerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-red-500" />Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => <p key={a.id} className="text-sm text-gray-700"><b className="mr-2 text-xs uppercase text-red-600">{a.severity}</b>{a.message} <span className="text-xs text-gray-400">{a.createdAt}</span></p>)}
          </CardContent>
        </Card>
      )}

      {jobs === null ? <p className="text-sm text-gray-400">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat icon={Package} tone="bg-blue-100 text-blue-600" value={wip.length} label="In progress" hint="Every job not yet delivered" />
            <Stat icon={Inbox} tone="bg-gray-100 text-gray-600" value={newJobs.length} label="New, not routed" hint="Waiting on a WIP status" />
            <Stat icon={AlertTriangle} tone="bg-red-100 text-red-600" value={late.length} label="Late" hint="Past due, not shipped" />
            <Stat icon={Calendar} tone="bg-amber-100 text-amber-600" value={dueSoon.length} label="Due in 7 days" hint="Not late yet" />
            <Stat icon={Truck} tone="bg-teal-100 text-teal-600" value={ready.length} label="Ready to ship" hint="Packed (COMP)" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5 text-brand-600" />Waiting on</CardTitle></CardHeader>
              <CardContent>
                {waiting.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">No open jobs.</p> : (
                  <ul className="divide-y divide-gray-100">
                    {waiting.map(([k, js]) => (
                      <li key={k} className="py-2">
                        <div className="flex items-center justify-between text-sm"><span className="font-medium text-gray-800">{k}</span><span className="rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-700">{js.length}</span></div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {js.slice(0, 8).map((j) => <Link key={j.id} href={`/dashboard/jobs/${j.id}`} title={`${j.companyName}: ${j.name}`} className="font-mono text-xs text-brand-700 hover:underline">{j.jobNumber}</Link>)}
                          {js.length > 8 && <Link href="/dashboard/jobs" className="text-xs text-gray-500 hover:underline">+{js.length - 8} more</Link>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-5 w-5 text-amber-500" />Late and due this week</CardTitle></CardHeader>
              <CardContent>
                {urgent.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Nothing late or due in the next 7 days.</p> : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {urgent.map((j) => (
                        <tr key={j.id} className="hover:bg-gray-50">
                          <td className="py-2 pr-2"><Link href={`/dashboard/jobs/${j.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{j.jobNumber}</Link>{j.isTest && <span className="ml-1 rounded bg-yellow-300 px-1 text-[10px] font-bold text-yellow-900">TEST</span>}</td>
                          <td className="max-w-[180px] truncate py-2 pr-2 text-gray-700">{j.companyName}</td>
                          <td className="py-2 pr-2 text-xs text-gray-500">{j.waitingOn}</td>
                          <td className={`whitespace-nowrap py-2 text-right ${j.isLate ? "font-semibold text-red-600" : "text-gray-700"}`}>{day(j.dueDate)}{j.isLate && " (late)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
