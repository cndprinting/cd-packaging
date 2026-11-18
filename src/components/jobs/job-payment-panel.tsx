"use client";

// Job page: payment terms, the job's invoices, and whether it's cleared for
// press (Benjy 11/17). Replaces "confirm with Accounting before the job
// proceeds" with a status everyone can see.
import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type State = {
  terms: string | null; termsLabel: string; live: boolean; depositRequired: boolean; depositPaid: boolean; proofApproved: boolean;
  cleared: boolean; waitingOn: string[]; override: string | null; canOverride: boolean; terms_options: Record<string, string>;
  invoices: { id: string; invoiceNumber: string; status: string; total: number; depositAmount: number; depositPaid: boolean; paidAmount: number; remaining: number; kind: string }[];
};
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function JobPaymentPanel({ jobId }: { jobId: string }) {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => fetch(`/api/jobs/${jobId}/payment`).then((r) => r.json()).then((d) => { if (!d.error) setS(d); }).catch(() => {});
  useEffect(() => { load(); }, [jobId]);
  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/jobs/${jobId}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setErr(d.error || "Could not save"); return; }
    setS(d);
  };
  if (!s) return null;

  return (
    <Card className={`p-4 ${s.cleared ? "border-emerald-200" : "border-amber-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {s.cleared ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <Lock className="mt-0.5 h-5 w-5 text-amber-600" />}
          <div>
            <div className={`font-semibold ${s.cleared ? "text-emerald-800" : "text-amber-800"}`}>{s.cleared ? (s.override ? "Released to press by override" : "Cleared for press") : `Not cleared for press: waiting on ${s.waitingOn.join(" and ")}`}</div>
            <div className="text-xs text-gray-500">Proof {s.proofApproved ? "approved" : "not approved yet"} · {s.depositRequired ? (s.depositPaid ? "deposit paid" : "deposit not paid") : "no deposit required"}{!s.live ? " · test job, deposit not checked" : ""}</div>
            {s.override && <div className="mt-1 text-xs text-gray-600">{s.override}</div>}
          </div>
        </div>
        <label className="text-xs text-gray-600">Payment terms
          <select value={s.terms || ""} disabled={busy} onChange={(e) => post({ action: "terms", terms: e.target.value })} className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-xs">
            {!s.terms && <option value="">Not set</option>}
            {Object.entries(s.terms_options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 text-sm">
        {s.invoices.length ? (
          <div className="divide-y divide-gray-100 rounded-md border border-gray-100">
            {s.invoices.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-mono text-xs">{i.invoiceNumber}</span>
                <span className="text-xs text-gray-600">{money(i.total)}{i.depositAmount > 0 && i.depositAmount < i.total ? ` · deposit ${money(i.depositAmount)} ${i.depositPaid ? "paid" : "due"}` : ""}</span>
                <span className={`rounded px-1.5 text-[11px] font-semibold ${i.status === "draft" ? "bg-gray-100 text-gray-700" : i.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{i.status === "draft" ? "draft, with accounting" : i.status === "paid" ? "paid" : `${money(i.remaining)} open`}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">No invoice on this job yet.
            {s.depositRequired && <Button size="sm" variant="outline" disabled={busy} onClick={() => post({ action: "draft_deposit" })}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Draft the deposit invoice"}</Button>}
          </div>
        )}
      </div>

      {s.canOverride && !s.cleared && (
        <button type="button" disabled={busy} onClick={() => { const reason = prompt("Why is it OK to go to press without the proof or deposit? This is logged on the job."); if (reason) post({ action: "override", reason }); }} className="mt-3 text-xs text-gray-500 underline hover:text-gray-800">Release to press anyway</button>
      )}
      {s.canOverride && s.override && <button type="button" disabled={busy} onClick={() => post({ action: "clear_override" })} className="ml-3 mt-3 text-xs text-gray-500 underline hover:text-gray-800">Remove the release</button>}
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </Card>
  );
}
