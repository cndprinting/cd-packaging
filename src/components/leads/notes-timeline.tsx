"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Bot, Pencil, Check, X } from "lucide-react";

// Lead notes timeline (Shimmie 8/6). One entry per note with an author and a
// timestamp, newest first — so two reps sharing a lead can see what was
// actually said, instead of overwriting each other in one shared box.

type Note = {
  id: string; body: string; kind: string; source: string | null;
  authorId: string | null; authorName: string; mentions: string | null;
  editedAt: string | null; createdAt: string; canEdit: boolean;
};
type Person = { id: string; name: string; first: string };

const when = (s: string) => {
  const d = new Date(s);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};

// Render @Name as a chip. Matched against the real roster so "@ 9am" or an
// email address never lights up.
function renderBody(body: string, people: Person[]) {
  if (!people.length) return body;
  const tokens = people.flatMap((p) => [p.name, p.first]).filter(Boolean).sort((a, b) => b.length - a.length);
  const re = new RegExp(`@(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w@.])`, "gi");
  const out: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(<span key={i++} className="rounded bg-brand-50 px-1 font-medium text-brand-700">@{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export function NotesTimeline({ leadId, onPosted }: { leadId: string; onPosted?: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  // @-autocomplete state
  const [menu, setMenu] = useState<{ at: number; query: string } | null>(null);
  const [pick, setPick] = useState(0);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    fetch(`/api/leads/notes?leadId=${leadId}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);
  useEffect(load, [load]);

  useEffect(() => {
    fetch("/api/users?pipeline=1")
      .then((r) => r.json())
      .then((d) => setPeople((d.users || []).map((u: any) => ({ id: u.id, name: u.name, first: (u.name || "").trim().split(/\s+/)[0] }))))
      .catch(() => {});
  }, []);

  // Watch the caret for "@…" and offer the roster.
  const onDraft = (v: string, caret: number) => {
    setDraft(v);
    const upto = v.slice(0, caret);
    const m = upto.match(/(^|[^\w@])@([\w]*)$/);
    if (m) { setMenu({ at: caret - m[2].length - 1, query: m[2] }); setPick(0); }
    else setMenu(null);
  };
  const matches = menu
    ? people.filter((p) => !menu.query || p.name.toLowerCase().includes(menu.query.toLowerCase())).slice(0, 6)
    : [];

  const choose = (p: Person) => {
    if (!menu) return;
    const before = draft.slice(0, menu.at);
    const after = draft.slice(menu.at + 1 + menu.query.length);
    const next = `${before}@${p.first} ${after.replace(/^\s+/, "")}`;
    setDraft(next);
    setMenu(null);
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + p.first.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };

  const post = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/leads/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, body: text }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not save that note."); return; }
      setDraft("");
      setFlash(d.notified?.length ? `Saved — pinged ${d.notified.join(", ")}` : "Saved");
      setTimeout(() => setFlash(""), 2500);
      load();
      onPosted?.();
    } catch {
      setErr("Could not save that note — check your connection and try again.");
    } finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    const res = await fetch("/api/leads/notes", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body: editText }),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error || "Could not edit that note."); return; }
    setEditing(null); load();
  };

  return (
    <div>
      <div className="relative">
        <textarea
          ref={boxRef}
          rows={2}
          value={draft}
          placeholder="Add a note… type @ to tag someone"
          onChange={(e) => onDraft(e.target.value, e.target.selectionStart || 0)}
          onKeyDown={(e) => {
            if (menu && matches.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setPick((p) => (p + 1) % matches.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setPick((p) => (p - 1 + matches.length) % matches.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(matches[pick]); return; }
              if (e.key === "Escape") { setMenu(null); return; }
            }
            // Ctrl/Cmd+Enter posts — the rep is on the phone, not reaching for a mouse.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); }
          }}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {menu && matches.length > 0 && (
          <ul className="absolute z-20 mt-0.5 w-56 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            {matches.map((p, i) => (
              <li key={p.id}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                  className={`block w-full px-2.5 py-1.5 text-left text-xs ${i === pick ? "bg-brand-50 text-brand-800" : "text-gray-700 hover:bg-gray-50"}`}>
                  @{p.first} <span className="text-gray-400">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={post} disabled={busy || !draft.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}Save note
        </button>
        <span className="text-[11px] text-gray-400">Saved notes lock after 15 minutes.</span>
        {flash && <span className="text-[11px] text-green-600">{flash}</span>}
        {err && <span className="text-[11px] text-red-600">{err}</span>}
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="text-xs text-gray-400">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-gray-400">No notes yet.</p>
        ) : notes.map((n) => (
          <div key={n.id} className={`rounded-md border px-2.5 py-2 ${n.kind === "system" ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}>
            <div className="mb-1 flex items-center gap-2 text-[11px]">
              {n.kind === "system"
                ? <span className="inline-flex items-center gap-1 text-gray-500"><Bot className="h-3 w-3" />{n.authorName}</span>
                : <span className="font-medium text-gray-700">{n.authorName}</span>}
              <span className="text-gray-400">{when(n.createdAt)}</span>
              {n.editedAt && <span className="text-gray-300">· edited</span>}
              {n.canEdit && editing !== n.id && (
                <button type="button" onClick={() => { setEditing(n.id); setEditText(n.body); }} title="Edit (available for 15 minutes)"
                  className="ml-auto text-gray-300 hover:text-gray-700"><Pencil className="h-3 w-3" /></button>
              )}
            </div>
            {editing === n.id ? (
              <div>
                <textarea rows={2} value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none" />
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => saveEdit(n.id)} className="inline-flex items-center gap-1 text-[11px] text-green-700 hover:underline"><Check className="h-3 w-3" />Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:underline"><X className="h-3 w-3" />Cancel</button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">{renderBody(n.body, people)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
