"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import Link from "next/link";
import { TrendingUp, Lock, Loader2, Plus, X, AlertTriangle, Link2, ChevronRight, Bell } from "lucide-react";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { NotesTimeline } from "@/components/leads/notes-timeline";
import { validateField, normalizeField, VALIDATED_FIELDS, type FieldName } from "@/lib/lead-validate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { US_STATES, REGIONS, TYPE_LABELS, ownerFirstName, type LeadMode, type LeadType, type LeadOrigin, type Region } from "@/lib/lead-view";

type Lead = {
  id: string; companyName: string; endMarket: string | null; productCategory: string | null;
  website: string | null; city: string | null; state: string | null; contactName: string | null; contactEmail: string | null; contactName2: string | null; contactEmail2: string | null; contactPhone: string | null;
  lastInteraction: string | null; priority: number | null; stage: string | null; pipelineStage: string;
  ownerName: string | null; volume: string | null; numbers: string | null; commentary: string | null; companyId: string | null; agentHold: boolean;
  followUpAt: string | null; followUpNote: string | null; followUpDoneAt: string | null;
  outreachStatus: string | null; outreachNextAt: string | null; outreachTo: string | null; outreachEmailed: string | null; outreachLog: string | null;
  agentStatus: string | null;
  // Derived server-side in GET /api/leads (src/lib/lead-view.ts) — never re-derived here.
  mode: LeadMode; stageLabel: string; leadType: LeadType; region: Region; origin: LeadOrigin; stalled: boolean;
  leadTypeOverride?: string | null;
  lastNote?: { body: string; authorName: string; createdAt: string } | null;
};

