"use client";

// Jobs & Job Tickets (relaid out 11/18/26, Benjy: "looks like a mess").
// One compact row per job; tabs use Darrin's FileMaker statuses (New until he
// routes it, then his WIP statuses; Darrin changes Status + Press in the row);
// "Waiting on" says in plain words what's holding each job. Test jobs from
// before go-live are hidden unless asked for.
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, Loader2, ArrowUpDown, Copy } from "lucide-react";
import { ReorderDialog } from "@/components/jobs/reorder-dialog";
import { StatusBoard } from "@/components/jobs/status-board";
import { JobIntake, type IntakePrefill } from "@/components/jobs/job-intake";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getStatusColor, getStatusLabel } from "@/lib/utils";

interface Job {
  id: string; jobNumber: string; name: string; companyName: string; status: string; priority: string; quantity: number;
  dueDate: string; isLate: boolean; productType?: string; csrName: string; salesRepName: string;
  routeStatus: string | null; pressAssignment?: string | null; isTest?: boolean; pay?: { label: string; tone: string } | null; board?: any; routed: boolean; test: boolean; tab: string; waitingOn: string;
}

const TABS: { key: string; label: string; hint: string }[] = [
  // Darrin's WIP: everything still in progress. Delivered jobs drop off but stay under DEL and in search (11/20).
  { key: "wip", label: "WIP", hint: "Every job still in progress (not delivered)" },
  { key: "new", label: "New", hint: "Entered, no status yet" },
  // Darrin's FileMaker WIP Status list, in his order (11/20).
  { key: "PRE", label: "PRE", hint: "Prepress" },
  { key: "KOM", label: "KOM", hint: "Komori" },
  { key: "Ricoh", label: "Ricoh", hint: "Ricoh" },
  { key: "DIG", label: "DIG", hint: "Digital" },
  { key: "BND", label: "BND", hint: "Bindery" },
  { key: "Diecut", label: "Diecut", hint: "Die cutting" },
  { key: "GLUE", label: "GLUE", hint: "Gluing" },
  { key: "SeCap", label: "SeCap", hint: "SeCap" },
  { key: "Inserter", label: "Inserter", hint: "Inserter" },
  { key: "P/O", label: "P/O", hint: "Packout: hand-packing boxes to the customer's per-location list" },
  { key: "ASI", label: "ASI", hint: "ASI" },
  { key: "OUT", label: "OUT", hint: "Outside vendor" },
  { key: "COMP", label: "COMP", hint: "Complete, includes packed jobs on Shayla's list" },
  { key: "DEL", label: "DEL", hint: "Delivered, includes shipped and invoiced jobs" },
  { key: "HLD", label: "HLD", hint: "On hold" },
  { key: "all", label: "All", hint: "" },
];
type SortKey = "due" | "job" | "customer" | "qty";
const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [tab, setTab] = useState("wip");
  const [search, setSearch] = useState("");
  const [deepResults, setDeepResults] = useState<any[] | null>(null);
  const [deepSearching, setDeepSearching] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [showTest, setShowTest] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "due", dir: 1 });
  // Sales handoff + new job forms (Benjy 11/17)
  const [intake, setIntake] = useState<{ mode: "handoff" | "job"; prefill: IntakePrefill } | null>(null);
  const [role, setRole] = useState("");
  const [reorder, setReorder] = useState(false);
  const [queueKey, setQueueKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(null), 8000); };
  const ENTER = ["CSR", "OWNER", "ADMIN", "GM", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"];
  const [wip, setWip] = useState<{ statuses: [string, string][]; presses: [string, string][]; canPress: boolean } | null>(null);
  const [wipErr, setWipErr] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  // List or Status board (Mike 11/23/26), remembered per person on this computer.
  const [view, setView] = useState<"list" | "board">("list");
  useEffect(() => { try { if (localStorage.getItem("gz-jobs-view") === "board") setView("board"); } catch {} }, []);
  const pickView = (v: "list" | "board") => { setView(v); try { localStorage.setItem("gz-jobs-view", v); } catch {} };
  const reloadJobs = () => fetch("/api/jobs").then((r) => r.json()).then((d) => { setJobs(d.jobs || []); setWip(d.wip || null); setTestMode(!!d.testMode); }).catch(() => setJobs([]));
  // Darrin's WIP screen: change Status / Press right in the row (11/20).
  const setRoute = async (j: Job, field: "routeStatus" | "pressAssignment", value: string) => {
    setWipErr(null);
    const before = jobs;
    const derived = j.tab === "DEL" || (j.tab === "COMP" && j.routeStatus !== "COMP");
    setJobs((js) => (js || []).map((x) => x.id !== j.id ? x : { ...x, [field]: value || null, ...(field === "routeStatus" ? { routed: true, tab: derived ? x.tab : value } : {}) }));
    try {
      const r = await fetch(`/api/jobs/${j.id}/routing`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      if (!r.ok) { const x = await r.json().catch(() => ({})); setJobs(before); setWipErr(`${j.jobNumber}: ${x.error || "Could not save"}`); }
    } catch { setJobs(before); setWipErr(`${j.jobNumber}: Could not save`); }
  };
  useEffect(() => {
    reloadJobs();
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setRole(d.user?.role || "")).catch(() => {});
    // Old links from the pipeline go to the CSR Job Queue now.
    if (new URLSearchParams(window.location.search).get("handoff")) window.location.replace(`/dashboard/csr-queue${window.location.search}`);
  }, []);

  // Deep server-side search across all fields (debounced)
  useEffect(() => {
    if (search.length < 3) { setDeepResults(null); return; }
    const timeout = setTimeout(async () => {
      setDeepSearching(true);
      try { const res = await fetch(`/api/jobs/search?q=${encodeURIComponent(search)}`); const data = await res.json(); setDeepResults(data.jobs || []); } catch { setDeepResults(null); }
      setDeepSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const visible = useMemo(() => (jobs || []).filter((j) => showTest || !j.test), [jobs, showTest]);
  const counts = useMemo(() => { const c: Record<string, number> = { all: visible.length, wip: visible.filter((j) => j.tab !== "DEL").length }; for (const j of visible) c[j.tab] = (c[j.tab] || 0) + 1; return c; }, [visible]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = visible.filter((j) => {
      if (tab === "wip" ? j.tab === "DEL" : tab !== "all" && j.tab !== tab) return false;
      if (q && ![j.name, j.jobNumber, j.companyName].some((v) => (v || "").toLowerCase().includes(q))) return false;
      if (priorityFilter && j.priority !== priorityFilter) return false;
      if (customerFilter && j.companyName !== customerFilter) return false;
      if (repFilter && (j.salesRepName || "") !== repFilter) return false;
      if (productTypeFilter && j.productType !== productTypeFilter) return false;
      return true;
    });
    const val = (j: Job) => sort.key === "due" ? (j.dueDate || "9999") : sort.key === "job" ? j.jobNumber : sort.key === "customer" ? j.companyName.toLowerCase() : j.quantity;
    return [...list].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [visible, tab, search, priorityFilter, customerFilter, productTypeFilter, repFilter, sort]);
  const customers = useMemo(() => [...new Set(visible.map((j) => j.companyName))].sort(), [visible]);
  const reps = useMemo(() => [...new Set(visible.map((j) => j.salesRepName).filter(Boolean))].sort(), [visible]);
  const testCount = (jobs || []).filter((j) => j.test).length;
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const Th = ({ k, children, className = "" }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 ${className}`}>
      {k ? <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-gray-800">{children}<ArrowUpDown className="h-3 w-3" /></button> : children}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs &amp; Job Tickets</h1>
          <p className="text-sm text-gray-500">{rows.length} of {visible.length} jobs</p>
          {testMode && <p className="mt-1 rounded-md bg-yellow-100 px-2 py-1 text-xs text-yellow-900"><b>December test mode:</b> jobs you enter are TEST jobs. Try anything. They never reach invoicing, shipping, customers or the live team. FileMaker is still the real system until January 1.</p>}
        </div>
        <div className="flex gap-2">
          {/* Send won job to CSR lives on the sales side (Benjy 11/18): this page is the job ticket board. */}
          {(ENTER.includes(role) || !role) && <Button variant="outline" onClick={() => setReorder(true)} className="gap-2"><Copy className="h-4 w-4" /> Reorder a past job</Button>}
          {(ENTER.includes(role) || !role) && <Button onClick={() => setIntake({ mode: "job", prefill: {} })} className="gap-2"><Plus className="h-4 w-4" /> New Job</Button>}
        </div>
      </div>
      {note && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</div>}
      {/* Won jobs waiting to become tickets live in the CSR Job Queue (Benjy 11/18). */}

      {/* Tabs: Darrin's statuses */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} title={t.hint} onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
            {t.label} <span className="text-xs text-gray-400">{counts[t.key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search job #, customer, job name (3+ letters also searches PO#, die#, ink...)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} placeholder="All Priorities" options={[{ value: "", label: "All Priorities" }, { value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} className="w-36" />
        <Select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} options={[{ value: "", label: "All Salespeople" }, ...reps.map((r) => ({ value: r, label: r }))]} className="w-40" />
        <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} placeholder="All Customers" options={[{ value: "", label: "All Customers" }, ...customers.map((c) => ({ value: c, label: c }))]} className="w-44" />
        <Select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)} options={[{ value: "", label: "All Types" }, { value: "FOLDING_CARTON", label: "Folding Carton" }, { value: "COMMERCIAL_PRINT", label: "Commercial Print" }]} className="w-40" />
        {testCount > 0 && <label className="flex items-center gap-1.5 text-xs text-gray-500"><input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />Show test jobs ({testCount})</label>}
      </div>

      {/* Deep search results */}
      {search.length >= 3 && (deepSearching || (deepResults && deepResults.length > 0)) && (
        <Card className="border-blue-200 bg-blue-50/30 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-900"><Search className="h-4 w-4" />Also matching &quot;{search}&quot; in other fields{deepSearching && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}</div>
          {deepResults && deepResults.map((r: any) => (
            <Link key={r.id} href={`/dashboard/jobs/${r.id}`} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-blue-100/50">
              <span><span className="font-mono text-xs text-gray-500">{r.jobNumber}</span> <span className="font-medium text-gray-900">{r.name}</span> <span className="text-xs text-gray-500">{r.companyName}</span></span>
              <span className="flex items-center gap-2 text-xs text-gray-400">{r.dieNumber && <span>Die {r.dieNumber}</span>}{r.inkFront && <span>Ink {r.inkFront}/{r.inkBack}</span>}<Badge className={getStatusColor(r.status)}>{getStatusLabel(r.status)}</Badge></span>
            </Link>
          ))}
        </Card>
      )}

      {wipErr && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{wipErr}</div>}
      {/* List or Status board */}
      <div className="flex items-center gap-1 text-sm" role="group" aria-label="View">
        <span className="mr-1 text-gray-500">View</span>
        {([["list", "List"], ["board", "Status board"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => pickView(k)} className={`rounded-md border px-3 py-1 ${view === k ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{l}</button>)}
      </div>
      {/* The table */}
      <Card className="overflow-x-auto p-0">
        {jobs === null ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : view === "board" ? <StatusBoard rows={rows as any} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60"><tr>
              <Th k="job">Job #</Th><Th k="customer">Customer</Th><Th>Job</Th><Th k="qty" className="text-right">Qty</Th><Th k="due">Due</Th><Th>Status</Th>{wip && <Th>Press</Th>}<Th>Waiting on</Th><Th>Payment</Th><Th>CSR</Th><Th>Rep</Th>
            </tr></thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} className={`border-b border-gray-50 hover:bg-gray-50 ${j.test ? "opacity-60" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-2"><Link href={`/dashboard/jobs/${j.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{j.jobNumber}</Link>{j.isTest && <span className="ml-1 rounded bg-yellow-300 px-1 text-[10px] font-bold text-yellow-900" title="TEST job (December test mode): never reaches invoicing, shipping, customers or the live team">TEST</span>}{(j.priority === "HIGH" || j.priority === "URGENT") && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700">{j.priority}</span>}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-gray-800">{j.companyName}</td>
                  <td className="max-w-[260px] truncate px-3 py-2"><Link href={`/dashboard/jobs/${j.id}`} className="text-gray-900 hover:underline">{j.name}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700">{(j.quantity || 0).toLocaleString()}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${j.isLate ? "font-semibold text-red-600" : "text-gray-700"}`}>{day(j.dueDate) || <span className="text-gray-300">-</span>}{j.isLate && " (late)"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{wip && (j.tab === j.routeStatus || j.tab === "new") ? (
                    <select aria-label={`Status for ${j.jobNumber}`} value={j.routeStatus || ""} onChange={(e) => setRoute(j, "routeStatus", e.target.value)} className={`h-7 rounded border px-1 text-xs font-medium ${j.routeStatus ? "border-gray-300 text-gray-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                      {!j.routeStatus && <option value="">New</option>}
                      {wip.statuses.map(([k]) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  ) : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">{TABS.find((t) => t.key === j.tab)?.label || j.tab}</span>}</td>
                  {wip && <td className="whitespace-nowrap px-3 py-2">{wip.canPress && j.tab !== "DEL" ? (
                    <select aria-label={`Press for ${j.jobNumber}`} value={j.pressAssignment || ""} onChange={(e) => setRoute(j, "pressAssignment", e.target.value)} className="h-7 rounded border border-gray-300 px-1 text-xs">
                      <option value="">-</option>
                      {wip.presses.map(([k, l]) => <option key={k} value={k}>{l.replace(/ \(\d+\)$/, "")}</option>)}
                      {j.pressAssignment && !wip.presses.some(([k]) => k === j.pressAssignment) && <option value={j.pressAssignment}>{j.pressAssignment}</option>}
                    </select>
                  ) : <span className="text-xs text-gray-500">{wip.presses.find(([k]) => k === j.pressAssignment)?.[1].replace(/ \(\d+\)$/, "") || j.pressAssignment || "-"}</span>}</td>}
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">{j.waitingOn || <span className="text-gray-300">-</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2">{j.pay ? <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${j.pay.tone === "ok" ? "bg-emerald-50 text-emerald-800" : j.pay.tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"}`}>{j.pay.label}</span> : <span className="text-gray-300">-</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{j.csrName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{j.salesRepName || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={wip ? 11 : 10} className="py-12 text-center text-gray-400">{visible.length === 0 ? (testCount ? "No real jobs yet. Tick \"Show test jobs\" to see the old test ones." : "No jobs yet.") : "No jobs match."}</td></tr>}
            </tbody>
          </table>
        )}
      </Card>

      {reorder && <ReorderDialog onClose={() => setReorder(false)} />}
      {intake && <JobIntake mode={intake.mode} prefill={intake.prefill} onClose={() => setIntake(null)} onDone={(m) => { setIntake(null); flash(m); setQueueKey((k) => k + 1); reloadJobs(); }} />}
    </div>
  );
}
