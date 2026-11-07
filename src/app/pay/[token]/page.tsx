"use client";

// Public pay page: the link in every invoice email and reminder. No login.
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Inv = { invoiceNumber: string; customerName: string; description: string | null; subtotal: number; taxRate: number; taxAmount: number; total: number; depositAmount: number; depositPercent: number; depositPaid: boolean; paidAmount: number; remaining: number; status: string; dueDate: string | null; kind: string };
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const q = useSearchParams();
  const justPaid = q.get("paid") === "1";
  const [inv, setInv] = useState<Inv | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pay?t=${encodeURIComponent(token)}`).then(async (r) => { const d = await r.json(); if (!r.ok) setErr(d.error || "Not found"); else setInv(d.invoice); }).catch(() => setErr("Could not load the invoice"));
  }, [token, justPaid]);

  const pay = async (method: "card" | "ach", part: "deposit" | "balance") => {
    setBusy(method + part); setErr(null);
    try {
      const r = await fetch("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, method, part }) });
      const d = await r.json();
      if (!r.ok || !d.url) { setErr(d.error || "Could not start the payment"); return; }
      window.location.href = d.url;
    } catch { setErr("Could not start the payment"); }
    finally { setBusy(null); }
  };

  const showDeposit = inv && inv.depositAmount > 0 && !inv.depositPaid && inv.remaining > inv.depositAmount + 0.01;
  const Btn = ({ method, part, label }: { method: "card" | "ach"; part: "deposit" | "balance"; label: string }) => (
    <button onClick={() => pay(method, part)} disabled={!!busy} className={`w-full rounded-md px-4 py-3 text-sm font-semibold ${method === "ach" ? "bg-[#ED1C24] text-white hover:bg-red-700" : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"} disabled:opacity-50`}>{busy === method + part ? "Opening secure checkout…" : label}</button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1 bg-gradient-to-r from-[#ED1C24] to-[#27AAE1]" />
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-6">
          <div className="text-lg font-bold text-gray-900">C&amp;D Printing &amp; Packaging</div>
          <div className="text-xs text-gray-500">12150 28th St N., St. Petersburg, FL 33716 · 727-572-9999</div>
        </div>
        {err && !inv && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}
        {inv && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            {(justPaid || inv.remaining <= 0) && (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {inv.remaining <= 0 ? "This invoice is paid in full. Thank you." : "Thank you, your payment is being processed. Bank transfers can take a few business days to settle; this page will update when it does."}
              </div>
            )}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-500">{inv.kind === "final" ? "Invoice" : "Deposit invoice"}</div>
                <div className="text-xl font-bold text-gray-900">{inv.invoiceNumber}</div>
                <div className="text-sm text-gray-600">{inv.customerName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Balance</div>
                <div className="text-2xl font-bold text-[#ED1C24]">{money(inv.remaining)}</div>
                {inv.dueDate && <div className="text-xs text-gray-500">due {new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
              </div>
            </div>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {inv.description && <tr><td className="py-1 text-gray-500">Description</td><td className="py-1 text-right">{inv.description}</td></tr>}
                <tr><td className="py-1 text-gray-500">Subtotal</td><td className="py-1 text-right">{money(inv.subtotal)}</td></tr>
                <tr><td className="py-1 text-gray-500">Tax ({inv.taxRate}%)</td><td className="py-1 text-right">{money(inv.taxAmount)}</td></tr>
                <tr className="border-t"><td className="py-1 font-medium">Total</td><td className="py-1 text-right font-medium">{money(inv.total)}</td></tr>
                {inv.paidAmount > 0 && <tr><td className="py-1 text-gray-500">Paid</td><td className="py-1 text-right">{money(inv.paidAmount)}</td></tr>}
              </tbody>
            </table>
            {inv.remaining > 0 && (
              <div className="mt-6 space-y-2">
                {showDeposit && <>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{inv.depositPercent}% deposit · {money(inv.depositAmount)}</div>
                  <Btn method="ach" part="deposit" label={`Pay deposit by bank transfer · ${money(inv.depositAmount)} · no fee`} />
                  <Btn method="card" part="deposit" label={`Pay deposit by card · ${money(inv.depositAmount * 1.03)} incl. 3%`} />
                  <div className="pt-2 text-xs font-medium uppercase tracking-wide text-gray-500">Or the full balance</div>
                </>}
                <Btn method="ach" part="balance" label={`Pay by bank transfer (ACH) · ${money(inv.remaining)} · no fee`} />
                <Btn method="card" part="balance" label={`Pay by card · ${money(inv.remaining * 1.03)} incl. 3% surcharge`} />
                {err && <div className="text-sm text-red-600">{err}</div>}
                <p className="pt-2 text-xs text-gray-500">Payments are processed by Stripe. Checks can be mailed to the address above; please write the invoice number on the check.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
