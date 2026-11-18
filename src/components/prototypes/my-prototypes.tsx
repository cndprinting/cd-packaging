"use client";

// "Where's my prototype?" (Benjy 11/18). The rep's own prototype requests with
// where each one is, its place in Todd's line, and when it'll be ready.
// Shown on the Sales Pipeline and on the Prototypes page.
import { useEffect, useState } from "react";
import { Box } from "lucide-react";

export type ProtoLite = {
  id: string; number: string; status: string; round: number; leadId: string | null; customerName: string; request: string;
  neededBy: string | null; promisedAt: string | null; readyAt: string | null; sentAt: string | null; approvedAt: string | null;
  queuePos: number | null; queueLen: number; requestedByName: string;
};

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "making", label: "Todd making it" },
  { key: "ready", label: "Ready" },
  { key: "with_customer", label: "With customer" },
  { key: "approved", label: "Approved" },
];
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "");

/** One line in plain words: where it is and when it'll be done. */
export function protoWhere(p: ProtoLite): string {
  const ahead = p.queuePos ? p.queuePos - 1 : 0;
  if (p.status === "requested") return `${p.round > 1 ? `Round ${p.round}: w` : "W"}aiting in Todd's line${p.queuePos ? (ahead === 0 ? ", you're next" : `, ${ahead} ahead of you`) : ""}${p.neededBy ? `. You asked for ${day(p.neededBy)}` : ""}`;
  if (p.status === "making") return `Todd is making ${p.round > 1 ? `round ${p.round}` : "it"}${p.promisedAt ? `, ready by ${day(p.promisedAt)}` : ""}`;
  if (p.status === "ready") return `Ready${p.readyAt ? ` since ${day(p.readyAt)}` : ""}. Get it from Todd and to the customer`;
  if (p.status === "with_customer") return `With the customer${p.sentAt ? ` since ${day(p.sentAt)}` : ""}. Log what they say`;
  if (p.status === "approved") return `Approved${p.approvedAt ? ` ${day(p.approvedAt)}` : ""}`;
  return "Dropped";
}

export function ProtoSteps({ status }: { status: string }) {
  const at = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1" aria-label={`Step ${at + 1} of ${STEPS.length}: ${STEPS[at]?.label || status}`}>
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span title={s.label} className={`h-2 w-2 rounded-full ${i < at ? "bg-brand-600" : i === at ? (status === "ready" ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-brand-600 ring-2 ring-brand-200") : "bg-gray-200"}`} />
          {i < STEPS.length - 1 && <span className={`h-px w-3 ${i < at ? "bg-brand-600" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

export function MyPrototypes({ title = "My prototypes" }: { title?: string }) {
  const [rows, setRows] = useState<ProtoLite[] | null>(null);
  useEffect(() => { fetch("/api/prototypes?mine=1").then((r) => r.json()).then((d) => setRows(d.prototypes || [])).catch(() => setRows([])); }, []);
  // Open ones, plus anything approved in the last 2 weeks.
  const list = (rows || []).filter((p) => p.status !== "dropped" && (p.status !== "approved" || (p.approvedAt && Date.now() - new Date(p.approvedAt).getTime() < 14 * 86400e3)));
  if (!list.length) return null;
  const order = ["ready", "with_customer", "making", "requested", "approved"];
  list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><Box className="h-4 w-4 text-brand-600" />{title}</span><a href="/dashboard/prototypes" className="text-xs text-brand-600 hover:underline">All prototypes</a></div>
      <div className="divide-y divide-gray-100">
        {list.map((p) => (
          <a key={p.id} href={`/dashboard/prototypes?open=${p.id}`} className={`flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-gray-50 ${p.status === "ready" ? "bg-emerald-50/60" : ""}`}>
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{p.customerName} <span className="text-xs font-normal text-gray-400">{p.number}{p.round > 1 ? ` · round ${p.round}` : ""}</span></div>
              <div className={`text-xs ${p.status === "ready" ? "font-medium text-emerald-700" : "text-gray-600"}`}>{protoWhere(p)}</div>
            </div>
            <ProtoSteps status={p.status} />
          </a>
        ))}
      </div>
    </div>
  );
}
