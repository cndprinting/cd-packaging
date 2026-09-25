"use client";

import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// Lead contacts (Shimmie 9/23): up to three people per lead. Each has a
// confirmed primary email + phone; the candidate "dump" (numbers or emails
// collected while hunting) sits behind a click and disappears once a primary
// is confirmed. Confirm = a voicemail, a conversation or a text came back.
export interface LeadContact {
  id: string; name: string; title: string | null; email: string | null; phone: string | null;
  emailCandidates: string | null; phoneCandidates: string | null; sort: number;
  phoneConfirmedAt?: string | null; phoneConfirmedBy?: string | null;
}
const MAX = 3;
const split = (s: string | null) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export function LeadContacts({ leadId, contacts, onChange }: { leadId: string; contacts: LeadContact[]; onChange: (c: LeadContact[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (method: "POST" | "PUT" | "DELETE", body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/leads/contacts", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Could not save"); return false; }
      onChange(d.contacts || []);
      return true;
    } catch { setErr("Could not reach the server"); return false; }
    finally { setBusy(false); }
  };

  return (
    <div className="sm:col-span-3 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Contacts <span className="font-normal text-gray-400">({contacts.length} of {MAX})</span>{busy && <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-gray-400" />}</span>
        {contacts.length < MAX && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" />Add contact</button>
        )}
      </div>
      {err && <div className="mb-2 text-xs text-red-600">{err}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        {contacts.map((c) => <ContactCard key={c.id} c={c} onSave={(patch) => call("PUT", { id: c.id, ...patch })} onRemove={() => { if (confirm(`Remove ${c.name} from this lead?`)) call("DELETE", { id: c.id }); }} />)}
        {adding && <NewContact onCancel={() => setAdding(false)} onCreate={async (v) => { const ok = await call("POST", { leadId, ...v }); if (ok) setAdding(false); }} />}
        {contacts.length === 0 && !adding && <div className="text-xs text-gray-400 md:col-span-3">No contacts yet. Add the person you're working, plus the number dump while you hunt for a line that answers.</div>}
      </div>
    </div>
  );
}

