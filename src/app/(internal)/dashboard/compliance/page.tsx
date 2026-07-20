"use client";

// Compliance Library — SQF Edition 9 documentation viewer (ported from Lee
// Zerfass's standalone SQF library, July 2026). Static data lives in
// src/lib/compliance-data.ts; checklist state persists via /api/compliance.

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Search, ChevronDown, ChevronUp, FileSpreadsheet,
  Folder, CheckCircle2, AlertTriangle, Check,
} from "lucide-react";
import {
  overview, cdPolicies, polPriv, polPrivMeta, frmTemplates, sopLibrary,
  module13SOPs, versionControl, checklist, openItemsBeforeAudit,
  executionTimeline, CD_CAT_LABELS, GAP_LABELS, DOC_STATUS_LABELS,
  findCdPolicy, checklistItemKey,
  type CdPolicy, type GapStatus, type DocStatus, type CdLink,
} from "@/lib/compliance-data";

const TABS = [
  "Overview",
  "SQF SOP Library",
  "Module 13",
  "C&D IT Policies",
  "Privacy Library",
  "Record Templates",
  "Version Control",
  "Checklist",
] as const;

const TYPE_BADGE: Record<string, string> = {
  Policy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SOP: "bg-blue-100 text-blue-800 border-blue-200",
  Document: "bg-purple-100 text-purple-800 border-purple-200",
  "Work Instruction": "bg-amber-100 text-amber-800 border-amber-200",
};

const CAT_BADGE: Record<CdPolicy["cat"], string> = {
  IT_GOV: "bg-blue-100 text-blue-800 border-blue-200",
  RISK: "bg-amber-100 text-amber-800 border-amber-200",
  DATA: "bg-purple-100 text-purple-800 border-purple-200",
  OPS: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function GapBadge({ status }: { status: GapStatus }) {
  const variant = status === "new" ? "destructive" : status === "partial" ? "warning" : "success";
  return <Badge variant={variant}>{GAP_LABELS[status]}</Badge>;
}

function DocStatusBadge({ status }: { status: DocStatus }) {
  const variant = status === "ready" ? "success" : status === "pending" ? "warning" : "destructive";
  return <Badge variant={variant}>{DOC_STATUS_LABELS[status]}</Badge>;
}

function MandatoryBadge({ short }: { short?: boolean }) {
  return (
    <span className="inline-flex items-center rounded border border-red-600 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
      {short ? "M" : "MANDATORY"}
    </span>
  );
}

function GeneratedNote({ note }: { note: string }) {
  const generated = note.startsWith("✅");
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${generated ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      {note}
    </div>
  );
}

function CDLinkPills({ links, onJump }: { links: CdLink[]; onJump: (id: string) => void }) {
  if (!links?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map((l) => {
        const cd = findCdPolicy(l.id);
        return (
          <button
            key={l.id}
            type="button"
            title={l.note}
            onClick={(e) => { e.stopPropagation(); onJump(l.id); }}
            className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700 hover:bg-blue-100 transition-colors"
          >
            ↗ {l.id}{cd ? ` — ${cd.title}` : ""}
          </button>
        );
      })}
    </div>
  );
}

