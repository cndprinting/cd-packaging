"use client";

// Payment terms on the customer's page (Benjy 11/18). Accounting and the CSRs
// set them; every job for this customer picks them up.
import { useEffect, useState } from "react";

export function CustomerTerms({ companyId }: { companyId: string }) {
  const [s, setS] = useState<{ terms: string | null; by: string | null; at: string | null; options: Record<string, string>; canEdit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/companies/${companyId}/terms`).then((r) => r.json()).then((d) => { if (d.options) setS(d); }).catch(() => {}); }, [companyId]);
  if (!s) return null;
  const save = async (terms: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/companies/${companyId}/terms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terms }) });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Could not save"); else setS(d);
    } catch { setErr("Could not save"); }
    setBusy(false);
  };
  const when = s.at ? new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-500">Payment terms:</span>
      {s.canEdit ? (
        <select value={s.terms || ""} disabled={busy} onChange={(e) => e.target.value && save(e.target.value)} aria-label="Payment terms" className="rounded-md border border-gray-300 px-2 py-1 text-sm">
          {!s.terms && <option value="">Not set (new jobs start at 50% down)</option>}
          {Object.entries(s.options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      ) : (
        <span className="font-medium text-gray-800">{s.terms ? s.options[s.terms] : "Not set (50% down)"}</span>
      )}
      {s.by && <span className="text-xs text-gray-400">set by {s.by}{when ? `, ${when}` : ""}</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
