"use client";

// Talent tracker (Benjy 7/19) — recruiting pipeline for print/packaging sales
// hires. Owners-only (same pipelineAccess gate as the sales pipeline).

import { useState, useEffect, useMemo } from "react";
import { UserSearch, Lock, Loader2, Plus, X, ChevronRight, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Talent = {
  id: string; name: string; company: string | null; title: string | null;
  city: string | null; state: string | null; email: string | null; phone: string | null;
  linkedinUrl: string | null; background: string | null; source: string | null;
  status: string; rating: number | null; ownerName: string | null; notes: string | null;
  nextStepAt: string | null; updatedAt: string;
};

const STATUSES = [
  { key: "SOURCED", label: "Sourced", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  { key: "CONTACTED", label: "Contacted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "INTERVIEWING", label: "Interviewing", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "OFFER", label: "Offer", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "HIRED", label: "Hired", cls: "bg-green-50 text-green-700 border-green-200" },
  { key: "PASSED", label: "Passed", cls: "bg-gray-200 text-gray-500 border-gray-300" },
] as const;
const OWNERS = ["Benjy", "Albert", "Nitay", "TBD"];
const selCls = "h-8 w-full rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none";

export default function TalentPage() {
  const [rows, setRows] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = () => {
    fetch("/api/talent")
      .then((r) => { if (r.status === 403 || r.status === 401) { setForbidden(true); return { talent: [] }; } return r.json(); })
      .then((d) => setRows(d.talent || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const update = async (id: string, patch: Record<string, unknown>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } as Talent : r)));
    // Confirm the save landed — silent failures cost Benjy/Nitay their pipeline
    // edits on 7/20; never let the screen lie about saved state.
    try {
      const res = await fetch("/api/talent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      alert("That change did NOT save (server hiccup). Refreshing - please re-enter it.");
      load();
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this candidate?")) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await fetch(`/api/talent?id=${id}`, { method: "DELETE" });
  };
  const add = async () => {
    if (!form.name?.trim()) return;
    const res = await fetch("/api/talent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setForm({}); setShowAdd(false); load(); }
  };

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [r.name, r.company, r.title, r.city, r.background, r.notes].some((v) => (v || "").toLowerCase().includes(q));
  }), [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  const chip = (s: string) => STATUSES.find((x) => x.key === s) || STATUSES[0];

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (forbidden) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Lock className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-600 font-medium">This section is restricted.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserSearch className="h-6 w-6 text-brand-600" />
          <h1 className="text-xl font-bold text-gray-900">Talent</h1>
          <span className="text-sm text-gray-500">{rows.length} candidates</span>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Add candidate</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStatusFilter("")} className={`rounded-full border px-3 py-1 text-xs font-medium ${!statusFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300"}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? "" : s.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${statusFilter === s.key ? "bg-gray-900 text-white border-gray-900" : s.cls}`}>
            {s.label}{counts[s.key] ? ` (${counts[s.key]})` : ""}
          </button>
        ))}
        <Input placeholder="Search name, company, city..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-64 ml-auto" />
      </div>

      {showAdd && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">New candidate</h2>
            <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[["name", "Name *"], ["company", "Current company"], ["title", "Title"], ["city", "City"], ["email", "Email"], ["phone", "Phone"], ["linkedinUrl", "LinkedIn URL"], ["source", "Source"]].map(([k, ph]) => (
              <Input key={k} placeholder={ph} value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="h-8 text-xs" />
            ))}
            <Input placeholder="Background (what they sell)" value={form.background || ""} onChange={(e) => setForm((f) => ({ ...f, background: e.target.value }))} className="h-8 text-xs col-span-2 md:col-span-4" />
          </div>
          <Button size="sm" onClick={add} disabled={!form.name?.trim()}>Save</Button>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 w-6"></th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2 w-32">Status</th>
              <th className="px-3 py-2 w-24">Owner</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <>
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-3 py-2"><ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded === r.id ? "rotate-90" : ""}`} /></td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {r.name}
                    {r.linkedinUrl && <a href={r.linkedinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block ml-1 align-middle text-brand-600"><ExternalLink className="h-3 w-3" /></a>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.company || "-"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.title || "-"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.city || "-"}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select className={selCls} value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select className={selCls} value={r.ownerName || ""} onChange={(e) => update(r.id, { ownerName: e.target.value })}>
                      <option value="">-</option>
                      {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-x`} className="border-b border-gray-100 bg-gray-50/60">
                    <td></td>
                    <td colSpan={7} className="px-3 py-3">
                      <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-700">
                        <div className="space-y-1.5">
                          {r.background && <p><span className="font-semibold">Background:</span> {r.background}</p>}
                          {r.email && <p><span className="font-semibold">Email:</span> {r.email}</p>}
                          {r.phone && <p><span className="font-semibold">Phone:</span> {r.phone}</p>}
                          {r.source && <p className="break-all"><span className="font-semibold">Source:</span> {/^https?:/.test(r.source) ? <a href={r.source} target="_blank" rel="noreferrer" className="text-brand-600 underline">{r.source}</a> : r.source}</p>}
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Notes</p>
                          <textarea
                            className="w-full rounded-md border border-gray-300 bg-white p-2 text-xs min-h-[70px] focus:border-brand-500 focus:outline-none"
                            defaultValue={r.notes || ""}
                            onBlur={(e) => { if (e.target.value !== (r.notes || "")) update(r.id, { notes: e.target.value }); }}
                            placeholder="Owner notes, call outcomes, comp asks..."
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400 text-sm">No candidates match.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
