"use client";

// Customer proof approval (no login). Linked from the proof email's Approve /
// Request changes buttons. Benjy 11/17/26.
import { use, useEffect, useState } from "react";

type View = { customer: string; jobNumber: string; jobName: string; quantity: number; version: number; fileUrl: string | null; fileName: string | null; answered: boolean; status: string; respondedBy: string | null; comment: string | null };

export default function ProofPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"approve" | "changes" | null>(null);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("d");
    if (d === "approve" || d === "changes") setMode(d);
    fetch(`/api/proof-response?t=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error); else setV(j); }).catch(() => setErr("Couldn't load the proof. Call C&D at 727-572-9999."));
  }, [token]);

  const submit = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/proof-response", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, decision: mode, name, comment }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error || "Something went wrong"); return; }
    setV(j);
  };

  // Uploaded files don't always keep their extension in the URL (11/20/26: preview missing), so check the name too.
  const kindOf = `${v?.fileName || ""} ${v?.fileUrl || ""}`;
  const isPdf = !!v?.fileUrl && /\.pdf($|\?|\s)/i.test(kindOf);
  const isImg = !!v?.fileUrl && !isPdf && /\.(png|jpe?g|gif|webp)($|\?|\s)/i.test(kindOf);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3"><img src="/logo-icon.svg" alt="" className="h-9 w-9" /><div><div className="font-semibold text-gray-900">C&amp;D Printing &amp; Packaging</div><div className="text-xs text-gray-500">Proof approval</div></div></div>
        {err && !v && <div className="rounded-lg bg-white p-6 text-gray-700 shadow-sm">{err}</div>}
        {v && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">{v.customer}</div>
            <h1 className="text-xl font-semibold text-gray-900">{v.jobName}</h1>
            <div className="text-sm text-gray-500">Job {v.jobNumber} · proof version {v.version}{v.quantity ? ` · quantity ${v.quantity.toLocaleString()}` : ""}</div>

            {v.fileUrl && (
              <div className="mt-4">
                {isPdf && <iframe title="Proof" src={v.fileUrl} className="h-[560px] w-full rounded border border-gray-200" />}
                {isImg && <img src={v.fileUrl} alt="Proof" className="max-h-[560px] w-full rounded border border-gray-200 object-contain" />}
                <a href={v.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-700 underline">Open the proof in a new tab{v.fileName ? ` (${v.fileName})` : ""}</a>
              </div>
            )}

            {v.answered ? (
              <div className={`mt-6 rounded-md p-4 ${v.status === "APPROVED" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
                {v.status === "APPROVED" ? <p><b>Approved{v.respondedBy ? ` by ${v.respondedBy}` : ""}.</b> Thank you. We'll schedule it for press and keep you posted.</p> : <p><b>Changes requested{v.respondedBy ? ` by ${v.respondedBy}` : ""}.</b> Thank you. We'll send a new proof.{v.comment ? ` Your notes: "${v.comment}"` : ""}</p>}
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setMode("approve")} className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === "approve" ? "bg-green-700 text-white" : "border border-green-700 text-green-800"}`}>Approve proof</button>
                  <button onClick={() => setMode("changes")} className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === "changes" ? "bg-amber-700 text-white" : "border border-amber-700 text-amber-800"}`}>Request changes</button>
                </div>
                {mode && (
                  <div className="mt-4 space-y-3 text-sm">
                    <label className="block"><span className="text-gray-700">Your name</span><input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3" autoComplete="name" /></label>
                    <label className="block"><span className="text-gray-700">{mode === "approve" ? "Anything to add (optional)" : "What should we change?"}</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={mode === "approve" ? 2 : 5} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
                    {mode === "approve" && <label className="flex items-start gap-2 text-gray-700"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />I've checked spelling, colors, dimensions and content, and approve this proof for printing as shown.</label>}
                    {err && <div className="text-red-700">{err}</div>}
                    <button onClick={submit} disabled={busy || !name.trim() || (mode === "approve" ? !checked : !comment.trim())} className="rounded-md bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Sending..." : mode === "approve" ? "Approve for printing" : "Send my changes"}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-gray-400">Questions? Call (727) 572-9999.</p>
      </div>
    </div>
  );
}
