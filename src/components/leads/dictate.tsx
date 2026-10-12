"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

// Dictate a note or reminder (Benjy 10/12): press the mic, talk, press stop.
// The browser's speech engine transcribes live; the transcript then goes to
// /api/leads/dictate, which cleans it into CRM-ready text and hands it back.
// Chrome and Edge support this natively; other browsers get a plain message.
type SR = any;
const getSR = (): (new () => SR) | null => (typeof window === "undefined" ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null));

export function DictateButton({ mode, company, onResult, className = "" }: { mode: "note" | "reminder"; company?: string; onResult: (text: string) => void; className?: string }) {
  const [state, setState] = useState<"idle" | "listening" | "cleaning">("idle");
  const [live, setLive] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const finalRef = useRef("");
  const supported = !!getSR();

  useEffect(() => () => { try { rec.current?.stop(); } catch { /* ignore */ } }, []);

  const start = () => {
    const SRc = getSR(); if (!SRc) return;
    setErr(null); finalRef.current = ""; setLive("");
    const r = new SRc();
    r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += (finalRef.current ? " " : "") + t.trim(); else interim += t;
      }
      setLive((finalRef.current + " " + interim).trim());
    };
    r.onerror = (e: any) => { if (e.error !== "no-speech" && e.error !== "aborted") setErr(e.error === "not-allowed" ? "Microphone blocked. Allow the mic for this site and try again." : `Speech error: ${e.error}`); };
    r.onend = () => { if (rec.current === r) finish(); };
    rec.current = r;
    try { r.start(); setState("listening"); } catch { setErr("Could not start the microphone"); }
  };

  const finish = async () => {
    const r = rec.current; rec.current = null;
    try { r?.stop(); } catch { /* ignore */ }
    const text = finalRef.current.trim() || live.trim();
    if (!text) { setState("idle"); setLive(""); return; }
    setState("cleaning");
    try {
      const res = await fetch("/api/leads/dictate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode, company }) });
      const d = await res.json();
      onResult((d.text || text).trim());
      if (d.warning) setErr(d.warning);
    } catch { onResult(text); setErr("Cleanup failed, raw transcript inserted"); }
    setState("idle"); setLive("");
  };

  if (!supported) return <span className={`text-[11px] text-gray-400 ${className}`} title="Voice dictation needs Chrome or Edge">Dictation needs Chrome or Edge</span>;

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      {state === "idle" && (
        <button type="button" onClick={start} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50" title={mode === "reminder" ? "Dictate the reminder" : "Dictate a note; AI cleans it up"}>
          <Mic className="h-3.5 w-3.5" />{mode === "reminder" ? "Dictate" : "Dictate note"}
        </button>
      )}
      {state === "listening" && (
        <button type="button" onClick={finish} className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100" title="Stop and clean up">
          <Square className="h-3.5 w-3.5" /><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />Listening… stop
        </button>
      )}
      {state === "cleaning" && <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cleaning up…</span>}
      {state === "listening" && live && <span className="max-w-[520px] truncate text-[11px] text-gray-500" title={live}>{live}</span>}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </span>
  );
}