function matches(search: string, ...fields: (string | undefined)[]) {
  if (!search) return true;
  const q = search.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export default function CompliancePage() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Overview");
  const [search, setSearch] = React.useState("");
  const [expandedSOP, setExpandedSOP] = React.useState<string | null>(null);
  const [expandedM13, setExpandedM13] = React.useState<string | null>(null);
  const [expandedCD, setExpandedCD] = React.useState<string | null>(null);
  const [expandedPriv, setExpandedPriv] = React.useState<string | null>(null);
  const [expandedFRM, setExpandedFRM] = React.useState<string | null>(null);
  const [cdFilter, setCdFilter] = React.useState<"ALL" | CdPolicy["cat"]>("ALL");
  const [mandatoryFilter, setMandatoryFilter] = React.useState<"all" | "mandatory" | "other">("all");

  // Checklist state — persisted to the database via /api/compliance.
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [checklistLoaded, setChecklistLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/compliance")
      .then((r) => (r.ok ? r.json() : { checks: [] }))
      .then((d) => {
        const map: Record<string, boolean> = {};
        for (const c of d.checks || []) map[c.key] = true;
        setChecked(map);
        setChecklistLoaded(true);
      })
      .catch(() => setChecklistLoaded(true));
  }, []);

  const toggleCheck = (key: string) => {
    const next = !checked[key];
    setChecked((prev) => ({ ...prev, [key]: next }));
    fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, checked: next }),
    }).catch(() => {
      // Revert on network failure so the UI reflects persisted state.
      setChecked((prev) => ({ ...prev, [key]: !next }));
    });
  };

  const jumpToCD = (id: string) => {
    setTab("C&D IT Policies");
    setSearch(id);
    setCdFilter("ALL");
    setExpandedCD(id);
  };

  const totalItems = checklist.reduce((a, c) => a + c.items.length, 0);
  const checkedCount = checklist.reduce(
    (a, c) => a + c.items.filter((i) => checked[checklistItemKey(c.category, i.ref)]).length,
    0
  );
  const progress = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;

  const filteredSOPs = sopLibrary.filter((s) => matches(search, s.id, s.title, s.description, s.section));
  const filteredM13 = module13SOPs.filter((s) => matches(search, s.id, s.title, s.topics, s.section));
  const filteredCD = cdPolicies.filter(
    (p) => (cdFilter === "ALL" || p.cat === cdFilter) && matches(search, p.id, p.title)
  );
  const filteredPriv = polPriv.filter((p) => matches(search, p.id, p.title, p.covers));
  const filteredFRM = frmTemplates.filter(
    (wb) => matches(search, wb.id, wb.title, wb.file) || wb.sheets.some((sh) => matches(search, sh.name, sh.desc))
  );

  const searchable = tab !== "Overview" && tab !== "Version Control" && tab !== "Checklist";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldCheck className="h-7 w-7 text-brand-600" />
            Compliance Library
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            SQF Food Safety Code — Edition 9 · McTempo Investments d/b/a C&D Printing and Packaging Co. · St. Petersburg, FL
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          <Badge variant="secondary">{sopLibrary.length} Core SOPs/Policies</Badge>
          <Badge variant="secondary">{module13SOPs.length} Module 13 SOPs</Badge>
          <Badge variant="secondary">{frmTemplates.length} FRM Workbooks</Badge>
          <Badge variant="secondary">{polPriv.length} POL-PRIV (Alight)</Badge>
          <Badge variant="secondary">{cdPolicies.length} C&D IT/Gov Policies</Badge>
          <Badge variant={progress >= 100 ? "success" : "warning"}>
            {checkedCount}/{totalItems} Checklist ({progress}%)
          </Badge>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      {searchable && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by ID, title, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === "Overview" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900">Complete Document Library Status</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">{overview.description}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { n: "39", label: "SOP/Policy documents generated (.docx)", accent: "border-t-blue-600 text-blue-700" },
              { n: "5", label: "FRM record workbooks generated (.xlsx)", accent: "border-t-emerald-600 text-emerald-700" },
              { n: "11", label: "POL-PRIV docs for Alight / VISO TRUST", accent: "border-t-purple-600 text-purple-700" },
              { n: `${progress}%`, label: "Compliance checklist complete", accent: "border-t-amber-600 text-amber-700" },
            ].map((s) => (
              <Card key={s.label} className={`border-t-4 ${s.accent.split(" ")[0]}`}>
                <CardContent className="pt-5">
                  <div className={`text-3xl font-bold ${s.accent.split(" ")[1]}`}>{s.n}</div>
                  <div className="mt-1 text-xs text-gray-500">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Open Items Before Audit (Ranked by Priority)
              </h3>
              <div className="mt-3 divide-y divide-gray-100">
                {openItemsBeforeAudit.map((item) => (
                  <div key={item.n} className="flex gap-3 py-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {item.n}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <h3 className="text-base font-semibold text-amber-900">Suggested Execution Timeline</h3>
              <div className="mt-3 divide-y divide-amber-100">
                {executionTimeline.map((t) => (
                  <div key={t.month} className="flex gap-4 py-2.5">
                    <div className="min-w-[110px] text-xs font-bold text-amber-800">{t.month}</div>
                    <div className="text-xs text-amber-900/80">{t.actions}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SQF SOP LIBRARY ── */}
      {tab === "SQF SOP Library" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            System Elements 2.1–2.9 + Org Chart + Role Designations · All {sopLibrary.length} documents generated as .docx v1.0 · Click a card to expand
          </p>
          {filteredSOPs.map((sop) => {
            const open = expandedSOP === sop.id;
            return (
              <Card key={sop.id}>
                <button
                  type="button"
                  onClick={() => setExpandedSOP(open ? null : sop.id)}
                  className="flex w-full flex-wrap items-center gap-2.5 px-5 py-4 text-left"
                >
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${TYPE_BADGE[sop.type] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {sop.type}
                  </span>
                  <span className="min-w-[90px] font-mono text-xs text-gray-500">{sop.id}</span>
                  <span className="min-w-[200px] flex-1 text-sm font-semibold text-gray-900">{sop.title}</span>
                  <span className="text-xs text-gray-400">§{sop.section}</span>
                  <GapBadge status={sop.gapStatus} />
                  {sop.mandatory && <MandatoryBadge />}
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                    <p className="text-sm leading-relaxed text-gray-600">{sop.description}</p>
                    <CDLinkPills links={sop.cdLinks} onJump={jumpToCD} />
                    <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                      <div>
                        <div className="mb-1.5 font-semibold text-gray-900">Key Content</div>
                        <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
                          {sop.keyContent.map((k, i) => <li key={i}>{k}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-1.5 font-semibold text-gray-900">Required Records</div>
                        <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
                          {sop.records.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-1.5 font-semibold text-gray-900">Review Frequency</div>
                        <Badge variant="success">{sop.reviewFrequency}</Badge>
                      </div>
                    </div>
                    <GeneratedNote note={sop.implementationNote} />
                  </div>
                )}
              </Card>
            );
          })}
          {filteredSOPs.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No SOPs match your search.</p>}
        </div>
      )}

      {/* ── MODULE 13 ── */}
      {tab === "Module 13" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Module 13 — GMP SOPs · All {module13SOPs.length} documents generated as .docx v1.0 · Click a card to expand</p>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredM13.map((sop) => {
              const open = expandedM13 === sop.id;
              return (
                <Card key={sop.id} className="cursor-pointer" onClick={() => setExpandedM13(open ? null : sop.id)}>
                  <CardContent className="pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-purple-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">{sop.id}</span>
                      <span className="text-xs text-gray-400">§{sop.section}</span>
                      <GapBadge status={sop.gapStatus} />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">{sop.title}</div>
                    <div className="mt-1.5 text-xs leading-relaxed text-gray-500">{sop.topics}</div>
                    {open && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <CDLinkPills links={sop.cdLinks} onJump={jumpToCD} />
                        <GeneratedNote note={sop.implementationNote} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredM13.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No Module 13 SOPs match your search.</p>}
        </div>
      )}

      {/* ── C&D IT POLICIES ── */}
      {tab === "C&D IT Policies" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {cdPolicies.length} existing policies at v2.0r2. Click a card to see which SQF documents cite it.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "IT_GOV", "RISK", "DATA", "OPS"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCdFilter(c)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  cdFilter === c
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {c === "ALL" ? "All" : CD_CAT_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCD.map((p) => {
              const usedBy = [...sopLibrary, ...module13SOPs].filter((s) => (s.cdLinks || []).some((l) => l.id === p.id));
              const open = expandedCD === p.id;
              return (
                <Card key={p.id} className="cursor-pointer" onClick={() => setExpandedCD(open ? null : p.id)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-gray-400">{p.id}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${CAT_BADGE[p.cat]}`}>{CD_CAT_LABELS[p.cat]}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-gray-900">{p.title}</div>
                    {usedBy.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Cited by {usedBy.length} SQF doc{usedBy.length > 1 ? "s" : ""}
                      </div>
                    )}
                    {open && usedBy.length > 0 && (
                      <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
                        {usedBy.map((s) => (
                          <div key={s.id} className="py-0.5">↳ {s.id} — {s.title}</div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredCD.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No policies match your search.</p>}
        </div>
      )}

      {/* ── PRIVACY LIBRARY ── */}
      {tab === "Privacy Library" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">POL-PRIV Series — Alight Solutions / VISO TRUST Remediation</h2>
            <p className="mt-1 text-sm text-gray-500">{polPrivMeta.subtitle}</p>
          </div>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4 text-sm">
              <span className="font-semibold text-amber-900">Two open items before submitting: </span>
              <span className="text-amber-900/80">{polPrivMeta.openItems}</span>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            {filteredPriv.map((p) => {
              const open = expandedPriv === p.id;
              return (
                <Card key={p.id} className="cursor-pointer" onClick={() => setExpandedPriv(open ? null : p.id)}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">{p.id}</span>
                      <Badge variant="secondary">v1.0 · 2026-06-23</Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">{p.title}</div>
                    {open && (
                      <div className="mt-2 border-t border-gray-100 pt-2 text-xs leading-relaxed text-gray-600">{p.covers}</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredPriv.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No privacy documents match your search.</p>}
        </div>
      )}

      {/* ── RECORD TEMPLATES ── */}
      {tab === "Record Templates" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{frmTemplates.length} Excel workbooks · All tabs pre-formatted · Zero formula errors · Click to see sheets</p>
          {filteredFRM.map((wb) => {
            const open = expandedFRM === wb.id;
            return (
              <Card key={wb.id}>
                <button
                  type="button"
                  onClick={() => setExpandedFRM(open ? null : wb.id)}
                  className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
                >
                  <FileSpreadsheet className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{wb.title}</div>
                    <div className="mt-0.5 truncate font-mono text-xs text-gray-400">{wb.file}</div>
                  </div>
                  <Badge variant="success">{wb.sheets.length} sheet{wb.sheets.length > 1 ? "s" : ""}</Badge>
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {open && (
                  <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/60">
                    {wb.sheets.map((sh) => {
                      const pending = sh.desc.includes("PENDING");
                      return (
                        <div key={sh.name} className="flex items-start gap-3 px-5 py-3">
                          {pending ? (
                            <Badge variant="warning">Pending</Badge>
                          ) : (
                            <Badge variant="success">Ready</Badge>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{sh.name}</div>
                            <div className="mt-0.5 text-xs text-gray-500">{sh.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {filteredFRM.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No workbooks match your search.</p>}
        </div>
      )}

      {/* ── VERSION CONTROL ── */}
      {tab === "Version Control" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-base font-semibold text-gray-900">Naming Convention</h3>
                <div className="mt-3 rounded-lg bg-blue-50 px-4 py-3 font-mono text-sm text-blue-800">
                  {versionControl.namingConvention}
                </div>
                <div className="mt-3 text-sm leading-relaxed text-gray-600">
                  <strong>Types:</strong> POL · SOP · M13 · WI · FRM · SQF
                  <br /><br />
                  v1.0 = initial · v1.1 = minor edit · v2.0 = major revision
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 text-sm font-semibold text-gray-900">Header Fields</div>
                  <div className="flex flex-wrap gap-1.5">
                    {versionControl.fields.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 text-sm font-semibold text-gray-900">Revision Triggers</div>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
                    {versionControl.revisionTriggers.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-base font-semibold text-gray-900">Approval Authority</h3>
                <div className="mt-2 divide-y divide-gray-100">
                  {Object.entries(versionControl.approvalLevels).map(([type, approver]) => (
                    <div key={type} className="flex items-center justify-between py-2.5 text-sm">
                      <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${TYPE_BADGE[type] || "bg-gray-100 text-gray-700 border-gray-200"}`}>{type}</span>
                      <span className="text-gray-600">{approver}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <strong>Retention:</strong> {versionControl.retentionRules}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-base font-semibold text-gray-900">Recommended Folder Structure</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {versionControl.folderStructure.map((f) => (
                  <div key={f.folder} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-blue-800">
                      <Folder className="h-3.5 w-3.5" />
                      {f.folder}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">{f.contents}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CHECKLIST ── */}
      {tab === "Checklist" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Compliance Checklist</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {checkedCount}/{totalItems} complete · Click any item to toggle · Saved for the whole team
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border-2 border-brand-600 bg-white px-4 py-1.5 text-sm">
                <span className="font-bold text-brand-700">{progress}%</span>
                <span className="ml-1.5 text-gray-500">Complete</span>
              </div>
              {(["all", "mandatory", "other"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMandatoryFilter(f)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    mandatoryFilter === f
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f === "all" ? "All" : f === "mandatory" ? "Mandatory Only" : "Non-Mandatory"}
                </button>
              ))}
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Badge variant="success">Ready</Badge> doc generated, action complete</span>
            <span className="flex items-center gap-1.5"><Badge variant="warning">Doc Drafted — Evidence Pending</Badge> real-world execution still needed</span>
            <span className="flex items-center gap-1.5"><Badge variant="destructive">Action Needed</Badge> not a document gap</span>
          </div>

          {!checklistLoaded && <p className="text-sm text-gray-400">Loading saved checklist state…</p>}

          {checklist.map((category) => {
            const items =
              mandatoryFilter === "all" ? category.items
              : mandatoryFilter === "mandatory" ? category.items.filter((i) => i.mandatory)
              : category.items.filter((i) => !i.mandatory);
            if (!items.length) return null;
            const catChecked = items.filter((i) => checked[checklistItemKey(category.category, i.ref)]).length;
            return (
              <Card key={category.category} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
                  <span className="text-sm font-semibold text-gray-900">{category.category}</span>
                  <span className="text-xs text-gray-500">{catChecked}/{items.length} complete</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const key = checklistItemKey(category.category, item.ref);
                    const isChecked = !!checked[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCheck(key)}
                        className={`flex w-full items-start gap-3.5 px-5 py-3 text-left transition-colors ${isChecked ? "bg-emerald-50/60" : "bg-white hover:bg-gray-50"}`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                            isChecked ? "border-emerald-600 bg-emerald-600" : "border-gray-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5 text-white" />}
                        </span>
                        <span className="min-w-[200px] flex-1">
                          <span className={`block text-sm ${isChecked ? "text-gray-400 line-through" : "text-gray-800"}`}>{item.text}</span>
                          <span className="mt-0.5 block text-xs italic text-gray-400">{item.note}</span>
                        </span>
                        <span className="flex max-w-[260px] shrink-0 flex-wrap items-center justify-end gap-1.5">
                          <span className="font-mono text-[11px] text-gray-400">§{item.ref}</span>
                          {item.mandatory && <MandatoryBadge short />}
                          <DocStatusBadge status={item.docStatus} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
