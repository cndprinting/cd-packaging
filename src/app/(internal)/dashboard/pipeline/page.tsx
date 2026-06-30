"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import { TrendingUp, Lock, Loader2, Plus, X, AlertTriangle, Link2, ChevronRight, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lead = {
  id: string; companyName: string; endMarket: string | null; productCategory: string | null;
  website: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  lastInteraction: string | null; priority: number | null; stage: string | null; pipelineStage: string;
  ownerName: string | null; volume: string | null; numbers: string | null; commentary: string | null; companyId: string | null; agentHold: boolean;
  followUpAt: string | null; followUpNote: string | null;
};

// Follow-up state: "due" = date is today or past, "upcoming" = future.
function dueState(l: Lead): "due" | "upcoming" | null {
  if (!l.followUpAt) return null;
  const d = new Date(l.followUpAt); const end = new Date(); end.setHours(23, 59, 59, 999);
  return d <= end ? "due" : "upcoming";
}
const fmtShort = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const PRODUCTS = ["Folding Carton", "Commercial Print", "Flexible Packaging", "Packaging", "Mailers"];
const OWNERS = ["Benjy", "Albert", "Nitay", "Kelsey", "TBD"];
const STAGE_LEAD = ["Break in", "Touch base", "Connected", "Requested info", "Quoting", "Meeting set", "Deprioritize", "Dead"];
const STAGE_QUAL = ["With C&D", "With customer", "Quoting", "N/A"];
const STAGES = [
  { key: "LEAD", label: "Leads" },
  { key: "QUALIFIED", label: "Qualified prospects" },
  { key: "CUSTOMER", label: "Existing customers" },
  { key: "LOST", label: "Lost" },
] as const;

