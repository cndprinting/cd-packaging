"use client";

// Pre-Press & Proofs (remade 11/17/26). One board, columns by whose turn it
// is: waiting on art (CSR) -> make proof (pre-press) -> send to customer (CSR)
// -> with customer -> okay to print. Customer change requests come back to
// "Make proof" with their notes. Proofs go out with Approve / Request changes
// buttons and the customer's answer moves the card.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Layers, Loader2, X, Upload, Send, Mail, CheckCircle2, MessageSquareWarning, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadFile } from "@/lib/upload-client";

type Card = {
  id: string; jobNumber: string; name: string; status: string; quantity: number; dueDate: string | null; priority: string; customer: string; companyId: string | null;
  contactEmail: string | null; contactName: string | null; csr: string | null; salesRep: string | null; artworkStatus: string | null; jobType: string | null;
  stage: "art" | "make" | "send" | "customer" | "okay"; hours: number; slaLate: boolean; test: boolean;
  proof: { id: string; version: number; fileUrl: string | null; fileName: string | null; status: string; sentTo: string | null; sentAt: string | null; comment: string | null; respondedBy: string | null; respondedVia: string | null; notes: string | null } | null;
};
type Stage = { key: Card["stage"]; label: string; who: string; help: string };

const age = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`);
const COLORS: Record<string, string> = { art: "border-t-gray-400", make: "border-t-violet-500", send: "border-t-sky-500", customer: "border-t-amber-500", okay: "border-t-emerald-500" };

export default function PrepressPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [me, setMe] = useState<{ canAct: boolean; canMake: boolean }>({ canAct: false, canMake: false });
  const [loading, setLoading] = useState(true);
  const [showTest, setShowTest] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [send, setSend] = useState<{ c: Card; to: string; note: string; html: string; subject: string; reminder: boolean; busy: boolean } | null>(null);
  const [record, setRecord] = useState<{ c: Card; decision: "approve" | "changes"; name: string; comment: string; busy: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<Card | null>(null);

  const load = async () => {
    try { const r = await fetch(`/api/prepress${showTest ? "?test=1" : ""}`); const d = await r.json(); setStages(d.stages || []); setCards(d.jobs || []); if (d.me) setMe(d.me); } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTest]);
  const flash = (ok: boolean, t: string) => { setMsg({ ok, t }); setTimeout(() => setMsg(null), 7000); };
  const post = async (body: Record<string, unknown>, ok?: string) => {
    const r = await fetch("/api/prepress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { flash(false, d.error || "Could not save"); return null; }
    if (ok) flash(true, ok);
    await load(); return d;
  };

  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return n ? cards.filter((c) => [c.jobNumber, c.name, c.customer, c.csr, c.salesRep].some((v) => (v || "").toLowerCase().includes(n))) : cards; }, [cards, q]);

  const onFile = async (f?: File) => {
    const c = uploadFor.current; if (!f || !c) return;
    setBusyId(c.id);
    const up = await uploadFile(f);
    if (!up.ok || !up.data.url) { flash(false, up.data.error || up.data.message || "Upload failed"); setBusyId(null); return; }
    await post({ action: "upload_proof", jobId: c.id, fileUrl: up.data.url, fileName: up.data.fileName || f.name }, `Proof uploaded for ${c.jobNumber}. It's in Send to customer.`);
    setBusyId(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const openSend = async (c: Card, reminder = false) => {
    if (!c.proof) return;
    const d = await (await fetch("/api/prepress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_proof", proofId: c.proof.id, to: c.proof.sentTo || c.contactEmail || "", preview: true, reminder }) })).json();
    setSend({ c, to: d.to || c.contactEmail || "", note: "", html: d.html || "", subject: d.subject || "", reminder, busy: false });
  };
  const refreshPreview = async (s: NonNullable<typeof send>) => {
    const d = await (await fetch("/api/prepress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_proof", proofId: s.c.proof!.id, to: s.to, note: s.note, preview: true, reminder: s.reminder }) })).json();
    if (d.html) setSend({ ...s, html: d.html, subject: d.subject });
  };

  const counts = useMemo(() => Object.fromEntries((stages.length ? stages : []).map((s) => [s.key, shown.filter((c) => c.stage === s.key).length])), [stages, shown]);
  const lateProofs = shown.filter((c) => c.slaLate).length;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Layers className="h-6 w-6 text-brand-600" /><div><h1 className="text-2xl font-bold text-gray-900">Pre-Press &amp; Proofs</h1><p className="text-sm text-gray-500">Each column is whose move it is. 24-hour proof target from when the art is in.</p></div></div>
        <div className="flex items-center gap-2">
          <div className="w-56"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job, customer, CSR" /></div>
          <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />Show test jobs</label>
          <Button variant="outline" size="sm" onClick={load} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
        </div>
      </div>
      {msg && <div className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}
      {lateProofs > 0 && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{lateProofs} proof{lateProofs === 1 ? " is" : "s are"} past the 24-hour target.</div>}

      {loading ? <div className="p-8 text-sm text-gray-400"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading</div> : (
        <div className="grid gap-3 lg:grid-cols-5">
          {stages.map((s) => (
            <div key={s.key} className={`rounded-lg border border-gray-200 border-t-4 bg-gray-50 ${COLORS[s.key]}`}>
              <div className="px-3 pt-3">
                <div className="flex items-center justify-between"><span className="font-semibold text-gray-900">{s.label}</span><span className="rounded-full bg-white px-2 text-xs text-gray-600">{counts[s.key] || 0}</span></div>
                <div className="text-[11px] text-gray-500">{s.who}: {s.help}</div>
              </div>
              <div className="space-y-2 p-2">
                {shown.filter((c) => c.stage === s.key).map((c) => (
                  <div key={c.id} className={`rounded-md border bg-white p-2.5 text-sm shadow-sm ${c.slaLate ? "border-red-300" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/jobs/${c.id}`} className="font-mono text-[11px] text-gray-500 hover:text-brand-600">{c.jobNumber}{c.test && " · test"}</Link>
                      <span className={`inline-flex items-center gap-0.5 text-[11px] ${c.slaLate ? "font-semibold text-red-600" : "text-gray-400"}`}><Clock className="h-3 w-3" />{age(c.hours)}</span>
                    </div>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.customer}{c.quantity ? ` · ${c.quantity.toLocaleString()}` : ""}</div>
                    <div className="text-[11px] text-gray-400">{[c.csr && `CSR ${c.csr}`, c.salesRep && `Sales ${c.salesRep}`, c.dueDate && `due ${String(c.dueDate).slice(5, 10)}`].filter(Boolean).join(" · ")}</div>
                    {c.proof && c.stage !== "art" && (
                      <div className="mt-1 text-[11px]">
                        {c.proof.fileUrl ? <a href={c.proof.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Proof v{c.proof.version}</a> : <span className="text-gray-500">v{c.proof.version} {c.proof.fileName}</span>}
                        {c.proof.sentTo && c.stage === "customer" && <span className="text-gray-500"> · sent to {c.proof.sentTo}</span>}
                      </div>
                    )}
                    {c.stage === "make" && c.proof?.comment && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900"><MessageSquareWarning className="mr-1 inline h-3 w-3" />{c.proof.respondedBy || "Customer"}: {c.proof.comment}</div>}
                    {c.stage === "okay" && c.proof?.respondedBy && <div className="mt-1 text-[11px] text-emerald-700"><CheckCircle2 className="mr-0.5 inline h-3 w-3" />{c.proof.respondedBy} ({c.proof.respondedVia})</div>}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.stage === "art" && me.canAct && <Button size="sm" variant="outline" onClick={() => post({ action: "art_in", jobId: c.id }, `Art is in for ${c.jobNumber}. The proof clock started.`)}>Art is in</Button>}
                      {c.stage === "make" && me.canMake && <Button size="sm" disabled={busyId === c.id} onClick={() => { uploadFor.current = c; fileRef.current?.click(); }} className="gap-1">{busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{c.proof ? `Upload v${c.proof.version + 1}` : "Upload proof"}</Button>}
                      {c.stage === "make" && me.canMake && !c.proof && <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => { const reason = prompt(`Why does ${c.jobNumber} need no proof? (e.g. exact reprint, customer waived)`); if (reason) post({ action: "no_proof", jobId: c.id, reason }, `${c.jobNumber} marked okay to print without a proof.`); }}>No proof needed</button>}
                      {c.stage === "send" && me.canAct && <Button size="sm" onClick={() => openSend(c)} className="gap-1"><Send className="h-3.5 w-3.5" />Send proof</Button>}
                      {c.stage === "send" && me.canAct && <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => post({ action: "mark_sent", proofId: c.proof!.id, method: "physical" }, "Marked sent")}>Sent another way</button>}
                      {c.stage === "customer" && me.canAct && <>
                        <Button size="sm" variant="outline" onClick={() => openSend(c, true)} className="gap-1"><Mail className="h-3.5 w-3.5" />Remind</Button>
                        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setRecord({ c, decision: "approve", name: c.contactName || "", comment: "", busy: false })}>They approved by phone/email</button>
                        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setRecord({ c, decision: "changes", name: c.contactName || "", comment: "", busy: false })}>They want changes</button>
                      </>}
                    </div>
                  </div>
                ))}
                {!shown.some((c) => c.stage === s.key) && <div className="px-1 py-3 text-center text-[11px] text-gray-400">Nothing here</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {send && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSend(null)}>
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{send.reminder ? "Remind" : "Send proof"} · {send.c.customer}, {send.c.jobNumber}</h2><button onClick={() => setSend(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="block"><span className="text-gray-600">To (customer email, separate several with commas)</span><Input value={send.to} onChange={(e) => setSend({ ...send, to: e.target.value })} /></label>
              <label className="block"><span className="text-gray-600">Note (optional)</span><textarea value={send.note} onChange={(e) => setSend({ ...send, note: e.target.value })} onBlur={() => refreshPreview(send)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <div className="text-xs text-gray-500">Subject: {send.subject}</div>
            </div>
            <iframe title="preview" srcDoc={send.html} className="mt-2 min-h-[280px] flex-1 rounded border border-gray-200" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Sends from your mailbox. Their Approve or Request changes click updates this board.</span>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setSend(null)}>Cancel</Button><Button disabled={send.busy || !send.to.trim()} onClick={async () => { setSend({ ...send, busy: true }); const d = await post({ action: "send_proof", proofId: send.c.proof!.id, to: send.to, note: send.note, reminder: send.reminder }, `Proof ${send.reminder ? "reminder" : ""} sent to ${send.to}`); if (d) setSend(null); else setSend({ ...send, busy: false }); }}>{send.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}</Button></div>
            </div>
          </div>
        </div>
      )}

      {record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setRecord(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{record.decision === "approve" ? "Record customer approval" : "Record requested changes"}</h2><button onClick={() => setRecord(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <p className="mt-1 text-xs text-gray-500">{record.c.customer} · {record.c.jobNumber} · proof v{record.c.proof?.version}</p>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="block"><span className="text-gray-600">Who at the customer</span><Input value={record.name} onChange={(e) => setRecord({ ...record, name: e.target.value })} /></label>
              <label className="block"><span className="text-gray-600">{record.decision === "approve" ? "Note (optional)" : "What do they want changed?"}</span><textarea value={record.comment} onChange={(e) => setRecord({ ...record, comment: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRecord(null)}>Cancel</Button><Button disabled={record.busy || !record.name.trim() || (record.decision === "changes" && !record.comment.trim())} onClick={async () => { setRecord({ ...record, busy: true }); const d = await post({ action: "record", proofId: record.c.proof!.id, decision: record.decision, name: record.name, comment: record.comment }, record.decision === "approve" ? `${record.c.jobNumber} approved. It's okay to print once the deposit is in.` : `${record.c.jobNumber} is back in Make proof with the changes.`); if (d) setRecord(null); else setRecord({ ...record, busy: false }); }}>Save</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