// Outbound-agent status → chip label + styling. null status = not yet emailed.
const OUTREACH: Record<string, { label: string; cls: string }> = {
  intro_sent:     { label: "Intro sent",     cls: "bg-blue-50 text-blue-700 border-blue-200" },
  followup_1:     { label: "Follow-up 1",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  followup_2:     { label: "Follow-up 2",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  replied:        { label: "Replied",        cls: "bg-green-50 text-green-700 border-green-200" },
  not_interested: { label: "Recheck (6mo)",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  bounced:        { label: "Bounced - needs email", cls: "bg-red-50 text-red-700 border-red-200" },
  needs_name:     { label: "Needs contact name", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  unsubscribed:   { label: "Do not contact", cls: "bg-gray-200 text-gray-600 border-gray-300" },
  done:           { label: "Sequence done",  cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

// Who is driving this lead right now (Benjy 8/2: "idk what is an agent lead").
// mode is computed server-side; this is purely how it looks.
const MODE_CHIP: Record<Exclude<LeadMode, "idle">, { label: string; cls: string; title: string }> = {
  ai:        { label: "🤖 AI (Jessica)", cls: "bg-blue-50 text-blue-700 border-blue-200", title: "The AI agent is actively working this lead — a clock is running." },
  needs_you: { label: "⏸ Needs you",     cls: "bg-amber-50 text-amber-700 border-amber-200", title: "The agent has stopped and is waiting on a human decision." },
  human:     { label: "👤",              cls: "bg-gray-100 text-gray-600 border-gray-200", title: "A person owns this lead; the agent is not driving it." },
};

const INBOUND_TYPES = new Set<LeadType>(["google_ad", "facebook", "website", "mailercity"]);
const TYPE_BADGE: Record<LeadType, string> = {
  google_ad:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  facebook:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  website:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  mailercity: "bg-emerald-50 text-emerald-700 border-emerald-200",
  referral:   "bg-violet-50 text-violet-700 border-violet-200",
  cold:       "bg-slate-100 text-slate-600 border-slate-200",
  tradeshow:  "bg-violet-50 text-violet-700 border-violet-200",
  linkedin:   "bg-violet-50 text-violet-700 border-violet-200",
  customer:   "bg-amber-50 text-amber-700 border-amber-200",
  manual:     "bg-slate-100 text-slate-600 border-slate-200",
};
// Green = they came to us (answer it). Slate = we sourced them (cold call it).
function TypeBadge({ t }: { t: LeadType }) {
  const inbound = INBOUND_TYPES.has(t);
  return (
    <span title={inbound ? "Inbound - this lead contacted us" : t === "referral" ? "Referral" : "We sourced this lead for outreach - cold"}
      className={`mt-0.5 inline-flex w-fit items-center rounded border px-1.5 py-0 text-[10px] ${TYPE_BADGE[t]}`}>
      {inbound ? "↓ " : t === "cold" ? "↑ " : ""}{TYPE_LABELS[t]}
    </span>
  );
}

// An empty Outreach cell should say WHY (Benjy 8/2): queued behind the daily
// send cap is very different from "we have no address for this person".
function OutreachIdle({ l }: { l: Lead }) {
  if (l.agentHold) return <span className="text-xs text-gray-400">Agent skipped</span>;
  if (!l.contactEmail) return <span className="text-xs text-amber-600">No email</span>;
  if (l.leadType === "cold" || l.leadType === "manual") return <span className="text-xs text-blue-600">Queued</span>;
  return <span className="text-gray-300">—</span>;
}

function ModeChip({ l }: { l: Lead }) {
  if (l.mode === "idle") return null;
  const c = MODE_CHIP[l.mode];
  const label = l.mode === "human" ? `👤 ${ownerFirstName(l)}` : c.label;
  return <span title={c.title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap ${c.cls}`}>{label}</span>;
}

const MODE_FILTERS: { key: LeadMode | "stalled" | "tocall"; label: string }[] = [
  { key: "ai", label: "🤖 AI working" },
  { key: "needs_you", label: "⏸ Needs you" },
  { key: "human", label: "👤 Person-owned" },
  { key: "stalled", label: "⚠ Stalled" },
  { key: "tocall", label: "☎ To call (cold, no sequence)" },
];
const TYPE_FILTERS: LeadType[] = ["google_ad", "facebook", "website", "mailercity", "cold", "referral", "tradeshow", "linkedin", "customer", "manual"];

// Multi-select filter chip — an obvious button, not a dropdown (Benjy couldn't
// find things behind menus).
function Chip({ on, label, count, onClick, tone = "gray" }: { on: boolean; label: string; count?: number; onClick: () => void; tone?: "gray" | "brand" }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        on ? (tone === "brand" ? "border-brand-500 bg-brand-500 text-white" : "border-gray-800 bg-gray-800 text-white")
           : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
      <span>{label}</span>
      {count !== undefined && <span className={on ? "opacity-80" : "text-gray-400"}>{count}</span>}
    </button>
  );
}

// Follow-up state: "due" = date is today or past, "upcoming" = future.
function dueState(l: Lead): "due" | "upcoming" | null {
  if (l.followUpDoneAt) return null; // completed follow-ups drop off the due list
  if (!l.followUpAt) return null;
  const d = new Date(l.followUpAt); const end = new Date(); end.setHours(23, 59, 59, 999);
  return d <= end ? "due" : "upcoming";
}
const fmtShort = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Owner filter key: first name, lowercased. ownerName is free text ("Benjy",
// "Shimmie Jacoby", "", "TBD"), so everything unassigned collapses to one bucket.
const ownerKey = (l: Lead) => {
  const first = (l.ownerName || "").trim().split(/\s+/)[0].toLowerCase();
  return !first || first === "tbd" ? "tbd" : first;
};
const ownerLabel = (k: string) => k === "tbd" ? "Unassigned" : k.charAt(0).toUpperCase() + k.slice(1);

const PRODUCTS = ["Folding Carton", "Commercial Print", "Flexible Packaging", "Packaging", "Mailers", "MailerCity"];
const OWNERS = ["Benjy", "Albert", "Nitay", "Shimmie", "Kelsey", "Suzanne", "Jessica", "TBD"];
const STAGE_LEAD = ["Break in", "Touch base", "Connected", "Requested info", "Quoting", "Meeting set", "Deprioritize", "Dead"];
const STAGE_QUAL = ["With C&D", "With customer", "Quoting", "N/A"];
// Inbound and Prospecting are both the LEAD stage, split by how the record
// ARRIVED (Benjy 8/7: "leave cold/organic entirely separate"). They're
// top-level rather than a filter inside Leads because a filter is still one
// shared pile you have to remember to narrow — which was the whole complaint.
// Once a lead is qualified it leaves both and origin becomes a badge.
const STAGES = [
  { key: "INBOUND", label: "Inbound", stage: "LEAD", origin: "inbound" as LeadOrigin },
  { key: "PROSPECTING", label: "Prospecting", stage: "LEAD", origin: "prospecting" as LeadOrigin },
  { key: "QUALIFIED", label: "Qualified prospects", stage: "QUALIFIED" },
  { key: "CUSTOMER", label: "Existing customers", stage: "CUSTOMER" },
  { key: "LOST", label: "Lost", stage: "LOST" },
] as const;
const tabOf = (k: string) => STAGES.find((t) => t.key === k) || STAGES[1];
// Module scope on purpose: the counts/waiting memos above the render use this,
// and a const arrow declared lower in the component is not yet initialized when
// they run.
const inTab = (l: Lead, key: string) => {
  const t = tabOf(key);
  return l.pipelineStage === t.stage && (!("origin" in t) || l.origin === (t as any).origin);
};

const selCls = "h-8 w-full rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none";
const priColor = (p: number | null) => p === 1 ? "text-red-600" : p === 2 ? "text-amber-600" : "text-gray-400";

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [active, setActive] = useState<string>("PROSPECTING");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dueOnly, setDueOnly] = useState(false);
  // Filter bar (Benjy 8/2). Empty set = "All" for that group; groups AND together.
  const [modeF, setModeF] = useState<Set<string>>(new Set());
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [regionF, setRegionF] = useState<Set<string>>(new Set());
  const [stateF, setStateF] = useState("");
  // Per-person filter (Benjy 8/5) — a rep should be able to see only his own
  // book. Keyed by lowercased first name, which is how ownerName is stored.
  const [ownerF, setOwnerF] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<string>("");
  // Per-field validation messages, keyed "<leadId>:<field>".
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const toggle = (set: Set<string>, upd: (s: Set<string>) => void) => (k: string) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k); else n.add(k);
    upd(n);
  };

  const load = () => {
    fetch("/api/leads")
      .then((r) => { if (r.status === 403 || r.status === 401) { setForbidden(true); return { leads: [] }; } return r.json(); })
      .then((d) => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setMe(((d?.user?.name || "").trim().split(/\s+/)[0] || "").toLowerCase()))
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { INBOUND: 0, PROSPECTING: 0, QUALIFIED: 0, CUSTOMER: 0, LOST: 0 };
    leads.forEach((l) => { STAGES.forEach((t) => { if (inTab(l, t.key)) c[t.key]++; }); });
    return c;
  }, [leads]);
  // Anything in the Inbound queue that a person hasn't answered yet. Drives the
  // amber treatment on the tab so a waiting inquiry is visible from any screen.
  const inboundWaiting = useMemo(
    () => leads.filter((l) => inTab(l, "INBOUND") && (l.mode === "needs_you" || l.mode === "idle")).length,
    [leads],
  );

  // Counts every stage the morning reminder email covers, so the badge and the
  // email can never disagree about what's due (Benjy 8/6).
  const REMINDER_STAGES = ["LEAD", "QUALIFIED", "CUSTOMER"];
  const dueCount = useMemo(() => leads.filter((l) => REMINDER_STAGES.includes(l.pipelineStage) && dueState(l) === "due").length, [leads]);

  // Outbound-agent campaign counters (LEAD stage only).
  const outreach = useMemo(() => {
    const L = leads.filter((l) => l.pipelineStage === "LEAD" && l.origin === "prospecting");
    const inSeq = ["intro_sent", "followup_1", "followup_2"];
    return {
      emailed: L.filter((l) => !!l.outreachStatus).length,
      inSeq: L.filter((l) => inSeq.includes(l.outreachStatus || "")).length,
      replied: L.filter((l) => l.outreachStatus === "replied").length,
      done: L.filter((l) => l.outreachStatus === "done").length,
      bounced: L.filter((l) => l.outreachStatus === "bounced").length,
      notContacted: L.filter((l) => !l.outreachStatus && !l.agentHold).length,
    };
  }, [leads]);

  const q = search.trim().toLowerCase();
  const IN_SEQUENCE = ["intro_sent", "followup_1", "followup_2"];
  // "To call" = we sourced them (cold/manual) AND no email sequence is running
  // AND the agent isn't mid-conversation. Cold leads DO get Jessica's emails —
  // this is the subset where the phone is the next move (Benjy 8/2).
  const isToCall = (l: Lead) =>
    (l.leadType === "cold" || l.leadType === "manual") &&
    !IN_SEQUENCE.includes(l.outreachStatus || "") &&
    l.mode !== "ai" && l.mode !== "needs_you";
  const matchesMode = (l: Lead) => modeF.size === 0 || [...modeF].some((k) =>
    k === "stalled" ? l.stalled : k === "tocall" ? isToCall(l) : l.mode === k);
  const inStage = useMemo(() => leads.filter((l) => inTab(l, active)), [leads, active]);
  // Downstream tabs keep an origin toggle so the two sides stay measurable all
  // the way to Customer / Lost — the blended hit rate describes neither.
  const [originF, setOriginF] = useState<LeadOrigin | "">("");
  const showOriginToggle = ["QUALIFIED", "CUSTOMER", "LOST"].includes(active);
  const originCounts = useMemo(() => {
    const c = { inbound: 0, prospecting: 0 };
    inStage.forEach((l) => { c[l.origin] = (c[l.origin] || 0) + 1; });
    return c;
  }, [inStage]);
  const visible = inStage
    .filter((l) => !dueOnly || dueState(l) === "due")
    .filter(matchesMode)
    .filter((l) => typeF.size === 0 || typeF.has(l.leadType))
    .filter((l) => regionF.size === 0 || regionF.has(l.region))
    .filter((l) => !stateF || (l.state || "").trim().toUpperCase() === stateF)
    .filter((l) => ownerF.size === 0 || ownerF.has(ownerKey(l)))
    .filter((l) => !showOriginToggle || !originF || l.origin === originF)
    .filter((l) => !q || `${l.companyName} ${l.contactName || ""} ${l.contactEmail || ""} ${l.endMarket || ""} ${l.ownerName || ""} ${l.city || ""} ${l.state || ""} ${l.commentary || ""}`.toLowerCase().includes(q));

  // Counts shown on the chips — scoped to the active pipeline stage so the
  // numbers match what you're looking at.
  const f = useMemo(() => {
    const mode: Record<string, number> = { ai: 0, needs_you: 0, human: 0, idle: 0, stalled: 0, tocall: 0 };
    const type: Record<string, number> = {};
    const region: Record<string, number> = {};
    const owner: Record<string, number> = {};
    const states = new Set<string>();
    inStage.forEach((l) => {
      owner[ownerKey(l)] = (owner[ownerKey(l)] || 0) + 1;
      mode[l.mode] = (mode[l.mode] || 0) + 1;
      if (l.stalled) mode.stalled++;
      if (isToCall(l)) mode.tocall++;
      type[l.leadType] = (type[l.leadType] || 0) + 1;
      region[l.region] = (region[l.region] || 0) + 1;
      const s = (l.state || "").trim().toUpperCase();
      if (s) states.add(s);
    });
    return { mode, type, region, owner, states: [...states].sort() };
  }, [inStage]);
  const anyFilter = modeF.size > 0 || typeF.size > 0 || regionF.size > 0 || ownerF.size > 0 || !!stateF;

  // Optimistic inline patch.
  // Saves must CONFIRM they landed (Benjy 7/20: he and Nitay both lost edits
  // during deploy churn because failures were silently swallowed). On failure:
  // one retry, then alert + reload so the screen never lies about saved state.
  const savePut = async (payload: Record<string, unknown>) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (res.ok) return true;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 800));
    }
    alert("That change did NOT save (server hiccup). The page will refresh - please re-enter it.");
    load();
    return false;
  };
  // The Source dropdown is bound to the SERVER-COMPUTED leadType, so setting
  // only the override left the cell showing the old value — it looked like the
  // click did nothing. Move both in one go (Benjy 8/2).
  const setLeadType = async (id: string, value: LeadType) => {
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, leadType: value, leadTypeOverride: value } : l)));
    await savePut({ id, leadTypeOverride: value });
  };
  const patch = async (id: string, field: string, value: any) => {
    setLeads((p) => p.map((l) => l.id === id ? { ...l, [field]: value } : l));
    await savePut({ id, [field]: value });
  };
  // Local-only edit (no save) — for controlled inputs that save on blur.
  const setLocal = (id: string, field: string, value: any) => setLeads((p) => p.map((l) => l.id === id ? { ...l, [field]: value } : l));

  // AUTOSAVE (Benjy 8/5 — Albert: "I put info in and it doesn't save").
  // Every text field used to commit on blur ONLY. If the input went away before
  // it lost focus — collapsing the row, hitting refresh, closing the tab,
  // clicking a sidebar link — no blur ever fired and the typing was gone with
  // no error, which is exactly what "it didn't save" looks like. Now typing
  // schedules a save ~1s after you stop, blur still flushes immediately, and
  // anything still pending is flushed on the way out.
  const pending = useRef<Record<string, { id: string; field: string; value: any; timer: any }>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const commit = async (id: string, field: string, value: any) => {
    setSaveState("saving");
    const ok = await savePut({ id, [field]: value });
    setSaveState(ok ? "saved" : "idle");
  };
  const edit = (id: string, field: string, value: any) => {
    setLocal(id, field, value);
    const k = `${id}:${field}`;
    if (pending.current[k]) clearTimeout(pending.current[k].timer);
    pending.current[k] = { id, field, value, timer: setTimeout(() => { delete pending.current[k]; commit(id, field, value); }, 1000) };
  };
  // Drop a queued autosave — used when a value fails validation, so the
  // debounce timer can't write the bad value a second after we rejected it.
  const cancelPending = (id: string, field: string) => {
    const k = `${id}:${field}`;
    if (pending.current[k]) { clearTimeout(pending.current[k].timer); delete pending.current[k]; }
  };
  const flush = (id: string, field: string, value: any) => {
    const k = `${id}:${field}`;
    if (pending.current[k]) { clearTimeout(pending.current[k].timer); delete pending.current[k]; }
    commit(id, field, value);
  };
  useEffect(() => {
    // Last line of defence: a real page exit (refresh, tab close, external
    // link) can't be awaited, so push anything still queued with sendBeacon —
    // it survives unload, unlike fetch.
    const bail = () => {
      const q = Object.values(pending.current);
      if (!q.length) return;
      for (const { id, field, value } of q) {
        try { navigator.sendBeacon("/api/leads?beacon=1", new Blob([JSON.stringify({ id, [field]: value })], { type: "application/json" })); } catch { /* best effort */ }
      }
      pending.current = {};
    };
    window.addEventListener("pagehide", bail);
    return () => { window.removeEventListener("pagehide", bail); bail(); };
  }, []);
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveState]);
  const move = async (id: string, pipelineStage: string) => {
    setLeads((p) => p.map((l) => l.id === id ? { ...l, pipelineStage } : l));
    await savePut({ id, pipelineStage });
  };
  // "I've got this" — stand the agent down so the lead drops off the daily
  // digest. The lead itself stays open; only the reminder stops.
  const markHandled = async (l: Lead) => {
    if (!confirm(`Stop the daily reminder for ${l.companyName}?

The lead stays open in the pipeline — you're just telling Godzilla a human has it.`)) return;
    setLeads((p) => p.map((x) => x.id === l.id ? { ...x, agentStatus: "closed", mode: "human" as LeadMode } : x));
    await savePut({ id: l.id, agentStatus: "closed" });
  };
  const convert = async (id: string) => {
    await savePut({ id, convert: true });
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

      {/* Stage cards. Inbound goes amber whenever an inquiry is sitting
          unanswered, so it's visible from whichever tab you're on. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STAGES.map((s) => {
          const waiting = s.key === "INBOUND" && inboundWaiting > 0 && active !== "INBOUND";
          return (
            <button key={s.key} onClick={() => setActive(s.key)}
              title={s.key === "INBOUND" ? "Inquiries that came to us — website form, ads, MailerCity. Answer these."
                   : s.key === "PROSPECTING" ? "Names we sourced ourselves. Call these." : undefined}
              className={`text-left rounded-xl p-3 transition-colors border-2 ${
                active === s.key ? "bg-white border-brand-500"
                : waiting ? "bg-amber-50 border-amber-300 hover:bg-amber-100"
                : "bg-gray-50 border-transparent hover:bg-gray-100"}`}>
              <div className={`text-xs ${waiting ? "text-amber-700 font-medium" : "text-gray-500"}`}>
                {s.label}{waiting ? ` · ${inboundWaiting} waiting` : ""}
              </div>
              <div className={`text-2xl font-bold ${waiting ? "text-amber-800" : "text-gray-900"}`}>{counts[s.key] || 0}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search company, market, owner, city, notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {/* Visible proof an edit landed — no more guessing (Benjy 8/5). */}
        {saveState === "saving" && <span className="text-xs text-gray-500">Saving…</span>}
        {saveState === "saved" && <span className="text-xs text-green-600">✓ Saved</span>}
      </div>

      {/* Filter bar (Benjy 8/2) — replaces the old Agent Desk page. Chips are
          multi-select inside a group and AND across groups. */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium text-gray-400">Who</span>
          <Chip on={modeF.size === 0} label="All" count={inStage.length} onClick={() => setModeF(new Set())} />
          {MODE_FILTERS.map((m) => <Chip key={m.key} on={modeF.has(m.key)} label={m.label} count={f.mode[m.key] || 0} onClick={() => toggle(modeF, setModeF)(m.key)} />)}
        </div>
        {showOriginToggle && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-gray-400">Came from</span>
            <Chip on={!originF} label="Both" count={inStage.length} onClick={() => setOriginF("")} />
            <Chip on={originF === "inbound"} label="↓ Inbound" count={originCounts.inbound} onClick={() => setOriginF(originF === "inbound" ? "" : "inbound")} />
            <Chip on={originF === "prospecting"} label="↑ Prospecting" count={originCounts.prospecting} onClick={() => setOriginF(originF === "prospecting" ? "" : "prospecting")} />
            <span className="text-[11px] text-gray-400">The two convert very differently — a blended number describes neither.</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium text-gray-400">Owner</span>
          <Chip on={ownerF.size === 0} label="Everyone" count={inStage.length} onClick={() => setOwnerF(new Set())} />
          {me && f.owner[me] !== undefined && (
            <Chip on={ownerF.size === 1 && ownerF.has(me)} label="⭐ Just mine" count={f.owner[me]}
              onClick={() => setOwnerF(ownerF.size === 1 && ownerF.has(me) ? new Set() : new Set([me]))} tone="brand" />
          )}
          {Object.keys(f.owner).sort((a, b) => (f.owner[b] - f.owner[a]) || a.localeCompare(b)).map((k) => (
            <Chip key={k} on={ownerF.has(k)} label={ownerLabel(k)} count={f.owner[k]} onClick={() => toggle(ownerF, setOwnerF)(k)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium text-gray-400">Source</span>
          {TYPE_FILTERS.map((t) => <Chip key={t} on={typeF.has(t)} label={TYPE_LABELS[t]} count={f.type[t] || 0} onClick={() => toggle(typeF, setTypeF)(t)} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium text-gray-400">Where</span>
          {REGIONS.map((r) => <Chip key={r} on={regionF.has(r)} label={r} count={f.region[r] || 0} onClick={() => toggle(regionF, setRegionF)(r)} tone="brand" />)}
          <select className={`${selCls} h-7 w-auto`} value={stateF} onChange={(e) => setStateF(e.target.value)} title="Filter by state">
            <option value="">All states</option>
            {f.states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {anyFilter && (
            <button type="button" onClick={() => { setModeF(new Set()); setTypeF(new Set()); setRegionF(new Set()); setOwnerF(new Set()); setStateF(""); }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-800 hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {active === "PROSPECTING" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-400">Outbound agent:</span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-700"><b className="text-gray-900">{outreach.emailed}</b> emailed</span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700"><b>{outreach.inSeq}</b> in sequence</span>
          <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-green-700"><b>{outreach.replied}</b> replied</span>
          {outreach.bounced > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700"><b>{outreach.bounced}</b> bounced</span>}
          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-gray-500"><b>{outreach.done}</b> done</span>
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-500"><b>{outreach.notContacted}</b> not yet contacted</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium" title="Who's driving it, and where it actually stands — in plain English">Status</th>
                <th className="px-3 py-2 font-medium">Product</th>
                {active !== "LOST" && active !== "CUSTOMER" && <th className="px-3 py-2 font-medium" title="Your own manual sub-status — the Status column is the derived one">Sub-status</th>}
                {(active === "QUALIFIED" || active === "CUSTOMER" || active === "LOST") && <th className="px-3 py-2 font-medium">Volume</th>}
                <th className="px-3 py-2 font-medium">Owner</th>
                {active !== "CUSTOMER" && active !== "LOST" && <th className="px-3 py-2 font-medium w-14">Pri</th>}
                {active === "PROSPECTING" && <th className="px-3 py-2 font-medium" title="Where the outbound agent is in its email sequence for this lead">Outreach</th>}
                {active === "PROSPECTING" && <th className="px-3 py-2 font-medium text-center w-24" title="Check to stop the outbound agent from emailing this lead">Agent Skips</th>}
                {(active === "CUSTOMER" || active === "LOST") && <th className="px-3 py-2 font-medium whitespace-nowrap" title="Set a follow-up date and Godzilla emails the owner every morning until it's marked done">Follow-up</th>}
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
                          return <span className={`flex items-center gap-2 text-xs ${d === "due" ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                            <span>{d === "due" ? "● Follow up due" : `Follow-up ${fmtShort(l.followUpAt)}`}</span>
                            {d === "due" && <button onClick={(e) => { e.stopPropagation(); patch(l.id, "followUpDoneAt", new Date().toISOString()); }} className="text-green-600 hover:underline" title="Mark this follow-up done">✓ done</button>}
                          </span>; })()}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <div className="flex flex-col items-start gap-1">
                      <ModeChip l={l} />
                      {/* Plain-English stage. Raw internal statuses live only in the tooltip. */}
                      <span className="text-xs text-gray-700" title={`raw: agentStatus=${l.agentStatus || "—"} · outreachStatus=${l.outreachStatus || "—"} · stage=${l.stage || "—"}`}>{l.stageLabel}</span>
                      {/* Same escape hatch as the daily email: clear it from the
                          to-do list without having to move the lead (Benjy 8/6). */}
                      {l.mode === "needs_you" && (
                        <button type="button" onClick={() => markHandled(l)} title="Take it off the daily reminder email. The lead stays open — only the nag stops."
                          className="w-fit text-[11px] text-green-700 hover:underline">✓ I&apos;ve got this</button>
                      )}
                    <select
                      value={l.leadType}
                      onChange={(e) => setLeadType(l.id, e.target.value as LeadType)}
                      title="Where this lead came from — set it yourself; auto-detected until you do"
                      className={`mt-0.5 w-fit cursor-pointer rounded border px-1 py-0 text-[10px] ${TYPE_BADGE[l.leadType]}`}
                    >
                      {(Object.keys(TYPE_LABELS) as LeadType[]).map((k) => (
                        <option key={k} value={k}>{INBOUND_TYPES.has(k) ? "↓ " : k === "cold" ? "↑ " : ""}{TYPE_LABELS[k]}</option>
                      ))}
                    </select>
                      {l.stalled && <span className="text-[11px] text-red-500" title="No next action scheduled and untouched for 3+ days">⚠ Stalled</span>}
                    </div>
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
                      <Input className="h-8 text-xs" value={l.volume || ""} placeholder="—" onChange={(e) => edit(l.id, "volume", e.target.value)} onBlur={(e) => flush(l.id, "volume", e.target.value)} />
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
                  {active === "PROSPECTING" && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.outreachStatus && OUTREACH[l.outreachStatus]
                        ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${OUTREACH[l.outreachStatus].cls}`}>{OUTREACH[l.outreachStatus].label}{l.outreachNextAt && ["intro_sent", "followup_1", "followup_2"].includes(l.outreachStatus) ? <span className="ml-1 opacity-70">· next {fmtShort(l.outreachNextAt)}</span> : null}</span>
                        : <OutreachIdle l={l} />}
                    </td>
                  )}
                  {active === "PROSPECTING" && (
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" title="Don't email (agent) — check to keep the outbound agent away from this lead" checked={!!l.agentHold} onChange={(e) => { const v = e.target.checked; setLeads((p) => p.map((x) => x.id === l.id ? { ...x, agentHold: v } : x)); patch(l.id, "agentHold", v); }} />
                    </td>
                  )}
                  {/* Follow-up scheduling, right in the row. Customers get
                      chased for reorders and reprints as much as leads do, and
                      burying the date picker in the expanded panel made it look
                      like the feature didn't exist here (Benjy 8/6). */}
                  {(active === "CUSTOMER" || active === "LOST") && (
                    <td className="px-3 py-2 whitespace-nowrap align-top">
                      {l.followUpDoneAt ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-green-700">Done {fmtShort(l.followUpDoneAt)}</span>
                          <button onClick={() => patch(l.id, "followUpDoneAt", null)} className="text-[11px] text-brand-600 hover:underline">new date</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input type="date" className="h-8 w-[8.5rem] text-xs"
                            value={l.followUpAt ? l.followUpAt.slice(0, 10) : ""}
                            onChange={(e) => patch(l.id, "followUpAt", e.target.value || null)}
                            title="Emails the owner every morning until marked done" />
                          {l.followUpAt && (
                            <button onClick={() => patch(l.id, "followUpDoneAt", new Date().toISOString())}
                              title="Mark this follow-up done" className="text-[11px] font-medium text-green-700 hover:underline">✓</button>
                          )}
                        </div>
                      )}
                      {l.followUpAt && !l.followUpDoneAt && dueState(l) === "due" && (
                        <span className="block text-[11px] text-amber-600">● due</span>
                      )}
                      <span className="block text-[11px] text-gray-400">
                        last touch {l.lastInteraction ? fmtShort(l.lastInteraction) : "—"}
                      </span>
                    </td>
                  )}
                  {(active === "CUSTOMER" || active === "LOST") && (
                    <td className="px-3 py-2 min-w-[200px] align-top">
                      {/* Notes are an append-only timeline now, so this is a
                          preview of the LATEST note (open the row to add one)
                          rather than the stale legacy blob. */}
                      {l.lastNote ? (
                        <>
                          <p className="line-clamp-2 text-xs text-gray-600" title={l.lastNote.body}>{l.lastNote.body}</p>
                          <span className="text-[11px] text-gray-400">{l.lastNote.authorName} · {fmtShort(l.lastNote.createdAt)}</span>
                        </>
                      ) : (
                        <p className="truncate text-xs text-gray-500" title={l.commentary || ""}>{l.commentary || "—"}</p>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {active === "PROSPECTING" && <button onClick={() => move(l.id, "QUALIFIED")} className="text-xs text-brand-600 hover:underline mr-3">Qualify →</button>}
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
                    <td colSpan={11} className="px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                        {([["website", "Website"], ["city", "City"], ["contactName", "Contact name"], ["contactTitle", "Contact title"], ["contactEmail", "Contact email"], ["contactName2", "Contact name 2 (agent tries after primary)"], ["contactEmail2", "Contact email 2"], ["contactPhone", "Primary phone"], ["endMarket", "End market"]] as const).map(([f, label]) => {
                          // A phone number in the email field means the agent
                          // silently never emails this lead. Catch it here
                          // rather than discovering it weeks later (Shimmie 8/6).
                          const checked = (VALIDATED_FIELDS as readonly string[]).includes(f);
                          const problem = checked ? fieldErr[`${l.id}:${f}`] : undefined;
                          return (
                          <div key={f}>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                            <Input
                              className={`h-8 text-xs ${problem ? "border-red-400 focus:border-red-500" : ""}`}
                              value={(l as any)[f] || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (checked) setFieldErr((p) => ({ ...p, [`${l.id}:${f}`]: validateField(f as FieldName, v) || "" }));
                                edit(l.id, f, v);
                              }}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (!checked) { flush(l.id, f, v); return; }
                                const msg = validateField(f as FieldName, v);
                                setFieldErr((p) => ({ ...p, [`${l.id}:${f}`]: msg || "" }));
                                // Never persist a value we just told them is wrong.
                                if (msg) { cancelPending(l.id, f); return; }
                                const clean = normalizeField(f as FieldName, v);
                                if (clean !== v) setLocal(l.id, f, clean);
                                flush(l.id, f, clean);
                              }}
                            />
                            {problem && <p className="mt-1 text-[11px] text-red-600">{problem}</p>}
                          </div>
                          );
                        })}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">State <span className="font-normal text-gray-400">— sets the region + the agent's geography angle</span></label>
                          <select className={selCls} value={(l.state || "").trim().toUpperCase()} onChange={(e) => patch(l.id, "state", e.target.value)}>
                            <option value="">—</option>
                            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <p className="mt-1 text-[11px] text-gray-400">Region: {l.region}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <label className="block text-xs font-medium text-gray-500">Follow-up</label>
                            {l.followUpDoneAt
                              ? <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] text-green-700">Done {fmtShort(l.followUpDoneAt)}</span>
                              : l.followUpAt
                                ? (dueState(l) === "due"
                                    ? <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Outstanding</span>
                                    : <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">Scheduled</span>)
                                : null}
                          </div>
                          {l.followUpDoneAt ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Completed. </span>
                              <button onClick={() => patch(l.id, "followUpDoneAt", null)} className="text-xs text-brand-600 hover:underline">Reopen / set new date</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input type="date" className="h-8 text-xs" value={l.followUpAt ? l.followUpAt.slice(0, 10) : ""} onChange={(e) => patch(l.id, "followUpAt", e.target.value || null)} title="Set or reschedule the follow-up date" />
                              {l.followUpAt && <button onClick={() => patch(l.id, "followUpDoneAt", new Date().toISOString())} className="whitespace-nowrap rounded-md border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">✓ Done</button>}
                            </div>
                          )}
                          <p className="mt-1 text-[11px] text-gray-400">{l.followUpDoneAt ? "The lead stays open; only the follow-up is cleared." : "Emails the owner every morning until marked done. Change the date to reschedule."}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Reminder note</label>
                          <Input className="h-8 text-xs" value={l.followUpNote || ""} placeholder="e.g. Call Reid about the carton specs" onChange={(e) => edit(l.id, "followUpNote", e.target.value)} onBlur={(e) => flush(l.id, "followUpNote", e.target.value)} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Numbers <span className="text-gray-400 font-normal">— dump every number you collect here</span></label>
                          <textarea rows={2} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" value={l.numbers || ""} placeholder="e.g. 305-555-0100 (cell) · 727-555-0199 (office) · 954-555-0123 (Reid)" onChange={(e) => edit(l.id, "numbers", e.target.value)} onBlur={(e) => flush(l.id, "numbers", e.target.value)} />
                        </div>
                        {(l.outreachStatus || l.outreachLog) && (
                          <div className="sm:col-span-3 rounded-md border border-gray-200 bg-white p-3">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-500">Outbound agent</span>
                              {l.outreachStatus && OUTREACH[l.outreachStatus] && <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${OUTREACH[l.outreachStatus].cls}`}>{OUTREACH[l.outreachStatus].label}</span>}
                              {l.outreachNextAt && ["intro_sent", "followup_1"].includes(l.outreachStatus || "") && <span className="text-xs text-gray-400">next action {fmtShort(l.outreachNextAt)}</span>}
                              {l.outreachTo && ["intro_sent", "followup_1"].includes(l.outreachStatus || "") && <span className="text-xs text-gray-400">· emailing {l.outreachTo}</span>}
                              {(() => { let n = 0; try { n = (JSON.parse(l.outreachEmailed || "[]") as any[]).length; } catch { /* ignore */ } return n > 1 ? <span className="text-xs text-gray-400">· {n} contacts emailed</span> : null; })()}
                            </div>
                            <ol className="space-y-1 text-xs text-gray-600">
                              {(() => { let a: any[] = []; try { a = l.outreachLog ? JSON.parse(l.outreachLog) : []; } catch { /* ignore */ } return a.slice().reverse().map((e: any, i: number) => (<li key={i} className="flex gap-2"><span className="text-gray-400 tabular-nums w-12 shrink-0">{fmtShort(e.at)}</span><span>{e.event}</span></li>)); })()}
                              {!l.outreachLog && <li className="text-gray-400">No agent activity yet.</li>}
                            </ol>
                          </div>
                        )}
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Notes <span className="font-normal text-gray-400">— each note is saved with your name and time; type @ to tag someone</span></label>
                          {/* Do NOT refetch the list here. Saving a note stamps
                              lastInteraction, and leads are ordered by it — a
                              reload re-sorted the row out from under whoever
                              just typed, so they lost their place and had to
                              find the lead again (Benjy 8/6). Patch the one row
                              locally instead; the new order shows up on the
                              next natural refresh. */}
                          <NotesTimeline
                            leadId={l.id}
                            onPosted={() => setLeads((p) => p.map((x) => x.id === l.id
                              ? { ...x, lastInteraction: new Date().toISOString(), stalled: false }
                              : x))}
                          />
                        </div>
                        {/* Artwork / dielines / specs collected during the chase.
                            These follow the account downstream — see AttachmentPanel. */}
                        <div className="sm:col-span-3">
                          <AttachmentPanel scope={{ leadId: l.id, companyId: l.companyId || undefined }} title="Files (artwork, dielines, specs)" />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {visible.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">{q ? "No matches." : "Nothing in this stage yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ companyName: "", endMarket: "", productCategory: "Folding Carton", website: "", city: "", state: "", contactName: "", contactEmail: "", ownerName: "Benjy", priority: "1", stage: "Break in" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  // Geography is mandatory on new leads (Benjy 8/2) — the server enforces it too.
  const geoMissing = !form.city.trim() || !form.state;
  const canSave = !!form.companyName.trim() && !geoMissing;

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Could not save that lead.");
        setSaving(false);
        return;
      }
    } catch {
      setErr("Could not reach the server — the lead was not saved.");
      setSaving(false);
      return;
    }
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <Input value={form.city} onChange={(e) => upd("city", e.target.value)} placeholder="e.g. Tampa" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <select className={selCls + " h-9"} value={form.state} onChange={(e) => upd("state", e.target.value)}>
                  <option value="">Select…</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {geoMissing && <p className="text-xs text-amber-700">City and state are required — the pipeline is filtered and routed by geography.</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Website</label><Input value={form.website} onChange={(e) => upd("website", e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact</label><Input value={form.contactName} onChange={(e) => upd("contactName", e.target.value)} /></div>
            </div>
            {err && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{err}</p>}
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save} disabled={saving || !canSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add lead"}</Button></div>
          </div>
        </div>
      </div>
    </>
  );
}
