"use client";

// Pre-Press & Proofs (remade 11/17/26; Mike Metroka's flow 11/19/26). One board,
// columns by whose turn it is: waiting on art (CSR) -> preflight (pre-press,
// report to the CSR) -> make PDF proof -> send to customer (CSR) -> with
// customer -> hard proof (pre-press prints it; customer or CSR + sales approve)
// -> okay to plate. Each card's History is Mike's "Event Management" grid:
// new file / imposition / e-proof / physical proof dates per round, with where
// each file lives.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Layers, Loader2, X, Upload, Send, Mail, CheckCircle2, MessageSquareWarning, Clock, RefreshCw, History, FileSearch, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadFile } from "@/lib/upload-client";

type Proof = { id: string; kind: string; version: number; fileUrl: string | null; fileName: string | null; status: string; sentTo: string | null; sentAt: string | null; comment: string | null; respondedBy: string | null; respondedVia: string | null; notes: string | null; location: string | null; deliveryMethod: string | null };
type Ev = { t: string; at: string; by: string; round: number; loc?: string; target?: string; note?: string };
type StageKey = "art" | "preflight" | "make" | "send" | "customer" | "hard" | "okay";
type Card = {
  id: string; jobNumber: string; name: string; status: string; quantity: number; dueDate: string | null; priority: string; customer: string; companyId: string | null;
  contactEmail: string | null; contactName: string | null; csr: string | null; salesRep: string | null; artworkStatus: string | null; jobType: string | null;
  stage: StageKey; hardStep: "decide" | "print" | "reprint" | "review" | null; hardProof: string | null; hardProofDefault: string | null;
  preflight: { issues: string[]; note: string; result: string; by: string; at: string } | null; events: Ev[];
  hours: number; slaLate: boolean; test: boolean; proof: Proof | null; pdf: Proof | null; hard: Proof | null;
};
type Stage = { key: StageKey; label: string; who: string; help: string };

