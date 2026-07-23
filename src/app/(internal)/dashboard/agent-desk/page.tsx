"use client";

// Agent Desk (Benjy 7/23) — single board showing where the AI agent stands on
// EVERY lead it's touched, grouped by who the ball is with. Built after held
// states (needs_review, replied) sat unnoticed for days/weeks: email digests
// only surface what they're coded to look for; this page shows everything.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Lock, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

type Lead = {
  id: string; companyName: string; contactName: string | null; productCategory: string | null;
  pipelineStage: string; ownerName: string | null; agentStatus: string | null;
  agentNextAt: string | null; updatedAt: string; source: string;
  outreachStatus: string | null; outreachNextAt: string | null;
};

const CLOSED = new Set(["closed", "declined", "disqualified", "duplicate", "unsubscribed", "done", "owner_handling"]);
const OWNER_BALL = new Set(["quote_received", "replied", "needs_owner", "needs_review", "needs_info", "mailercity_handoff", "blocked"]);
const MARY_BALL = new Set(["awaiting_mary"]);
const CUSTOMER_BALL = new Set(["awaiting_customer_info", "info_nudge_1", "awaiting_customer_file", "mailercity_qualifying", "sent", "followup_1", "followup_2", "followup_3"]);
const OUTREACH_OWNER = new Set(["needs_name", "bounced", "replied"]);

const daysSince = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

// How long each bucket may sit before it flags red.
const SLA_DAYS: Record<string, number> = { owners: 1, mary: 3, customer: 10, scheduled: 5 };

export default function AgentDeskPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => { if (r.status === 401 || r.status === 403) { setForbidden(true); return { leads: [] }; } return r.json(); })
      .then((d) => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const g = { owners: [] as Lead[], mary: [] as Lead[], customer: [] as Lead[], scheduled: [] as Lead[], outreach: [] as Lead[], closed: [] as Lead[] };
    for (const l of leads) {
      if (l.agentStatus) {
        if (CLOSED.has(l.agentStatus)) { g.closed.push(l); continue; }
        if (OWNER_BALL.has(l.agentStatus)) { g.owners.push(l); continue; }
        if (MARY_BALL.has(l.agentStatus)) { g.mary.push(l); continue; }
        if (CUSTOMER_BALL.has(l.agentStatus)) { g.customer.push(l); continue; }
        g.scheduled.push(l); continue;
      }
      if (l.outreachStatus && OUTREACH_OWNER.has(l.outreachStatus)) g.outreach.push(l);
    }
    // Oldest-stuck first inside each group.
    for (const k of ["owners", "mary", "customer", "scheduled", "outreach"] as const) {
      g[k].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    }
    return g;
  }, [leads]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (forbidden) return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <Lock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
      <h1 className="text-lg font-semibold text-gray-900">Restricted</h1>
      <p className="text-sm text-gray-500 mt-1">The agent desk is limited to authorized users.</p>
    </div>
  );

  const section = (title: string, sub: string, rows: Lead[], slaKey: string, statusOf: (l: Lead) => string) => (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div>
          <span className="font-semibold text-gray-900">{title}</span>
          <span className="ml-2 text-xs text-gray-500">{sub}</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">Nothing here — all clear.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((l) => {
              const days = daysSince(l.updatedAt);
              const late = days > (SLA_DAYS[slaKey] ?? 5);
              return (
                <tr key={l.id} className={`border-b border-gray-100 last:border-0 ${late ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {l.companyName}
                    {l.contactName && <span className="ml-1 font-normal text-gray-500">({l.contactName})</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-600">{statusOf(l)}</td>
                  <td className="px-2 py-2 text-gray-500">{l.productCategory || "—"}</td>
                  <td className="px-2 py-2 text-gray-500">owner {l.ownerName || "—"}</td>
                  <td className="px-2 py-2 text-gray-500">next: {fmt(l.agentStatus ? l.agentNextAt : l.outreachNextAt)}</td>
                  <td className={`px-4 py-2 text-right font-mono text-xs ${late ? "font-bold text-red-600" : "text-gray-500"}`}>
                    {late && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}{days}d in state
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agent Desk</h1>
            <p className="text-sm text-gray-500">Where Jessica stands on every lead — grouped by who the ball is with. Red = sitting too long.</p>
          </div>
        </div>
        <Link href="/dashboard/pipeline" className="text-sm text-brand-600 hover:underline">Open the pipeline →</Link>
      </div>

      {section("Waiting on YOU", "approvals, replies to review, handoffs", groups.owners, "owners", (l) => l.agentStatus || "")}
      {section("Outreach needs a human", "bounced / needs contact name / hot replies", groups.outreach, "owners", (l) => l.outreachStatus || "")}
      {section("Waiting on Mary", "quotes in her court (agent nudges automatically)", groups.mary, "mary", (l) => l.agentStatus || "")}
      {section("Waiting on the customer", "specs, files, quote responses (agent follows up)", groups.customer, "customer", (l) => l.agentStatus || "")}
      {section("Scheduled / working", "agent has a clock running", groups.scheduled, "scheduled", (l) => l.agentStatus || "")}

      <p className="text-xs text-gray-400">{groups.closed.length} closed agent leads not shown. Every lead above also gets swept by the daily stuck-check email if it stalls with no clock.</p>
    </div>
  );
}
