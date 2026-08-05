"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Trash2, Upload, ExternalLink, Loader2 } from "lucide-react";

// Shared attachment panel (Benjy 8/5). Drop it on a lead, a quote request, a
// quote or a job ticket — it reads every scope id you hand it and shows the
// union, which is how artwork uploaded on a lead is already sitting there when
// pre-press opens the job.

export type AttachmentScope = {
  leadId?: string;
  companyId?: string;
  quoteRequestId?: string;
  quoteId?: string;
  jobId?: string;
};

export type Attachment = {
  id: string; kind: string; name: string; url: string;
  fileSize: number | null; notes: string | null;
  uploadedByName: string | null; createdAt: string;
} & AttachmentScope;

const KINDS = [
  { key: "artwork", label: "Artwork" },
  { key: "dieline", label: "Dieline" },
  { key: "spec", label: "Spec / sample sheet" },
  { key: "sample", label: "Physical sample photo" },
  { key: "proof", label: "Proof" },
  { key: "po", label: "PO" },
  { key: "quote", label: "Quote / pricing" },
  { key: "photo", label: "Photo" },
  { key: "other", label: "Other" },
];
const KIND_LABEL = (k: string) => KINDS.find((x) => x.key === k)?.label || k;
// Artwork and dielines are what pre-press and the plant actually chase, so
// they read loudest in the list.
const KIND_CLS: Record<string, string> = {
  artwork: "border-brand-200 bg-brand-50 text-brand-700",
  dieline: "border-purple-200 bg-purple-50 text-purple-700",
  proof: "border-green-200 bg-green-50 text-green-700",
};

const fmtSize = (n: number | null) => {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

export function AttachmentPanel({ scope, title = "Files", compact = false }: { scope: AttachmentScope; title?: string; compact?: boolean }) {
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("artwork");
  const [err, setErr] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualName, setManualName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const qs = new URLSearchParams(Object.entries(scope).filter(([, v]) => !!v) as [string, string][]).toString();

  const load = useCallback(() => {
    if (!qs) { setLoading(false); return; }
    fetch(`/api/attachments?${qs}`)
      .then((r) => r.json())
      .then((d) => setRows(d.attachments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [qs]);
  useEffect(load, [load]);

  const save = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/attachments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, kind, ...payload }),
    });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error || "Could not attach that file."); return; }
    setErr(""); load();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        // Blob storage not configured yet — fall back to pasting a link rather
        // than pretending the upload worked.
        setErr(d.message || d.error || "Upload failed.");
        setUrlMode(true);
      } else {
        await save({ url: d.url, name: d.fileName || file.name, fileSize: d.size ?? file.size });
      }
    } catch {
      setErr("Upload failed — paste a OneDrive/Dropbox link instead.");
      setUrlMode(true);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addUrl = async () => {
    if (!manualUrl.trim()) return;
    setBusy(true);
    await save({ url: manualUrl.trim(), name: manualName.trim() || manualUrl.trim().split("/").pop() || "Link" });
    setManualUrl(""); setManualName(""); setUrlMode(false); setBusy(false);
  };

  const remove = async (a: Attachment) => {
    if (!confirm(`Remove "${a.name}"? Anyone downstream (estimating, pre-press, plant) will lose it too.`)) return;
    const res = await fetch(`/api/attachments?id=${a.id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "Could not remove that file."); return; }
    load();
  };

  return (
    <div className={compact ? "" : "rounded-lg border border-gray-200 bg-white p-3"}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Paperclip className="h-3.5 w-3.5" />{title}{rows.length > 0 && <span className="text-gray-400">({rows.length})</span>}
        </span>
        <select value={kind} onChange={(e) => setKind(e.target.value)} title="What kind of file is this?"
          className="h-7 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none">
          {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : "Upload file"}
        </button>
        <button type="button" onClick={() => setUrlMode((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-800 hover:underline">or paste a link</button>
        <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
      </div>

      {urlMode && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="https://… (OneDrive, Dropbox, WeTransfer)"
            className="h-7 min-w-[16rem] flex-1 rounded-md border border-gray-300 px-2 text-xs focus:border-brand-500 focus:outline-none" />
          <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Label (optional)"
            className="h-7 w-40 rounded-md border border-gray-300 px-2 text-xs focus:border-brand-500 focus:outline-none" />
          <button type="button" onClick={addUrl} disabled={busy || !manualUrl.trim()}
            className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Attach</button>
        </div>
      )}

      {err && <p className="mb-2 text-xs text-amber-700">{err}</p>}

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">No files yet. Anything you attach here follows this account into the quote and the job ticket.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${KIND_CLS[a.kind] || "border-gray-200 bg-white text-gray-600"}`}>{KIND_LABEL(a.kind)}</span>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-xs text-brand-700 hover:underline" title={a.name}>
                {a.name}<ExternalLink className="ml-1 inline h-3 w-3 opacity-60" />
              </a>
              <span className="hidden shrink-0 text-[10px] text-gray-400 sm:inline">
                {fmtSize(a.fileSize)}{a.uploadedByName ? ` · ${a.uploadedByName}` : ""} · {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button type="button" onClick={() => remove(a)} title="Remove" className="shrink-0 text-gray-300 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
