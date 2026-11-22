"use client";

// Public "accept this quote" page: the link under Jessica's quote email. No login.
// Accepting does not charge anything. Accounting reviews and sends the deposit invoice.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Quote = { company: string; contactName: string; product: string; text: string; hasPdf: boolean; accepted: boolean; acceptedAt: string | null };

function Accept() {
  const q = useSearchParams();
  const id = q.get("id") || "", t = q.get("t") || "";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [f, setF] = useState({ name: "", option: "", po: "", note: "", authorized: false });

  useEffect(() => {
    fetch(`/api/accept?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) setErr(d.error || "Not found"); else { setQuote(d.quote); setDone(d.quote.accepted); setF((x) => ({ ...x, name: d.quote.contactName || "" })); } })
      .catch(() => setErr("We could not load your quote. Please try again shortly."));
  }, [id, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.authorized) { setErr("Please confirm you are authorized to place this order."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, t, ...f }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "We could not record that. Please call 727-572-9999."); return; }
      setDone(true);
    } catch { setErr("We could not record that. Please call 727-572-9999."); }
    finally { setBusy(false); }
  };

  const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#27AAE1] focus:outline-none focus:ring-2 focus:ring-[#27AAE1]/30";
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1 bg-gradient-to-r from-[#ED1C24] to-[#27AAE1]" />
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="text-sm font-semibold tracking-wide text-gray-900">C&amp;D Printing &amp; Packaging</div>
        <div className="text-xs text-gray-500">12150 28th Street North, St. Petersburg, FL 33716 · 727-572-9999</div>

        {!quote && !err && <div className="mt-8 text-sm text-gray-500">Loading your quote…</div>}
        {!quote && err && <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">{err}</div>}

        {quote && done && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-bold text-gray-900">Thank you. Your quote is accepted.</h1>
            <p className="mt-3 text-sm text-gray-700">We have let our team know. Your deposit invoice will arrive by email, usually within one business day, with a link to pay online by bank transfer or card.</p>
            <p className="mt-3 text-sm text-gray-700">Production is scheduled once the deposit is received and your proof is approved. Questions in the meantime: reply to our quote email or call 727-572-9999.</p>
          </div>
        )}

        {quote && !done && (
          <form onSubmit={submit} className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-bold text-gray-900">Accept your quote</h1>
            <p className="mt-1 text-sm text-gray-600">{quote.company}{quote.product ? ` · ${quote.product}` : ""}</p>
            {quote.text
              ? <pre className="mt-4 whitespace-pre-wrap rounded-md bg-gray-50 p-3 font-sans text-sm text-gray-800">{quote.text}</pre>
              : <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">This accepts the quote we emailed you{quote.hasPdf ? " (the PDF attached to that email)" : ""}.</p>}

            <label className="mt-5 block text-sm font-medium text-gray-800" htmlFor="acName">Your name<input id="acName" className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoComplete="name" /></label>
            <label className="mt-3 block text-sm font-medium text-gray-800" htmlFor="acOption">Quantity or option you are accepting <span className="font-normal text-gray-500">(if the quote gave more than one)</span><input id="acOption" className={input} value={f.option} onChange={(e) => setF({ ...f, option: e.target.value })} placeholder="For example 10,000" /></label>
            <label className="mt-3 block text-sm font-medium text-gray-800" htmlFor="acPo">PO number <span className="font-normal text-gray-500">(optional)</span><input id="acPo" className={input} value={f.po} onChange={(e) => setF({ ...f, po: e.target.value })} /></label>
            <label className="mt-3 block text-sm font-medium text-gray-800" htmlFor="acNote">Anything we should know <span className="font-normal text-gray-500">(optional)</span><textarea id="acNote" className={input} rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            <label className="mt-4 flex items-start gap-2 text-sm text-gray-800" htmlFor="acAuth"><input id="acAuth" type="checkbox" className="mt-1 h-4 w-4" checked={f.authorized} onChange={(e) => setF({ ...f, authorized: e.target.checked })} /><span>I am authorized to place this order for {quote.company}.</span></label>

            {err && <div className="mt-3 text-sm text-red-600" role="alert">{err}</div>}
            <button type="submit" disabled={busy} className="mt-5 w-full rounded-md bg-[#ED1C24] px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{busy ? "Sending…" : "Accept this quote"}</button>
            <p className="mt-3 text-xs text-gray-500">Accepting does not charge anything. We send a deposit invoice by email, and production is scheduled once the deposit is received and your proof is approved.</p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptPage() {
  return <Suspense fallback={null}><Accept /></Suspense>;
}
