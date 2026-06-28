"use client";

// Public, token-gated action page (Benjy 6/26). Mary and the owners reach this
// from the agent's email links (?id=&token=&do=). No login — the token is the
// credential. Handles: quote submission (Mary), approval (owners).

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Inner() {
  const params = useSearchParams();
  const id = params.get("id");
  const token = params.get("token");
  const doAction = params.get("do") || "quote";

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [quote, setQuote] = useState("");
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!id || !token) { setErr("This link is missing its credentials."); setLoading(false); return; }
    fetch(`/api/agent?id=${id}&token=${token}`)
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error)))
      .then((d) => { setLead(d.lead); if (d.lead?.agentDraft) setReplyText(String(d.lead.agentDraft).replace(/<[^>]+>/g, "").trim()); })
      .catch((e) => setErr(typeof e === "string" ? e : "This link is no longer valid."))
      .finally(() => setLoading(false));
  }, [id, token]);

  const post = async (action: string, extra: any = {}) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, token, action, ...extra }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Something went wrong."); return; }
      setDone(d.message || "Done.");
    } catch { setErr("Something went wrong."); }
    finally { setBusy(false); }
  };

  const card: React.CSSProperties = { maxWidth: 620, margin: "40px auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, fontFamily: "Arial, Helvetica, sans-serif", color: "#1a1a1a" };
  const ta: React.CSSProperties = { width: "100%", minHeight: 120, padding: 10, border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" };
  const button: React.CSSProperties = { background: "#27AAE1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: "bold", cursor: "pointer", fontSize: 14 };
  const pre: React.CSSProperties = { whiteSpace: "pre-wrap", background: "#f7f7f7", borderRadius: 8, padding: 12, fontFamily: "inherit", fontSize: 13 };

  if (loading) return <div style={card}>Loading…</div>;
  if (err && !lead) return <div style={card}><h2>Link not valid</h2><p style={{ color: "#888" }}>{err}</p></div>;
  if (done) return <div style={card}><h2>✓ Thanks</h2><p>{done}</p></div>;

  return (
    <div style={card}>
      <div style={{ borderBottom: "2px solid #ED1C24", paddingBottom: 10, marginBottom: 16 }}>
        <strong style={{ fontSize: 18 }}>{lead.companyName}</strong>
        <div style={{ color: "#666", fontSize: 13 }}>{[lead.contactName, lead.contactEmail, lead.contactPhone].filter(Boolean).join(" · ")}</div>
      </div>

      {doAction === "reply" ? (
        <>
          <p style={{ fontWeight: "bold" }}>The customer replied. Review the agent's draft and send:</p>
          <div style={pre}>{lead.commentary}</div>
          <p style={{ fontWeight: "bold", marginTop: 16 }}>Reply to {lead.contactName || lead.companyName} ({lead.contactEmail || "no email"}):</p>
          <textarea style={ta} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Your reply to the customer…" />
          {err && <p style={{ color: "#c00", fontSize: 13 }}>{err}</p>}
          <button style={button} disabled={busy || !replyText.trim()} onClick={() => post("approve_reply", { reply: `<p>${replyText.replace(/\n/g, "<br>")}</p>` })}>{busy ? "Sending…" : "Send reply to customer"}</button>
        </>
      ) : doAction === "approve" ? (
        <>
          <p style={{ fontWeight: "bold" }}>Quote to send the customer:</p>
          <div style={pre}>{lead.agentQuote || "(no quote on file)"}</div>
          <p style={{ fontSize: 13, color: "#666" }}>Sends to {lead.contactEmail || "(no email on file)"} and CCs the team.</p>
          {err && <p style={{ color: "#c00", fontSize: 13 }}>{err}</p>}
          <button style={button} disabled={busy} onClick={() => post("approve_send")}>{busy ? "Sending…" : "Approve & send to customer"}</button>
        </>
      ) : (
        <>
          <p style={{ fontWeight: "bold" }}>Lead details:</p>
          <div style={pre}>{lead.commentary}</div>
          {!missing ? (
            <>
              <p style={{ fontWeight: "bold", marginTop: 16 }}>Your quote (price + terms):</p>
              <textarea style={ta} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder={"e.g. 5,000 @ $0.42 ea · $2,100 · 50% deposit, balance on delivery · ~2 weeks"} />
              {err && <p style={{ color: "#c00", fontSize: 13 }}>{err}</p>}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <button style={button} disabled={busy || !quote.trim()} onClick={() => post("submit_quote", { quote })}>{busy ? "Sending…" : "Send quote"}</button>
                <button style={{ background: "none", border: "none", color: "#888", textDecoration: "underline", cursor: "pointer" }} onClick={() => setMissing(true)}>Something's missing</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontWeight: "bold", marginTop: 16 }}>What's missing?</p>
              <textarea style={ta} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Need the finished size and quantity before I can quote." />
              {err && <p style={{ color: "#c00", fontSize: 13 }}>{err}</p>}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <button style={button} disabled={busy} onClick={() => post("mark_missing", { note })}>{busy ? "Sending…" : "Flag missing info"}</button>
                <button style={{ background: "none", border: "none", color: "#888", textDecoration: "underline", cursor: "pointer" }} onClick={() => setMissing(false)}>Back</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function AgentActionPage() {
  return <Suspense fallback={<div style={{ textAlign: "center", marginTop: 60, color: "#888" }}>Loading…</div>}><Inner /></Suspense>;
}
