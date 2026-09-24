"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";

// Email from inside the lead (Benjy 9/24, HubSpot-style): compose here, it
// goes out from YOUR mailbox, replies come back onto this thread.
interface Em { id: string; direction: "out" | "in"; fromAddr: string; toAddr: string; cc: string | null; subject: string; bodyText: string; userName: string | null; sentAt: string }
interface Tpl { key: string; label: string; subject: string; body: string }
interface Att { id: string; name: string; fileSize: number | null }

const fill = (s: string, v: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? "");
const fmt = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function LeadEmail({ leadId, companyName, product, contacts, onSent }: {
  leadId: string; companyName: string; product: string | null;
  contacts: { name: string; email: string | null }[];
  onSent?: () => void;
}) {
  const [emails, setEmails] = useState<Em[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [me, setMe] = useState<{ name: string; email: string; canSend: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(""); const [cc, setCc] = useState(""); const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [attIds, setAttIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => fetch(`/api/leads/email?leadId=${leadId}`).then((r) => r.json()).then((d) => { setEmails(d.emails || []); setAtts(d.attachments || []); setTemplates(d.templates || []); setMe(d.me || null); }).catch(() => {});
  useEffect(() => { load(); }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const withEmail = contacts.filter((c) => c.email);
  const first = (withEmail[0]?.name || contacts[0]?.name || "").split(/\s+/)[0] || "there";
  const vars = { first, company: companyName, product: product || "your packaging", me: me?.name?.split(/\s+/)[0] || "" };

  const startCompose = () => {
    setOpen(true);
    if (!to && withEmail[0]?.email) setTo(withEmail[0].email!);
    if (!subject) setSubject(`C&D Printing & Packaging — ${companyName}`);
  };
  const applyTemplate = (key: string) => {
    const t = templates.find((x) => x.key === key); if (!t) return;
    setSubject(fill(t.subject, vars)); setBody(fill(t.body, vars));
  };
  const send = async () => {
    if (!confirm(`Send this email to ${to} from ${me?.email}?`)) return;
    setSending(true); setErr(null);
    try {
      const r = await fetch("/api/leads/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, to, cc, subject, bodyText: body, attachmentIds: attIds }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not send"); return; }
      setBody(""); setAttIds([]); setOpen(false); await load(); onSent?.();
    } catch { setErr("Could not reach the server"); }
    finally { setSending(false); }
  };

  return (
    <div className="sm:col-span-3 rounded-md border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500 inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email <span className="font-normal text-gray-400">({emails.length}) — sent from your own mailbox; replies land here</span></span>
        {!open && (me?.canSend
          ? <button type="button" onClick={startCompose} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1 text-xs text-white hover:bg-brand-700"><Send className="h-3.5 w-3.5" />New email</button>
          : <span className="text-[11px] text-gray-400">Your login isn't a C&D mailbox, so you can read this thread but not send.</span>)}
      </div>

      {emails.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {emails.map((e) => {
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className={`rounded-md border px-2.5 py-1.5 text-xs ${e.direction === "in" ? "border-green-200 bg-green-50/60" : "border-gray-200 bg-gray-50"}`}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : e.id)} className="flex w-full items-center justify-between gap-2 text-left">
                  <span className="min-w-0 truncate">
                    <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${e.direction === "in" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{e.direction === "in" ? "Reply" : "Sent"}</span>
                    <span className="font-medium text-gray-800">{e.direction === "in" ? e.fromAddr : `${e.userName || e.fromAddr} → ${e.toAddr}`}</span>
                    <span className="text-gray-500"> · {e.subject}</span>
                  </span>
                  <span className="shrink-0 text-gray-400">{fmt(e.sentAt)} {isOpen ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}</span>
                </button>
                {isOpen && <pre className="mt-1.5 whitespace-pre-wrap font-sans text-xs text-gray-700">{e.bodyText}</pre>}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 rounded-md border border-brand-200 bg-brand-50/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className="mb-0.5 block text-[11px] font-medium text-gray-500">To</label>
              <Input className="h-8 text-xs" value={to} onChange={(e) => setTo(e.target.value)} list={`em-to-${leadId}`} placeholder="name@company.com" />
              <datalist id={`em-to-${leadId}`}>{withEmail.map((c) => <option key={c.email!} value={c.email!}>{c.name}</option>)}</datalist>
            </div>
            <div><label className="mb-0.5 block text-[11px] font-medium text-gray-500">Cc</label><Input className="h-8 text-xs" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" /></div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1"><label className="mb-0.5 block text-[11px] font-medium text-gray-500">Subject</label><Input className="h-8 text-xs" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><label className="mb-0.5 block text-[11px] font-medium text-gray-500">Template</label>
              <select className="h-8 rounded-md border border-gray-300 bg-white px-1.5 text-xs" defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.currentTarget.value = ""; }}>
                <option value="">Start from…</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <textarea rows={9} className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none" value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Hi ${first},`} />
          <div className="text-[11px] text-gray-400">Your C&D signature is added automatically. Sent from {me?.email}; a copy sits in your Outlook Sent folder.</div>
          {atts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-gray-500">Attach:</span>
              {atts.map((a) => (
                <label key={a.id} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5">
                  <input type="checkbox" checked={attIds.includes(a.id)} onChange={(e) => setAttIds((p) => e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id))} />{a.name}
                </label>
              ))}
            </div>
          )}
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="text-xs text-gray-500 hover:underline">Cancel</button>
            <button type="button" onClick={send} disabled={sending || !to || !body.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50">{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{sending ? "Sending…" : "Send"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
