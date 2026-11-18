"use client";

// Archive / restore on the customer's page (Benjy 11/18). Archived customers
// drop out of every picker but keep their history.
import { useEffect, useState } from "react";
import { Archive, RotateCcw } from "lucide-react";

type S = { archived: boolean; archivedAt: string | null; archivedBy: string | null; archivedReason: string | null; canArchive: boolean };

export function CustomerArchive({ companyId }: { companyId: string }) {
  const [s, setS] = useState<S | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("Out of business");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => fetch(`/api/companies/${companyId}/terms`).then((r) => r.json()).then((d) => { if ("archived" in d) setS(d); }).catch(() => {});
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);
  if (!s) return null;
  const act = async (action: "archive" | "restore") => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/companies/${companyId}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Could not save"); else { setAsking(false); await load(); }
    } catch { setErr("Could not save"); }
    setBusy(false);
  };
  const when = s.archivedAt ? new Date(s.archivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  if (s.archived) return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-800">
      <span><b>Archived:</b> {s.archivedReason || "Out of business"}{s.archivedBy ? ` (${s.archivedBy}${when ? `, ${when}` : ""})` : ""}. Kept for reference; this customer doesn't appear when picking a customer.</span>
      {s.canArchive && <button type="button" disabled={busy} onClick={() => act("restore")} className="inline-flex items-center gap-1 rounded-md border border-gray-400 bg-white px-3 py-1 text-xs hover:bg-gray-50"><RotateCcw className="h-3.5 w-3.5" />Restore</button>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
  if (!s.canArchive) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
      {asking ? (
        <>
          <label className="text-gray-600" htmlFor="archive-reason">Why?</label>
          <input id="archive-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56 rounded-md border border-gray-300 px-2 py-1" />
          <button type="button" disabled={busy} onClick={() => act("archive")} className="rounded-md bg-gray-800 px-3 py-1 text-white hover:bg-gray-700">Archive customer</button>
          <button type="button" onClick={() => setAsking(false)} className="text-gray-500 hover:underline">Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 hover:underline"><Archive className="h-3.5 w-3.5" />Archive customer (out of business)</button>
      )}
      {err && <span className="text-red-600">{err}</span>}
    </div>
  );
}
