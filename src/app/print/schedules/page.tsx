"use client";

// Printed machine schedules (Darrin 11/18/26): one sheet per machine, in his
// order. ?m=CODE prints one; no m prints all seven.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type J = { id: string; jobNumber: string; name: string; quantity: number; dueDate: string | null; customer: string; inks: string | null; foils: string | null; dieNumber: string | null; routeStatus: string | null; notes: string | null; priority: string };
type M = { code: string; name: string; kind: string; plateDate?: string; jobs: J[] };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "numeric", day: "numeric" }) : "");

function Sheets() {
  const sp = useSearchParams();
  const [ms, setMs] = useState<M[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const m = sp.get("m"), pd = sp.get("plateDate");
    const q = [m && `m=${encodeURIComponent(m)}`, pd && `plateDate=${encodeURIComponent(pd)}`].filter(Boolean).join("&");
    fetch(`/api/schedule/machines${q ? `?${q}` : ""}`).then(async (r) => { const d = await r.json(); if (!r.ok) setErr(d.error || "Could not load"); else setMs(d.machines || []); }).catch(() => setErr("Could not load"));
  }, [sp]);
  if (err) return <div style={{ padding: 40, fontFamily: "Arial" }}>{err}. Sign in to Godzilla and try again.</div>;
  if (!ms) return <div style={{ padding: 40, fontFamily: "Arial" }}>Loading...</div>;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const th: React.CSSProperties = { borderBottom: "2px solid #111", textAlign: "left", padding: "4px 6px", fontSize: 12 };
  const td: React.CSSProperties = { borderBottom: "1px solid #bbb", padding: "6px", fontSize: 12, verticalAlign: "top" };
  return (
    <div className="wrap">
      <style>{`
        @page { size: letter landscape; margin: 0.4in; }
        body { background: #fff; }
        .wrap { font-family: Arial, Helvetica, sans-serif; color: #111; max-width: 10in; margin: 0 auto; padding: 20px 0; }
        .sheet { page-break-after: always; margin-bottom: 40px; }
        .sheet:last-child { page-break-after: auto; }
        .noprint { margin-bottom: 16px; }
        .noprint button { background: #15803d; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
        @media print { .noprint { display: none; } .wrap { padding: 0; } .sheet { margin-bottom: 0; } }
      `}</style>
      <div className="noprint"><button onClick={() => window.print()}>Print</button></div>
      {ms.map((m) => (
        <div key={m.code} className="sheet">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px solid #111", paddingBottom: 4, marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{m.name}{m.kind === "plating" && m.plateDate ? <span style={{ fontSize: 15, fontWeight: 400 }}> · printing {new Date(`${m.plateDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span> : null}</div>
            <div style={{ fontSize: 13 }}>{today} · C&amp;D Printing &amp; Packaging</div>
          </div>
          {m.jobs.length === 0 ? <div style={{ padding: "20px 0", fontSize: 14 }}>Nothing scheduled.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={{ ...th, width: 24 }}>#</th><th style={th}>Job #</th><th style={th}>Customer</th><th style={th}>Job</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={th}>Due</th><th style={th}>Ink</th><th style={th}>Foil</th><th style={th}>Die</th><th style={th}>Notes</th><th style={{ ...th, width: 50 }}>Done</th>
              </tr></thead>
              <tbody>{m.jobs.map((j, i) => (
                <tr key={j.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{j.jobNumber}{j.priority === "URGENT" || j.priority === "HIGH" ? " !" : ""}</td>
                  <td style={td}>{j.customer}</td>
                  <td style={td}>{j.name}</td>
                  <td style={{ ...td, textAlign: "right" }}>{(j.quantity || 0).toLocaleString()}</td>
                  <td style={td}>{day(j.dueDate)}</td>
                  <td style={td}>{j.inks || ""}</td>
                  <td style={td}>{j.foils || ""}</td>
                  <td style={td}>{j.dieNumber || ""}</td>
                  <td style={{ ...td, maxWidth: 220 }}>{(j.notes || "").slice(0, 160)}</td>
                  <td style={td}>&#9744;</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PrintSchedules() {
  return <Suspense fallback={null}><Sheets /></Suspense>;
}
