"use client";

// "ASI account" on the customer (Benjy 11/24/26): promotional-products distributors.
// Denise quotes and handles these. Shows as a badge on Customers and the Sales Funnel.
import { useEffect, useState } from "react";

const SET_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING", "CSR", "SALES_MANAGER"];

export function AsiSwitch({ companyId }: { companyId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [can, setCan] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch(`/api/companies/${companyId}`).then((r) => r.json()).then((d) => setOn(!!d.company?.asiAccount)).catch(() => setOn(false));
    fetch("/api/auth/session").then((r) => r.json()).then((d) => setCan(SET_ROLES.includes(d.user?.role))).catch(() => {});
  }, [companyId]);
  if (on === null) return null;
  const flip = async (v: boolean) => {
    setOn(v); setMsg("");
    const r = await fetch(`/api/companies/${companyId}/asi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: v }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Saved" : d.error || "Could not save");
    if (!r.ok) setOn(!v);
  };
  return (
    <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
      <input type="checkbox" checked={on} disabled={!can} onChange={(e) => flip(e.target.checked)} aria-describedby="gz-asi-hint" />
      <span className="font-medium text-gray-800">ASI account</span>
      <span id="gz-asi-hint" className="text-xs text-gray-500">Promotional products distributor. Denise quotes and handles it.{!can && " Accounting or Customer Service can change this."}</span>
      {msg && <span role="status" className={`text-xs ${msg === "Saved" ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
    </label>
  );
}