const selCls = "h-8 w-full rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none";
const priColor = (p: number | null) => p === 1 ? "text-red-600" : p === 2 ? "text-amber-600" : "text-gray-400";

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [active, setActive] = useState<string>("LEAD");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dueOnly, setDueOnly] = useState(false);

  const load = () => {
    fetch("/api/leads")
      .then((r) => { if (r.status === 403 || r.status === 401) { setForbidden(true); return { leads: [] }; } return r.json(); })
      .then((d) => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { LEAD: 0, QUALIFIED: 0, CUSTOMER: 0, LOST: 0 };
    leads.forEach((l) => { c[l.pipelineStage] = (c[l.pipelineStage] || 0) + 1; });
    return c;
  }, [leads]);

  const dueCount = useMemo(() => leads.filter((l) => (l.pipelineStage === "LEAD" || l.pipelineStage === "QUALIFIED") && dueState(l) === "due").length, [leads]);

  const q = search.trim().toLowerCase();
  const visible = leads
    .filter((l) => l.pipelineStage === active)
    .filter((l) => !dueOnly || dueState(l) === "due")
    .filter((l) => !q || `${l.companyName} ${l.contactName || ""} ${l.contactEmail || ""} ${l.endMarket || ""} ${l.ownerName || ""} ${l.commentary || ""}`.toLowerCase().includes(q));

  // Optimistic inline patch.
  const patch = async (id: string, field: string, value: any) => {
    setLeads((p) => p.map((l) => l.id === id ? { ...l, [field]: value } : l));
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, [field]: value }) }).catch(() => {});
  };
  // Local-only edit (no save) — for controlled inputs that save on blur.
  const setLocal = (id: string, field: string, value: any) => setLeads((p) => p.map((l) => l.id === id ? { ...l, [field]: value } : l));
  const move = async (id: string, pipelineStage: string) => {
    setLeads((p) => p.map((l) => l.id === id ? { ...l, pipelineStage } : l));
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, pipelineStage }) }).catch(() => {});
  };
  const convert = async (id: string) => {
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, convert: true }) }).catch(() => {});
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (forbidden) return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <Lock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
      <h1 className="text-lg font-semibold text-gray-900">Restricted</h1>
      <p className="text-sm text-gray-500 mt-1">The sales pipeline is limited to authorized users.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
            <p className="text-sm text-gray-500">{leads.length} records across 4 stages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dueCount > 0 && (
            <button onClick={() => setDueOnly((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg text-xs px-2.5 py-1.5 ${dueOnly ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700"}`}>
              <Bell className="h-3.5 w-3.5" /> {dueCount} follow-up{dueCount > 1 ? "s" : ""} due
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs px-2.5 py-1.5"><Lock className="h-3.5 w-3.5" /> Private · Benjy, Nitay, Albert</span>
          <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus className="h-4 w-4" />Add lead</Button>
        </div>
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAGES.map((s) => (
          <button key={s.key} onClick={() => setActive(s.key)}
            className={`text-left rounded-xl p-3 transition-colors ${active === s.key ? "bg-white border-2 border-brand-500" : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"}`}>
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-2xl font-bold text-gray-900">{counts[s.key] || 0}</div>
          </button>
        ))}
      </div>

      <Input placeholder="Search company, market, owner, notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Product</th>
                {active !== "LOST" && active !== "CUSTOMER" && <th className="px-3 py-2 font-medium">Stage</th>}
                {(active === "QUALIFIED" || active === "CUSTOMER" || active === "LOST") && <th className="px-3 py-2 font-medium">Volume</th>}
                <th className="px-3 py-2 font-medium">Owner</th>
                {active !== "CUSTOMER" && active !== "LOST" && <th className="px-3 py-2 font-medium w-14">Pri</th>}
                {active === "LEAD" && <th className="px-3 py-2 font-medium text-center w-16" title="Check to stop the outbound agent from emailing this lead">Hold</th>}
                {(active === "CUSTOMER" || active === "LOST") && <th className="px-3 py-2 font-medium">Notes</th>}
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <Fragment key={l.id}>
                <tr className="border-t border-gray-100 align-middle">
                  <td className="px-3 py-2">
                    <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="flex items-center gap-1.5 text-left group">
                      <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded === l.id ? "rotate-90" : ""}`} />
                      <span>
                        <span className="font-medium text-gray-900 group-hover:text-brand-700">{l.companyName}</span>
                        {(() => { const d = dueState(l); if (!d || !l.followUpAt) return l.endMarket ? <span className="block text-xs text-gray-400">{l.endMarket}</span> : null;
                          return <span className={`block text-xs ${d === "due" ? "text-amber-600 font-medium" : "text-gray-400"}`}>{d === "due" ? "● Follow up due" : `Follow-up ${fmtShort(l.followUpAt)}`}</span>; })()}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 min-w-[130px]">
                    <select className={selCls} value={l.productCategory || ""} onChange={(e) => patch(l.id, "productCategory", e.target.value)}>
                      <option value="">—</option>
                      {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  {active !== "LOST" && active !== "CUSTOMER" && (
                    <td className="px-3 py-2 min-w-[140px]">
                      <select className={selCls} value={l.stage || ""} onChange={(e) => patch(l.id, "stage", e.target.value)}>
                        <option value="">—</option>
                        {(active === "QUALIFIED" ? STAGE_QUAL : STAGE_LEAD).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  )}
                  {(active === "QUALIFIED" || active === "CUSTOMER" || active === "LOST") && (
                    <td className="px-3 py-2 min-w-[100px]">
                      <Input className="h-8 text-xs" value={l.volume || ""} placeholder="—" onChange={(e) => setLeads((p) => p.map((x) => x.id === l.id ? { ...x, volume: e.target.value } : x))} onBlur={(e) => patch(l.id, "volume", e.target.value)} />
                    </td>
                  )}
                  <td className="px-3 py-2 min-w-[110px]">
                    <select className={selCls} value={l.ownerName || ""} onChange={(e) => patch(l.id, "ownerName", e.target.value)}>
                      <option value="">—</option>
                      {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  {active !== "CUSTOMER" && active !== "LOST" && (
                    <td className="px-3 py-2">
                      <select className={`${selCls} font-semibold ${priColor(l.priority)}`} value={l.priority || ""} onChange={(e) => patch(l.id, "priority", e.target.value ? Number(e.target.value) : null)}>
                        <option value="">—</option>
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                      </select>
                    </td>
                  )}
                  {active === "LEAD" && (
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" title="Don't email (agent) — check to keep the outbound agent away from this lead" checked={!!l.agentHold} onChange={(e) => { const v = e.target.checked; setLeads((p) => p.map((x) => x.id === l.id ? { ...x, agentHold: v } : x)); patch(l.id, "agentHold", v); }} />
                    </td>
                  )}
                  {(active === "CUSTOMER" || active === "LOST") && (
                    <td className="px-3 py-2 min-w-[200px]">
                      <Input className="h-8 text-xs" value={l.commentary || ""} placeholder="—" onChange={(e) => setLeads((p) => p.map((x) => x.id === l.id ? { ...x, commentary: e.target.value } : x))} onBlur={(e) => patch(l.id, "commentary", e.target.value)} />
                    </td>
                  )}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {active === "LEAD" && <button onClick={() => move(l.id, "QUALIFIED")} className="text-xs text-brand-600 hover:underline mr-3">Qualify →</button>}
                    {active === "QUALIFIED" && <button onClick={() => move(l.id, "LEAD")} className="text-xs text-gray-500 hover:underline mr-3">← Lead</button>}
                    {active === "QUALIFIED" && <button onClick={() => convert(l.id)} className="text-xs text-emerald-700 hover:underline mr-3">Won → customer</button>}
                    {active === "CUSTOMER" && <button onClick={() => move(l.id, "QUALIFIED")} className="text-xs text-gray-500 hover:underline mr-3">← Qualified</button>}
                    {active === "CUSTOMER" && (l.companyId
                      ? <Link href={`/dashboard/customers`} className="text-xs text-brand-600 hover:underline mr-3 inline-flex items-center gap-1"><Link2 className="h-3 w-3" />Customer</Link>
                      : <button onClick={() => convert(l.id)} className="text-xs text-brand-600 hover:underline mr-3">Link customer</button>)}
                    {active === "LOST"
                      ? <button onClick={() => move(l.id, "LEAD")} className="text-xs text-gray-500 hover:underline">Reopen</button>
                      : <button onClick={() => move(l.id, "LOST")} className="text-xs text-red-500 hover:underline">Lost</button>}
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr key={l.id + "-x"} className="bg-gray-50/70 border-t border-gray-100">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                        {([["website", "Website"], ["contactName", "Contact name"], ["contactTitle", "Contact title"], ["contactEmail", "Contact email"], ["contactPhone", "Primary phone"], ["endMarket", "End market"]] as const).map(([f, label]) => (
                          <div key={f}>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                            <Input className="h-8 text-xs" value={(l as any)[f] || ""} onChange={(e) => setLocal(l.id, f, e.target.value)} onBlur={(e) => patch(l.id, f, e.target.value)} />
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up date <span className="text-gray-400 font-normal">— emails the owner when due</span></label>
                          <Input type="date" className="h-8 text-xs" value={l.followUpAt ? l.followUpAt.slice(0, 10) : ""} onChange={(e) => patch(l.id, "followUpAt", e.target.value || null)} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Reminder note</label>
                          <Input className="h-8 text-xs" value={l.followUpNote || ""} placeholder="e.g. Call Reid about the carton specs" onChange={(e) => setLocal(l.id, "followUpNote", e.target.value)} onBlur={(e) => patch(l.id, "followUpNote", e.target.value)} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Numbers <span className="text-gray-400 font-normal">— dump every number you collect here</span></label>
                          <textarea rows={2} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" value={l.numbers || ""} placeholder="e.g. 305-555-0100 (cell) · 727-555-0199 (office) · 954-555-0123 (Reid)" onChange={(e) => setLocal(l.id, "numbers", e.target.value)} onBlur={(e) => patch(l.id, "numbers", e.target.value)} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                          <textarea rows={2} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" value={l.commentary || ""} onChange={(e) => setLocal(l.id, "commentary", e.target.value)} onBlur={(e) => patch(l.id, "commentary", e.target.value)} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {visible.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">{q ? "No matches." : "Nothing in this stage yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ companyName: "", endMarket: "", productCategory: "Folding Carton", website: "", contactName: "", contactEmail: "", ownerName: "Benjy", priority: "1", stage: "Break in" });
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState<{ leads: any[]; companies: any[]; quotes: any[] } | null>(null);
  const upd = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Triangulation — check for existing records as they type the company name.
  useEffect(() => {
    const name = form.companyName.trim();
    if (name.length < 2) { setDupes(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/leads?check=${encodeURIComponent(name)}`).then((r) => r.json()).then(setDupes).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [form.companyName]);

  const save = async () => {
    if (!form.companyName) return;
    setSaving(true);
    await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => {});
    setSaving(false);
    onSaved();
  };

  const hasDupes = dupes && (dupes.leads.length + dupes.companies.length + dupes.quotes.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Add lead</h2><button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button></div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
              <Input value={form.companyName} onChange={(e) => upd("companyName", e.target.value)} placeholder="Company name" />
            </div>
            {hasDupes && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-medium mb-1"><AlertTriangle className="h-3.5 w-3.5" />Possible duplicate</div>
                {dupes!.companies.map((c) => <div key={c.id}>Already a customer: {c.name}</div>)}
                {dupes!.leads.map((l) => <div key={l.id}>Already in pipeline: {l.companyName} ({l.pipelineStage.toLowerCase()})</div>)}
                {dupes!.quotes.map((qq) => <div key={qq.id}>Has a quote: {qq.quoteNumber} — {qq.customerName}</div>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">End market</label><Input value={form.endMarket} onChange={(e) => upd("endMarket", e.target.value)} placeholder="e.g. Food & Bev" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select className={selCls + " h-9"} value={form.productCategory} onChange={(e) => upd("productCategory", e.target.value)}>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <select className={selCls + " h-9"} value={form.ownerName} onChange={(e) => upd("ownerName", e.target.value)}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select className={selCls + " h-9"} value={form.priority} onChange={(e) => upd("priority", e.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Website</label><Input value={form.website} onChange={(e) => upd("website", e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact</label><Input value={form.contactName} onChange={(e) => upd("contactName", e.target.value)} /></div>
            </div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save} disabled={saving || !form.companyName}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add lead"}</Button></div>
          </div>
        </div>
      </div>
    </>
  );
}
