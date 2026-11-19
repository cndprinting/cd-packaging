"use client";

// Packing slip (Shayla 11/18/26). Prints from Godzilla instead of FileMaker, in
// C&D's own layout: job #, customer PO, company, contact, job title, quantity /
// description / boxes, special shipping instructions, and the received-by line.
// Partial deliveries say so, with what's left; the last one says BALANCE.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Data = {
  shipment: any; company: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null } | null;
  job: { jobNumber: string; name: string; customerPO: string | null; contactName: string | null; quantity: number } | null;
  label: { kind: string; text: string } | null;
};

export default function PackingSlip() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/shipments/${id}`).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error || "Could not load"); else setD(j); }).catch(() => setErr("Could not load"));
  }, [id]);
  if (err) return <div style={{ padding: 40, fontFamily: "Arial" }}>{err}. Sign in to Godzilla and try again.</div>;
  if (!d) return <div style={{ padding: 40, fontFamily: "Arial" }}>Loading...</div>;
  const s = d.shipment;
  const date = new Date(s.shipDate || s.targetShipDate || Date.now()).toLocaleDateString("en-US", { timeZone: s.shipDate || s.targetShipDate ? "UTC" : undefined });
  const items: { quantity: number; description: string; boxes: string | null }[] = s.items?.length ? s.items : [{ quantity: d.job?.quantity || 0, description: d.job?.name || "", boxes: null }];
  const rows = [...items, ...Array(Math.max(0, 4 - items.length)).fill(null)];
  const cityLine = d.company ? [d.company.city, [d.company.state, d.company.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const cell: React.CSSProperties = { border: "1.5px solid #222", padding: "4px 8px", height: 26, fontSize: 14 };
  return (
    <div className="slip">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        body { background: #fff; }
        .slip { font-family: Arial, Helvetica, sans-serif; color: #111; max-width: 7.5in; margin: 0 auto; padding: 24px 0; }
        .noprint { margin-bottom: 16px; display: flex; gap: 8px; }
        .noprint button { background: #15803d; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
        @media print { .noprint { display: none; } .slip { padding: 0; } }
      `}</style>
      <div className="noprint"><button onClick={() => window.print()}>Print</button><span style={{ alignSelf: "center", fontSize: 12, color: "#666" }}>{s.shipmentNumber}</span></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cd-logo.png" alt="C&D Printing and Packaging" style={{ width: 170 }} />
        <div style={{ textAlign: "right", fontSize: 16 }}>
          <div><b>Date:</b> {date}</div>
          <div style={{ marginTop: 8 }}><b>Job No.</b> <span style={{ border: "1.5px solid #222", padding: "2px 10px", display: "inline-block", minWidth: 110 }}>{s.jobNumber || d.job?.jobNumber || ""}</span></div>
        </div>
      </div>
      <div style={{ borderTop: "3px solid #111", margin: "10px 0 6px" }} />
      <h1 style={{ textAlign: "center", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 40, margin: "4px 0 10px", letterSpacing: 1 }}>PACKING SLIP</h1>
      {s.kind && s.kind !== "job" && <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, margin: "0 0 10px" }}>{s.kind === "proof" ? "HARD PROOF" : s.kind === "prototype" ? "PROTOTYPE" : "SAMPLES"}</div>}
      {d.label && <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, border: "2px solid #111", padding: "6px", margin: "0 0 12px" }}>{d.label.text}</div>}

      <div style={{ fontSize: 16, marginBottom: 12 }}><b>Customer P.O.</b> <span style={{ border: "1.5px solid #222", padding: "2px 10px", display: "inline-block", minWidth: 220 }}>{s.poNumber || d.job?.customerPO || ""}</span></div>
      <table style={{ width: "100%", fontSize: 14, marginBottom: 12 }}><tbody>
        <tr>
          <td style={{ width: "55%", verticalAlign: "top" }}>
            <div><b>Company</b> {d.company?.name || s.customerName || ""}</div>
            <div><b>Address</b> {d.company?.address || ""}</div>
            <div><b>City</b> {cityLine}</div>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <div><b>Contact</b> {s.contactName || d.job?.contactName || ""}</div>
            <div><b>Phone</b> {d.company?.phone || ""}</div>
          </td>
        </tr>
      </tbody></table>
      <div style={{ fontSize: 18, marginBottom: 10 }}><b>Job Title</b> {(d.job?.name || "").toUpperCase()}</div>

      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "6px 0" }}>
        <thead><tr>
          <th style={{ fontFamily: "Georgia, serif", fontSize: 18, width: "16%" }}>QTY</th>
          <th style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>Description</th>
          <th style={{ fontFamily: "Georgia, serif", fontSize: 18, width: "32%" }}>Boxes / Packages</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td style={cell}>{r ? (r.quantity || 0).toLocaleString() : ""}</td>
            <td style={{ ...cell, textTransform: "uppercase", textAlign: "center" }}>{r?.description || ""}</td>
            <td style={cell}>{r?.boxes || ""}</td>
          </tr>
        ))}</tbody>
      </table>

      <h2 style={{ textAlign: "center", fontFamily: "Georgia, serif", fontSize: 20, margin: "18px 0 6px" }}>Special Shipping Instructions</h2>
      <div style={{ border: "1.5px solid #222", minHeight: 160, padding: 8, fontSize: 14, whiteSpace: "pre-wrap" }}>
        {[s.notes, s.shipTo ? `Ship to:\n${s.shipTo}` : null].filter(Boolean).join("\n\n")}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 28, fontSize: 15, fontWeight: 700 }}>
        <div style={{ flex: 1 }}>Product Received In Good Order: <span style={{ display: "inline-block", borderBottom: "1px solid #111", width: 170 }}>&nbsp;</span></div>
        <div>Print Name: <span style={{ display: "inline-block", borderBottom: "1px solid #111", width: 170 }}>&nbsp;</span></div>
      </div>
      <div style={{ textAlign: "center", marginTop: 36, fontSize: 12, color: "#444" }}>12150 28th Street North &bull; St. Petersburg, FL 33716 &bull; cndprinting.com<br />(727) 572-9999 &bull; Fax (727) 573-5839</div>
    </div>
  );
}
