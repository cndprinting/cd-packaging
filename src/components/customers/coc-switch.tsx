"use client";

// "Ships with a COC" on the customer (Shayla 11/19): Shipping sees "COC needed" on their shipments.
import { useEffect, useState } from "react";

export function CocSwitch({ companyId }: { companyId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch(`/api/companies/${companyId}`).then((r) => r.json()).then((d) => setOn(!!d.company?.cocRequired)).catch(() => setOn(false)); }, [companyId]);
  if (on === null) return null;
  const flip = async (v: boolean) => {
    setOn(v); setMsg("");
    const r = await fetch("/api/coc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "customer_flag", companyId, on: v }) });
    setMsg(r.ok ? "Saved" : "Could not save");
    if (!r.ok) setOn(!v);
  };
  return (
    <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => flip(e.target.checked)} />
      <span className="font-medium text-gray-800">Ships with a COC</span>
      <span className="text-xs text-gray-500">Certificate of Conformance with every shipment (supplement / nutra / derma customers)</span>
      {msg && <span className={`text-xs ${msg === "Saved" ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
    </label>
  );
}
