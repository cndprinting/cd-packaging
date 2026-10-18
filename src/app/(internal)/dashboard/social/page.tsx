"use client";

// Social media idea generator (Benjy 10/18). Albert, Nitay, Simon and Benjy.
// Three buttons: ideas from newly closed accounts, a 3-month posting plan,
// and a web scan of what packaging accounts are posting that works. Ideas
// persist (SocialIdea) and can be marked planned / posted / dropped.

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Lock, Loader2, Sparkles, CalendarDays, Globe, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Idea = { id: string; kind: string; title: string; body: string; source: string | null; status: string; createdBy: string | null; createdAt: string };

const KINDS = [
  { key: "accounts", label: "Ideas from new accounts", icon: Sparkles, help: "Reads accounts that moved to Existing customers in the last 120 days and pitches shoots, unboxings and founder stories around them. Anything naming a customer needs their OK first." },
  { key: "plan", label: "3-month posting plan", icon: CalendarDays, help: "12 weekly entries across Instagram, LinkedIn and TikTok, rotating cartons, pouches and stick packs, print and mail. Add notes below to steer it." },
  { key: "trends", label: "Scan what's working now", icon: Globe, help: "Searches the public web for packaging and print content that is getting traction right now and adapts it to our floor. Instagram and TikTok do not allow scraping, so this reads what is public and cites the page." },
] as const;

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-gray-100 text-gray-700" },
  planned: { label: "Planned", cls: "bg-sky-100 text-sky-800" },
  posted: { label: "Posted", cls: "bg-emerald-100 text-emerald-800" },
  dropped: { label: "Dropped", cls: "bg-gray-200 text-gray-500 line-through" },
};

export default function SocialPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [hideDropped, setHideDropped] = useState(true);

  const load = () => fetch("/api/social").then(async (r) => {
    if (r.status === 401 || r.status === 403) { setForbidden(true); return; }
    const d = await r.json(); setIdeas(d.ideas || []);
  }).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const generate = async (kind: string) => {
    setBusy(kind); setMsg(null);
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, notes }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Generation failed"); return; }
      setIdeas(d.ideas || []); setTab(kind);
      setMsg(`${d.added} new ideas added`);
    } catch { setMsg("Generation failed"); }
    finally { setBusy(null); }
  };

  const setStatus = async (id: string, status: string) => {
    setIdeas((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    await fetch("/api/social", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => {});
  };

  const shown = useMemo(() => ideas.filter((i) => (tab === "all" || i.kind === tab) && (!hideDropped || i.status !== "dropped")), [ideas, tab, hideDropped]);
  const counts = useMemo(() => { const c: Record<string, number> = { all: 0 }; for (const i of ideas) { if (hideDropped && i.status === "dropped") continue; c.all++; c[i.kind] = (c[i.kind] || 0) + 1; } return c; }, [ideas, hideDropped]);

  if (forbidden) return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
      <h1 className="text-lg font-semibold text-gray-800">Owners and sales leads only</h1>
      <p className="mt-1 text-sm text-gray-500">The social media tab is for Benjy, Nitay, Albert and Simon.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900"><Megaphone className="h-5 w-5 text-brand-600" /> Social Media</h1>
          <p className="mt-0.5 text-sm text-gray-500">AI idea generator for C&amp;D's Instagram, LinkedIn and TikTok. Nothing posts by itself; this gives the team the list.</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {KINDS.map((k) => (
            <div key={k.key} className="flex flex-col rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><k.icon className="h-4 w-4 text-brand-600" />{k.label}</div>
              <p className="mt-1 flex-1 text-xs text-gray-500">{k.help}</p>
              <Button size="sm" className="mt-3 self-start" disabled={!!busy} onClick={() => generate(k.key)}>
                {busy === k.key ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Working…</> : "Generate"}
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-600">Notes to steer it (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. push the Flex line hard this quarter, Albert on camera, no customer names"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        {msg && <div className="mt-2 text-xs text-gray-600">{msg}</div>}
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[{ key: "all", label: "All" }, ...KINDS.map((k) => ({ key: k.key, label: k.label }))].map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`rounded-full border px-2.5 py-1 ${tab === t.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            {t.label} <span className="text-gray-400">{counts[t.key] || 0}</span>
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-1 text-gray-500"><input type="checkbox" checked={hideDropped} onChange={(e) => setHideDropped(e.target.checked)} /> Hide dropped</label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">No ideas yet. Hit Generate above.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((i) => (
            <Card key={i.id} className={`p-3 ${i.status === "dropped" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{i.title}</div>
                  <div className="mt-0.5 text-[11px] text-gray-400">{KINDS.find((k) => k.key === i.kind)?.label || i.kind} · {new Date(i.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{i.createdBy ? ` · ${i.createdBy}` : ""}</div>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS[i.status]?.cls || STATUS.new.cls}`}>{STATUS[i.status]?.label || i.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{i.body}</p>
              {i.source && i.source !== "plan" && (
                <div className="mt-1 truncate text-[11px] text-gray-400">Source: {/^https?:\/\//.test(i.source) ? <a href={i.source} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{i.source}</a> : i.source}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {["new", "planned", "posted"].map((s) => (
                  <button key={s} type="button" disabled={i.status === s} onClick={() => setStatus(i.id, s)}
                    className={`rounded border px-2 py-0.5 text-[11px] ${i.status === s ? "border-gray-300 bg-gray-100 text-gray-500" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>{STATUS[s].label}</button>
                ))}
                {i.status !== "dropped" && (
                  <button type="button" onClick={() => setStatus(i.id, "dropped")} className="ml-auto inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-500 hover:text-red-600"><Trash2 className="h-3 w-3" />Drop</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