const age = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`);
const md = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "America/New_York" });
const COLORS: Record<string, string> = { art: "border-t-gray-400", preflight: "border-t-indigo-400", make: "border-t-violet-500", send: "border-t-sky-500", customer: "border-t-amber-500", hard: "border-t-orange-500", okay: "border-t-emerald-500" };
const GRID_ROWS: { t: string; label: string }[] = [{ t: "new_file", label: "New file" }, { t: "imposition", label: "Imposition" }, { t: "eproof", label: "E-proof" }, { t: "physical", label: "Physical proof" }];
const isLink = (v?: string | null) => !!v && /^https?:\/\//i.test(v);

export default function PrepressPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [issuesList, setIssuesList] = useState<string[]>([]);
  const [hardLabels, setHardLabels] = useState<Record<string, string>>({});
  const [me, setMe] = useState<{ role?: string; canAct: boolean; canMake: boolean }>({ canAct: false, canMake: false });
  const [loading, setLoading] = useState(true);
  const [showTest, setShowTest] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [send, setSend] = useState<{ c: Card; to: string; note: string; html: string; subject: string; reminder: boolean; busy: boolean } | null>(null);
  const [record, setRecord] = useState<{ c: Card; decision: "approve" | "changes"; name: string; comment: string; internal: boolean; busy: boolean } | null>(null);
  const [pre, setPre] = useState<{ c: Card; issues: string[]; note: string; result: "ok" | "fixed" | "new_art"; busy: boolean } | null>(null);
  const [fileDlg, setFileDlg] = useState<{ c: Card; action: "art_in" | "new_file" | "imposed" | "hard"; target: "XMF" | "Konica"; location: string; note: string; file: File | null; busy: boolean } | null>(null);
  const [hist, setHist] = useState<Card | null>(null);
  const [always, setAlways] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<Card | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/prepress${showTest ? "?test=1" : ""}`); const d = await r.json();
      setStages(d.stages || []); setCards(d.jobs || []); setIssuesList(d.preflightIssues || []); setHardLabels(d.hardLabels || {}); if (d.me) setMe(d.me);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTest]);
  // Keep an open History dialog in sync after a reload.
  useEffect(() => { if (hist) { const n = cards.find((c) => c.id === hist.id); if (n && n !== hist) setHist(n); } }, [cards]); // eslint-disable-line react-hooks/exhaustive-deps
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
    await post({ action: "upload_proof", kind: "pdf", jobId: c.id, fileUrl: up.data.url, fileName: up.data.fileName || f.name }, `PDF proof uploaded for ${c.jobNumber}. It's in Send to customer.`);
    setBusyId(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const openSend = async (c: Card, reminder = false) => {
    if (!c.proof) return;
    const d = await (await fetch("/api/prepress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_proof", proofId: c.proof.id, to: c.proof.sentTo || c.contactEmail || "", preview: true, reminder }) })).json();
    if (d.error) { flash(false, d.error); return; }
    setSend({ c, to: d.to || c.contactEmail || "", note: "", html: d.html || "", subject: d.subject || "", reminder, busy: false });
  };
  const refreshPreview = async (s: NonNullable<typeof send>) => {
    const d = await (await fetch("/api/prepress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_proof", proofId: s.c.proof!.id, to: s.to, note: s.note, preview: true, reminder: s.reminder }) })).json();
    if (d.html) setSend({ ...s, html: d.html, subject: d.subject });
  };
  const saveFileDlg = async () => {
    if (!fileDlg) return;
    const f = fileDlg; setFileDlg({ ...f, busy: true });
    let d: any = null;
    if (f.action === "hard") {
      let fileUrl: string | undefined, fileName: string | undefined;
      if (f.file) { const up = await uploadFile(f.file); if (!up.ok || !up.data.url) { flash(false, up.data.error || "Upload failed"); setFileDlg({ ...f, busy: false }); return; } fileUrl = up.data.url; fileName = up.data.fileName || f.file.name; }
      d = await post({ action: "upload_proof", kind: "hard", jobId: f.c.id, fileUrl, fileName, location: f.location, notes: f.note }, f.c.hardProof === "internal" ? `Hard proof logged for ${f.c.jobNumber}. CSR and sales check it next.` : `Hard proof logged for ${f.c.jobNumber}. It's in Send to customer.`);
    } else {
      d = await post({ action: f.action, jobId: f.c.id, location: f.location, note: f.note, target: f.target }, f.action === "art_in" ? `Art is in for ${f.c.jobNumber}. Preflight is next.` : f.action === "new_file" ? `New file logged for ${f.c.jobNumber}.` : `Imposition logged for ${f.c.jobNumber}.`);
    }
    if (d) setFileDlg(null); else setFileDlg({ ...f, busy: false });
  };
  const openFile = (c: Card, action: NonNullable<typeof fileDlg>["action"], target: "XMF" | "Konica" = "XMF") => setFileDlg({ c, action, target, location: "", note: "", file: null, busy: false });

  const counts = useMemo(() => Object.fromEntries((stages.length ? stages : []).map((s) => [s.key, shown.filter((c) => c.stage === s.key).length])), [stages, shown]);
  const lateProofs = shown.filter((c) => c.slaLate).length;
  const kindName = (c: Card) => (c.proof?.kind === "hard" ? "hard proof" : "proof");

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Layers className="h-6 w-6 text-brand-600" /><div><h1 className="text-2xl font-bold text-gray-900">Pre-Press &amp; Proofs</h1><p className="text-sm text-gray-500">Each column is whose move it is. 24-hour PDF proof target once the files pass preflight.</p></div></div>
        <div className="flex items-center gap-2">
          <div className="w-56"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job, customer, CSR" /></div>
          <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />Show test jobs</label>
          <Button variant="outline" size="sm" onClick={load} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
        </div>
      </div>
      {msg && <div className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}
      {lateProofs > 0 && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{lateProofs} proof{lateProofs === 1 ? " is" : "s are"} past the 24-hour target.</div>}

      {loading ? <div className="p-8 text-sm text-gray-400"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading</div> : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {stages.map((s) => (
            <div key={s.key} className={`min-w-0 rounded-lg border border-gray-200 border-t-4 bg-gray-50 ${COLORS[s.key]}`}>
              <div className="px-3 pt-3">
                <div className="flex items-center justify-between"><span className="font-semibold text-gray-900">{s.label}</span><span className="rounded-full bg-white px-2 text-xs text-gray-600">{counts[s.key] || 0}</span></div>
                <div className="text-[11px] text-gray-500">{s.who}: {s.help}</div>
              </div>
              <div className="space-y-2 p-2">
                {shown.filter((c) => c.stage === s.key).map((c) => (
                  <div key={c.id} className={`rounded-md border bg-white p-2.5 text-sm shadow-sm ${c.slaLate ? "border-red-300" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/jobs/${c.id}`} className="font-mono text-[11px] text-gray-500 hover:text-brand-600">{c.jobNumber}{c.test && " · test"}</Link>{(c as any).isTest && <span className="ml-1 rounded bg-yellow-300 px-1 text-[10px] font-bold text-yellow-900" title="TEST job (December test mode): never reaches invoicing, shipping, customers or the live team">TEST</span>}
                      <span className={`inline-flex items-center gap-0.5 text-[11px] ${c.slaLate ? "font-semibold text-red-600" : "text-gray-400"}`}><Clock className="h-3 w-3" />{age(c.hours)}</span>
                    </div>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.customer}{c.quantity ? ` · ${c.quantity.toLocaleString()}` : ""}</div>
                    <div className="text-[11px] text-gray-400">{[c.csr && `CSR ${c.csr}`, c.salesRep && `Sales ${c.salesRep}`, c.dueDate && `due ${String(c.dueDate).slice(5, 10)}`].filter(Boolean).join(" · ")}</div>
                    {!c.hardProof && <div className="mt-1 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">No proof type on ticket (CSR)</div>}
                    {c.hardProof && <div className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] ${c.hardProof === "none" ? "bg-amber-50 text-amber-800" : "bg-orange-50 text-orange-800"}`}>{hardLabels[c.hardProof] || c.hardProof}</div>}
                    {c.proof && !["art", "preflight"].includes(c.stage) && (
                      <div className="mt-1 text-[11px]">
                        {c.proof.fileUrl ? <a href={c.proof.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{c.proof.kind === "hard" ? "Hard proof" : "PDF proof"} v{c.proof.version}</a> : <span className="text-gray-500">{c.proof.kind === "hard" ? "Hard proof" : "PDF"} v{c.proof.version}{c.proof.kind !== "hard" && c.proof.fileName ? ` ${c.proof.fileName}` : ""}</span>}
                        {c.proof.sentTo && c.stage === "customer" && <span className="text-gray-500"> · sent to {c.proof.sentTo}</span>}
                      </div>
                    )}
                    {c.preflight && c.preflight.result !== "ok" && ["art", "preflight", "make"].includes(c.stage) && (
                      <div className="mt-1 rounded bg-indigo-50 px-2 py-1 text-[11px] text-indigo-900"><FileSearch className="mr-1 inline h-3 w-3" />Preflight{c.preflight.result === "new_art" ? ", new files needed" : ", fixed by pre-press"}: {[c.preflight.issues.join(", "), c.preflight.note].filter(Boolean).join(" - ")}</div>
                    )}
                    {(c.stage === "make" || c.stage === "hard") && c.proof?.comment && ["REVISION_REQUESTED", "REJECTED"].includes(c.proof.status) && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900"><MessageSquareWarning className="mr-1 inline h-3 w-3" />{c.proof.respondedBy || "Customer"}: {c.proof.comment}</div>}
                    {c.stage === "okay" && c.proof?.respondedBy && <div className="mt-1 text-[11px] text-emerald-700"><CheckCircle2 className="mr-0.5 inline h-3 w-3" />{c.proof.respondedBy} ({c.proof.respondedVia})</div>}
                    {c.stage === "okay" && c.hardProof === "none" && <div className="mt-1 text-[11px] text-amber-700"><AlertTriangle className="mr-0.5 inline h-3 w-3" />PDF proof only, no hard proof</div>}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {c.stage === "art" && me.canAct && <Button size="sm" variant="outline" onClick={() => openFile(c, "art_in")}>Art is in</Button>}
                      {c.stage === "preflight" && me.canMake && <Button size="sm" onClick={() => setPre({ c, issues: [], note: "", result: "ok", busy: false })} className="gap-1"><FileSearch className="h-3.5 w-3.5" />Preflight</Button>}
                      {c.stage === "make" && me.canMake && <Button size="sm" disabled={busyId === c.id} onClick={() => { uploadFor.current = c; fileRef.current?.click(); }} className="gap-1">{busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{c.pdf ? `Upload PDF v${c.pdf.version + 1}` : "Upload PDF proof"}</Button>}
                      {c.stage === "send" && me.canAct && c.proof?.fileUrl && <Button size="sm" onClick={() => openSend(c)} className="gap-1"><Send className="h-3.5 w-3.5" />Email {kindName(c)}</Button>}
                      {c.stage === "send" && me.canAct && <button type="button" className={c.proof?.fileUrl ? "text-[11px] text-gray-500 underline" : "rounded border border-sky-300 px-2 py-1 text-xs text-sky-800"} onClick={() => post({ action: "mark_sent", proofId: c.proof!.id, method: "physical" }, "Marked sent")}>{c.proof?.kind === "hard" ? "Hard proof handed over / shipped" : "Sent a physical proof / another way"}</button>}
                      {c.stage === "customer" && me.canAct && <>
                        {c.proof?.fileUrl && c.proof.deliveryMethod === "email" && <Button size="sm" variant="outline" onClick={() => openSend(c, true)} className="gap-1"><Mail className="h-3.5 w-3.5" />Remind</Button>}
                        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setRecord({ c, decision: "approve", name: c.contactName || "", comment: "", internal: false, busy: false })}>They approved (signed proof, phone or email)</button>
                        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setRecord({ c, decision: "changes", name: c.contactName || "", comment: "", internal: false, busy: false })}>They want changes</button>
                      </>}
                      {c.stage === "hard" && c.hardStep === "decide" && me.canAct && ["PREPRESS_MANAGER", "DIGITAL_PRESS"].includes(me.role || "") && (
                        <div className="w-full rounded bg-orange-50 p-1.5 text-[11px] text-orange-900">PDF approved. The ticket has no proof type; {c.csr || "the CSR"} has been asked to set it.</div>
                      )}
                      {c.stage === "hard" && c.hardStep === "decide" && me.canAct && !["PREPRESS_MANAGER", "DIGITAL_PRESS"].includes(me.role || "") && (
                        <div className="w-full rounded bg-orange-50 p-1.5 text-[11px] text-orange-900">
                          <div className="mb-1 font-medium">PDF approved. No proof type on the ticket. Set it:</div>
                          <div className="flex flex-wrap gap-1">
                            {(["customer", "internal", "none"] as const).map((m) => <button key={m} type="button" className="rounded border border-orange-300 bg-white px-1.5 py-0.5 hover:bg-orange-100" onClick={() => post({ action: "hard_mode", jobId: c.id, mode: m, always: !!always[c.id] }, `${c.jobNumber}: ${hardLabels[m]}${always[c.id] ? ` (default for ${c.customer})` : ""}`)}>{m === "customer" ? "To customer" : m === "internal" ? "Internal check" : "PDF only"}</button>)}
                          </div>
                          {c.companyId && <label className="mt-1 flex items-center gap-1"><input type="checkbox" checked={!!always[c.id]} onChange={(e) => setAlways({ ...always, [c.id]: e.target.checked })} />Always for {c.customer}</label>}
                        </div>
                      )}
                      {c.stage === "hard" && (c.hardStep === "print" || c.hardStep === "reprint") && me.canMake && <Button size="sm" onClick={() => openFile(c, "hard")} className="gap-1"><Printer className="h-3.5 w-3.5" />{c.hardStep === "reprint" ? `Hard proof v${(c.hard?.version || 0) + 1} printed` : "Hard proof printed"}</Button>}
                      {c.stage === "hard" && c.hardStep === "review" && me.canAct && <>
                        <Button size="sm" variant="outline" onClick={() => setRecord({ c, decision: "approve", name: "", comment: "", internal: true, busy: false })} className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Looks right</Button>
                        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setRecord({ c, decision: "changes", name: "", comment: "", internal: true, busy: false })}>Needs changes</button>
                      </>}
                      <button type="button" title="History: files, imposition and proofs by round" className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-brand-600" onClick={() => setHist(c)}><History className="h-3 w-3" />{c.events.length || ""}</button>
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
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{send.reminder ? "Remind" : `Send ${kindName(send.c)}`} · {send.c.customer}, {send.c.jobNumber}</h2><button onClick={() => setSend(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="block"><span className="text-gray-600">To (customer email, separate several with commas)</span><Input value={send.to} onChange={(e) => setSend({ ...send, to: e.target.value })} /></label>
              <label className="block"><span className="text-gray-600">Note (optional)</span><textarea value={send.note} onChange={(e) => setSend({ ...send, note: e.target.value })} onBlur={() => refreshPreview(send)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <div className="text-xs text-gray-500">Subject: {send.subject}</div>
            </div>
            <iframe title="preview" srcDoc={send.html} className="mt-2 min-h-[280px] flex-1 rounded border border-gray-200" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Sends from your mailbox. Their Approve or Request changes click updates this board.</span>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setSend(null)}>Cancel</Button><Button disabled={send.busy || !send.to.trim()} onClick={async () => { setSend({ ...send, busy: true }); const d = await post({ action: "send_proof", proofId: send.c.proof!.id, to: send.to, note: send.note, reminder: send.reminder }, `${send.reminder ? "Reminder" : "Proof"} sent to ${send.to}`); if (d) setSend(null); else setSend({ ...send, busy: false }); }}>{send.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}</Button></div>
            </div>
          </div>
        </div>
      )}

      {record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setRecord(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{record.internal ? (record.decision === "approve" ? "Hard proof looks right" : "Hard proof needs changes") : record.decision === "approve" ? "Record customer approval" : "Record requested changes"}</h2><button onClick={() => setRecord(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <p className="mt-1 text-xs text-gray-500">{record.c.customer} · {record.c.jobNumber} · {record.c.proof?.kind === "hard" ? "hard proof" : "PDF proof"} v{record.c.proof?.version}{record.internal && " · internal check, signed off under your name"}</p>
            <div className="mt-3 grid gap-2 text-sm">
              {!record.internal && <label className="block"><span className="text-gray-600">Who at the customer</span><Input value={record.name} onChange={(e) => setRecord({ ...record, name: e.target.value })} /></label>}
              <label className="block"><span className="text-gray-600">{record.decision === "approve" ? "Note (optional)" : "What needs to change?"}</span><textarea value={record.comment} onChange={(e) => setRecord({ ...record, comment: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRecord(null)}>Cancel</Button><Button disabled={record.busy || (!record.internal && !record.name.trim()) || (record.decision === "changes" && !record.comment.trim())} onClick={async () => { setRecord({ ...record, busy: true }); const d = await post({ action: "record", proofId: record.c.proof!.id, decision: record.decision, name: record.name, comment: record.comment, internal: record.internal }, record.decision === "approve" ? `${record.c.jobNumber} approved.` : `${record.c.jobNumber} is back with pre-press for changes.`); if (d) setRecord(null); else setRecord({ ...record, busy: false }); }}>Save</Button></div>
          </div>
        </div>
      )}

      {pre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setPre(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Preflight · {pre.c.jobNumber}</h2><button onClick={() => setPre(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <p className="mt-1 text-xs text-gray-500">{pre.c.customer} · {pre.c.name}. Anything you find goes to {pre.c.csr || "the CSR"} to pass along to the customer.</p>
            <div className="mt-3 grid gap-1 text-sm">
              {issuesList.map((i) => <label key={i} className="flex items-center gap-2"><input type="checkbox" checked={pre.issues.includes(i)} onChange={(e) => setPre({ ...pre, issues: e.target.checked ? [...pre.issues, i] : pre.issues.filter((x) => x !== i), result: e.target.checked && pre.result === "ok" ? "fixed" : pre.result })} />{i}</label>)}
              <label className="mt-1 block"><span className="text-gray-600">Notes (exactly what was found or changed)</span><textarea value={pre.note} onChange={(e) => setPre({ ...pre, note: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <div className="mt-1 grid gap-1">
                {([["ok", "Files are good, make the proof"], ["fixed", "We fixed it ourselves, tell the CSR what we changed"], ["new_art", "Need new files from the customer (back to Waiting on art)"]] as const).map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="pfres" checked={pre.result === v} onChange={() => setPre({ ...pre, result: v })} />{l}</label>)}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setPre(null)}>Cancel</Button><Button disabled={pre.busy || (pre.result !== "ok" && !pre.issues.length && !pre.note.trim())} onClick={async () => { setPre({ ...pre, busy: true }); const d = await post({ action: "preflight", jobId: pre.c.id, issues: pre.issues, note: pre.note, result: pre.result }); if (d) { flash(true, `${pre.c.jobNumber}: ${pre.result === "new_art" ? "back in Waiting on art" : "on to Make PDF proof"}${d.told ? `. Report sent to ${d.told}.` : "."}`); setPre(null); } else setPre({ ...pre, busy: false }); }}>{pre.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></div>
          </div>
        </div>
      )}

      {fileDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setFileDlg(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{fileDlg.action === "art_in" ? "Art is in" : fileDlg.action === "new_file" ? "New file in" : fileDlg.action === "imposed" ? "Imposition" : "Hard proof printed"} · {fileDlg.c.jobNumber}</h2><button onClick={() => setFileDlg(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <div className="mt-3 grid gap-2 text-sm">
              {fileDlg.action === "imposed" && <div className="flex gap-3">{(["XMF", "Konica"] as const).map((t) => <label key={t} className="flex items-center gap-1"><input type="radio" checked={fileDlg.target === t} onChange={() => setFileDlg({ ...fileDlg, target: t })} />{t === "XMF" ? "Moved into XMF" : "Sent to the Konica (digital)"}</label>)}</div>}
              <label className="block"><span className="text-gray-600">Where the file is <span className="text-gray-400">(network path or ShareFile link, optional)</span></span><Input value={fileDlg.location} onChange={(e) => setFileDlg({ ...fileDlg, location: e.target.value })} placeholder="e.g. \\server\jobs\263207\v2  or  https://cndprinting.sharefile.com/..." /></label>
              {fileDlg.action === "hard" && <label className="block"><span className="text-gray-600">Photo or scan <span className="text-gray-400">(optional; needed only to email it)</span></span><input type="file" accept="application/pdf,image/*" onChange={(e) => setFileDlg({ ...fileDlg, file: e.target.files?.[0] || null })} className="mt-1 block w-full text-xs" /></label>}
              <label className="block"><span className="text-gray-600">Note (optional)</span><Input value={fileDlg.note} onChange={(e) => setFileDlg({ ...fileDlg, note: e.target.value })} placeholder={fileDlg.action === "hard" ? "e.g. ImpoProof mockup + G7 color proof" : fileDlg.action === "art_in" ? "e.g. came in through macfiles" : ""} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setFileDlg(null)}>Cancel</Button><Button disabled={fileDlg.busy} onClick={saveFileDlg}>{fileDlg.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></div>
          </div>
        </div>
      )}

      {hist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setHist(null)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">History · {hist.jobNumber}, {hist.name}</h2><button onClick={() => setHist(null)}><X className="h-4 w-4 text-gray-400" /></button></div>
            <p className="mt-1 text-xs text-gray-500">{hist.customer}. Dates fill in from the board; log new files and imposition here.</p>
            {(() => {
              const cols = Math.max(4, ...GRID_ROWS.map((r) => hist.events.filter((e) => e.t === r.t).length));
              return (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead><tr><th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left">Event</th>{Array.from({ length: cols }, (_, i) => <th key={i} className="border border-gray-200 bg-gray-50 px-2 py-1">{i + 1}</th>)}</tr></thead>
                    <tbody>{GRID_ROWS.map((r) => { const evs = hist.events.filter((e) => e.t === r.t); return (
                      <tr key={r.t}><td className="whitespace-nowrap border border-gray-200 px-2 py-1 font-medium">{r.label}</td>{Array.from({ length: cols }, (_, i) => { const e = evs[i]; return <td key={i} title={e ? [e.by, e.target, e.loc, e.note].filter(Boolean).join(" · ") : ""} className="border border-gray-200 px-2 py-1 text-center">{e ? <><div>{md(e.at)}</div><div className="text-[10px] text-gray-400">{e.target || e.by.split(" ")[0]}</div></> : <span className="text-gray-200">__/__</span>}</td>; })}</tr>
                    ); })}</tbody>
                  </table>
                </div>
              );
            })()}
            {me.canMake && <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openFile(hist, "new_file")}>Log new file</Button>
              <Button size="sm" variant="outline" onClick={() => openFile(hist, "imposed", "XMF")}>Moved into XMF</Button>
              <Button size="sm" variant="outline" onClick={() => openFile(hist, "imposed", "Konica")}>Sent to Konica</Button>
            </div>}
            <div className="mt-4 text-sm font-medium text-gray-800">Every entry</div>
            <div className="mt-1 divide-y divide-gray-100 text-xs">
              {[...hist.events].reverse().map((e, i) => (
                <div key={i} className="flex flex-wrap gap-x-2 py-1.5">
                  <span className="w-24 shrink-0 text-gray-500">{new Date(e.at).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</span>
                  <span className="font-medium">{e.t === "preflight" ? "Preflight" : GRID_ROWS.find((r) => r.t === e.t)?.label || e.t}{e.t !== "preflight" && ` ${e.round}`}{e.target && ` (${e.target})`}</span>
                  <span className="text-gray-500">{e.by}</span>
                  {e.note && <span className="text-gray-600">{e.note}</span>}
                  {e.loc && (isLink(e.loc) ? <a href={e.loc} target="_blank" rel="noreferrer" className="break-all text-brand-600 hover:underline">{e.loc}</a> : <span className="break-all font-mono text-gray-700">{e.loc}</span>)}
                </div>
              ))}
              {!hist.events.length && <div className="py-2 text-gray-400">Nothing logged yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