function ContactCard({ c, onSave, onRemove }: { c: LeadContact; onSave: (p: Record<string, unknown>) => Promise<boolean>; onRemove: () => void }) {
  const [name, setName] = useState(c.name); const [title, setTitle] = useState(c.title || "");
  const [emailDraft, setEmailDraft] = useState(""); const [phoneDraft, setPhoneDraft] = useState("");
  const [showPhones, setShowPhones] = useState(!c.phone); const [showEmails, setShowEmails] = useState(false);
  const [phoneDump, setPhoneDump] = useState(split(c.phoneCandidates).join("\n"));
  const [emailDump, setEmailDump] = useState(split(c.emailCandidates).join("\n"));
  const [editPhone, setEditPhone] = useState(false); const [editEmail, setEditEmail] = useState(false);
  const phones = split(c.phoneCandidates), emails = split(c.emailCandidates);
  const lbl = "block text-[11px] font-medium text-gray-500 mb-0.5";

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <Input className="h-7 text-xs font-medium" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== c.name && onSave({ name })} placeholder="Name" />
          <Input className="h-7 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== (c.title || "") && onSave({ title })} placeholder="Title (e.g. Purchasing Manager)" />
        </div>
        <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-600" title="Remove contact"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Email: confirmed primary, else type one or pick from the candidates */}
      <div className="mb-2">
        <span className={lbl}>Email</span>
        {c.email && !editEmail ? (
          <div className="flex items-center gap-2">
            <a href={`mailto:${c.email}`} className="truncate text-brand-700 hover:underline">{c.email}</a>
            <button type="button" onClick={() => { setEmailDraft(c.email || ""); setEditEmail(true); }} className="text-[11px] text-gray-400 hover:text-gray-700">change</button>
            {emails.length > 0 && <button type="button" onClick={() => setShowEmails((v) => !v)} className="text-[11px] text-gray-400 hover:text-gray-700">{emails.length} other{emails.length > 1 ? "s" : ""}</button>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input className="h-7 text-xs" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="confirmed email"
              onKeyDown={(e) => { if (e.key === "Enter") { onSave({ email: emailDraft }); setEditEmail(false); } }} />
            <button type="button" onClick={() => { onSave({ email: emailDraft }); setEditEmail(false); }} className="rounded border border-green-600 px-1.5 py-1 text-green-700 hover:bg-green-50" title="Confirm as primary"><Check className="h-3.5 w-3.5" /></button>
            {emails.length > 0 && <button type="button" onClick={() => setShowEmails((v) => !v)} className="whitespace-nowrap text-[11px] text-gray-500 hover:text-gray-800">{emails.length} candidate{emails.length > 1 ? "s" : ""} {showEmails ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}</button>}
            {!emails.length && !c.email && <button type="button" onClick={() => setShowEmails((v) => !v)} className="whitespace-nowrap text-[11px] text-gray-400 hover:text-gray-700">dump</button>}
          </div>
        )}
        {showEmails && (
          <div className="mt-1.5 rounded border border-gray-200 bg-white p-2">
            {emails.map((e) => (
              <div key={e} className="flex items-center justify-between gap-2 py-0.5">
                <span className="truncate">{e}</span>
                <button type="button" onClick={() => { onSave({ email: e }); setEditEmail(false); setShowEmails(false); }} className="whitespace-nowrap text-[11px] text-green-700 hover:underline">use as primary</button>
              </div>
            ))}
            <textarea rows={2} className="mt-1 w-full rounded border border-gray-300 px-1.5 py-1 text-[11px]" placeholder="possible emails, one per line" value={emailDump} onChange={(e) => setEmailDump(e.target.value)} onBlur={() => emailDump !== split(c.emailCandidates).join("\n") && onSave({ emailCandidates: emailDump })} />
          </div>
        )}
      </div>

      {/* Phone: confirmed primary hides the dump; otherwise the dump is where you work from */}
      <div>
        <span className={lbl}>Primary phone</span>
        {c.phone && !editPhone ? (
          <div className="flex items-center gap-2">
            <a href={`tel:${c.phone}`} className="font-medium text-gray-900 hover:underline">{c.phone}</a>
            <span className="rounded-full bg-green-100 px-1.5 text-[10px] text-green-800" title={c.phoneConfirmedAt ? `Confirmed by ${c.phoneConfirmedBy || "a rep"} on ${new Date(c.phoneConfirmedAt).toLocaleDateString("en-US")}` : undefined}>
              confirmed{c.phoneConfirmedBy ? ` · ${c.phoneConfirmedBy.split(/\s+/)[0]}` : ""}{c.phoneConfirmedAt ? ` ${new Date(c.phoneConfirmedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}` : ""}
            </span>
            <button type="button" onClick={() => { setPhoneDraft(c.phone || ""); setEditPhone(true); }} className="text-[11px] text-gray-400 hover:text-gray-700">change</button>
            {phones.length > 0 && <button type="button" onClick={() => setShowPhones((v) => !v)} className="text-[11px] text-gray-400 hover:text-gray-700">{phones.length} other{phones.length > 1 ? "s" : ""}</button>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input className="h-7 text-xs" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} placeholder="number that answers"
              onKeyDown={(e) => { if (e.key === "Enter") { onSave({ phone: phoneDraft }); setEditPhone(false); setShowPhones(!phoneDraft.trim()); } }} />
            <button type="button" onClick={() => { onSave({ phone: phoneDraft }); setEditPhone(false); setShowPhones(!phoneDraft.trim()); }} className="rounded border border-green-600 px-1.5 py-1 text-green-700 hover:bg-green-50" title="Confirm as primary (voicemail, conversation or text came back)"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setShowPhones((v) => !v)} className="whitespace-nowrap text-[11px] text-gray-500 hover:text-gray-800">dump ({phones.length}) {showPhones ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}</button>
          </div>
        )}
        {showPhones && (
          <div className="mt-1.5 rounded border border-gray-200 bg-white p-2">
            {phones.map((p) => (
              <div key={p} className="flex items-center justify-between gap-2 py-0.5">
                <a href={`tel:${p.replace(/[^\d+]/g, "")}`} className="truncate hover:underline">{p}</a>
                <button type="button" onClick={() => { onSave({ phone: p }); setEditPhone(false); setShowPhones(false); }} className="whitespace-nowrap text-[11px] text-green-700 hover:underline">confirm as primary</button>
              </div>
            ))}
            <textarea rows={3} className="mt-1 w-full rounded border border-gray-300 px-1.5 py-1 text-[11px]" placeholder={"number dump, one per line\n305-555-0100 (cell)\n727-555-0199 (office)"} value={phoneDump} onChange={(e) => setPhoneDump(e.target.value)} onBlur={() => phoneDump !== split(c.phoneCandidates).join("\n") && onSave({ phoneCandidates: phoneDump })} />
          </div>
        )}
      </div>
    </div>
  );
}

function NewContact({ onCancel, onCreate }: { onCancel: () => void; onCreate: (v: Record<string, string>) => Promise<void> }) {
  const [v, setV] = useState({ name: "", title: "", email: "", phone: "", phoneCandidates: "", emailCandidates: "" });
  const [saving, setSaving] = useState(false);
  const u = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const lbl = "block text-[11px] font-medium text-gray-500 mb-0.5";
  return (
    <div className="rounded-md border border-brand-300 bg-brand-50/40 p-2.5 text-xs space-y-1.5">
      <Input className="h-7 text-xs font-medium" value={v.name} onChange={u("name")} placeholder="Name *" autoFocus />
      <Input className="h-7 text-xs" value={v.title} onChange={u("title")} placeholder="Title" />
      <div><span className={lbl}>Email (confirmed)</span><Input className="h-7 text-xs" value={v.email} onChange={u("email")} placeholder="leave blank if not confirmed" /></div>
      <div><span className={lbl}>Primary phone (confirmed)</span><Input className="h-7 text-xs" value={v.phone} onChange={u("phone")} placeholder="leave blank while hunting" /></div>
      <div><span className={lbl}>Number dump</span><textarea rows={2} className="w-full rounded border border-gray-300 px-1.5 py-1 text-[11px]" placeholder={"one per line: 305-555-0100 (cell)"} value={v.phoneCandidates} onChange={u("phoneCandidates")} /></div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="text-gray-500 hover:underline">Cancel</button>
        <button type="button" disabled={!v.name.trim() || saving} onClick={async () => { setSaving(true); await onCreate(v); setSaving(false); }} className="rounded bg-brand-600 px-2.5 py-1 text-white disabled:opacity-50">{saving ? "Saving…" : "Add"}</button>
      </div>
    </div>
  );
}
