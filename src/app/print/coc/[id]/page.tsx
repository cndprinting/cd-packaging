"use client";

// C.O.C. print page (Shayla 11/19/26), laid out like C&D's paper Certificate of
// Conformance: header + number, job / customer / attn, subject, PO, estimate,
// size, stock, inks, file prep, finishing, packaging, manufacture + expiration,
// quantity lines, quality signature, C&D + customer blocks, prepared / accepted.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const us = (iso?: string) => { if (!iso) return ""; const d = new Date(`${iso}T12:00:00Z`); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { timeZone: "UTC" }); };

export default function CocPrint() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetch(`/api/coc?id=${id}`).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error || "Could not load"); else setC(j.coc); }).catch(() => setErr("Could not load")); }, [id]);
  if (err) return <div style={{ padding: 40, fontFamily: "Arial" }}>{err}. Sign in to Godzilla and try again.</div>;
  if (!c) return <div style={{ padding: 40, fontFamily: "Arial" }}>Loading...</div>;
  const d = c.data || {};
  const lines = [...(d.lines || []), ...Array(Math.max(0, 6 - (d.lines || []).length)).fill(null)];
  const band = (i: number): React.CSSProperties => ({ background: i % 2 ? "#fff" : "#ececec" });
  const lab: React.CSSProperties = { width: 110, textAlign: "right", fontWeight: 700, fontSize: 13, padding: "10px 8px", borderRight: "2px solid #111", verticalAlign: "middle" };
  const val: React.CSSProperties = { fontWeight: 700, fontSize: 16, padding: "10px 12px" };
  const rows: [string, React.ReactNode][] = [
    ["Subject", <span key="s" style={{ fontSize: 11 }}>{d.subject}</span>],
    ["Customer P.O.", <span key="p" style={{ display: "flex", justifyContent: "space-between" }}><span>{d.customerPO}</span><span>Est #: {d.estimate}</span></span>],
    ["Size:", <span key="z" style={{ fontSize: 14 }}>Flat&nbsp;&nbsp;&nbsp;{d.flatW} <b>X</b> {d.flatH}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Finished&nbsp;&nbsp;&nbsp;{d.finishedW} <b>X</b> {d.finishedH}</span>],
    ["STOCK", d.stock],
    ["INKS", <span key="i" style={{ fontSize: 13 }}>{d.inks}</span>],
    ["File Prep", d.filePrep],
    ["FINISHING", <span key="f" style={{ fontWeight: 400, fontSize: 18 }}>{d.finishing}</span>],
    ["PACKAGING", <span key="k" style={{ fontWeight: 400, fontSize: 18 }}>{d.packaging}</span>],
  ];
  return (
    <div className="coc">
      <style>{`
        @page { size: letter; margin: 0.4in; }
        body { background: #fff; }
        .coc { font-family: Arial, Helvetica, sans-serif; color: #111; max-width: 7.7in; margin: 0 auto; padding: 20px 0; }
        .noprint { margin-bottom: 14px; display: flex; gap: 8px; }
        .noprint button { background: #15803d; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
        @media print { .noprint { display: none; } .coc { padding: 0; } }
        table { border-collapse: collapse; width: 100%; }
      `}</style>
      <div className="noprint"><button onClick={() => window.print()}>Print</button><span style={{ alignSelf: "center", fontSize: 12, color: "#666" }}>COC #{c.label}</span></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cd-logo.png" alt="C&D Printing and Packaging" style={{ width: 170 }} />
          <div style={{ fontSize: 12 }}>12150 28th St No. St Petersburg, Fl 33716<br />O: 727-572-9999 F: 727-573-5839</div>
        </div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 60, fontWeight: 700, letterSpacing: 2, marginTop: 6 }}>C.O.C.</div>
        <div style={{ textAlign: "left", minWidth: 170 }}>
          <div style={{ fontSize: 20, marginBottom: 14 }}>{new Date(c.createdAt).toLocaleDateString("en-US")}</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>COC #</div>
          <div style={{ border: "1.5px solid #555", padding: "2px 6px", fontSize: 22 }}>{c.label}</div>
        </div>
      </div>
      <div style={{ borderTop: "4px solid #111", margin: "8px 0 0" }} />

      <table><tbody>
        <tr style={{ background: "#d4d4d4" }}>
          <td style={{ width: 140, padding: "2px 8px", verticalAlign: "top" }}><div style={{ fontSize: 10, fontWeight: 700 }}>C&amp;D JOB#</div><div style={{ background: "#fff", fontWeight: 700, padding: "2px 4px" }}>{d.jobNumber}</div></td>
          <td style={{ padding: "6px 8px" }}><span style={{ fontWeight: 700, fontSize: 12 }}>To:</span> <b style={{ fontSize: 17 }}>{d.to}</b></td>
          <td style={{ padding: "6px 8px", width: 230, background: "#ececec" }}><span style={{ fontWeight: 700, fontSize: 12 }}>Attn:</span> <b style={{ fontSize: 17 }}>{d.attn}</b></td>
        </tr>
      </tbody></table>
      <table><tbody>
        {rows.map(([k, v], i) => <tr key={k} style={band(i)}><td style={lab}>{k}</td><td style={val}>{v}</td></tr>)}
        <tr style={band(rows.length)}><td style={{ ...lab, borderRight: "2px solid #111" }} /><td style={{ ...val, fontSize: 14 }}><span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 13, textAlign: "center" }}>Manufacture<br />Date:</span><span style={{ fontSize: 22 }}>{us(d.mfgDate)}</span></span><span style={{ display: "inline-flex", gap: 10, alignItems: "center", marginLeft: 50 }}><span style={{ fontSize: 13, textAlign: "center" }}>Expiration<br />Date:</span><span style={{ fontSize: 22 }}>{us(d.expDate)}</span></span></td></tr>
      </tbody></table>

      <table style={{ marginTop: 0 }}><tbody>
        <tr style={{ background: "#d4d4d4" }}><td style={{ width: 160, textAlign: "center", fontWeight: 700, fontSize: 17, padding: 2 }}>QTY</td><td style={{ fontWeight: 700, fontSize: 17, padding: 2 }}>Description</td></tr>
        {lines.map((l: any, i: number) => <tr key={i}><td style={{ border: "1px solid #333", textAlign: "center", fontSize: 18, height: 32 }}>{l?.qty ? Number(String(l.qty).replace(/,/g, "")).toLocaleString("en-US") : ""}</td><td style={{ border: "1px solid #333", fontSize: 11, padding: "2px 4px" }}>{l?.description || ""}</td></tr>)}
      </tbody></table>

      <div style={{ borderTop: "4px solid #111", marginTop: 12 }} />
      <div style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
        <div style={{ width: 120, fontWeight: 700, fontSize: 12, textAlign: "center" }}>QUALITY<br />SIGNATURE</div>
        <div style={{ flex: 1, borderBottom: "1px solid #999", minHeight: 26, fontSize: 15, fontStyle: "italic", paddingLeft: 10 }}>{d.qualityBy}</div>
        <div style={{ width: 70, fontWeight: 700, fontSize: 11, textAlign: "right", paddingRight: 6 }}>DATE:</div>
        <div style={{ width: 150, fontSize: 16 }}>{us(d.qualityDate)}</div>
      </div>
      <div style={{ background: "#d4d4d4", height: 12 }} />
      <table><tbody>
        <tr><td style={{ width: "50%", fontWeight: 700, padding: "4px 10px", borderBottom: "2px solid #111" }}>C&amp;D Printing Co.</td><td style={{ fontWeight: 700, padding: "4px 10px", borderBottom: "2px solid #111" }}>COMPANY</td></tr>
        <tr><td style={{ padding: "6px 10px", fontWeight: 700, fontSize: 14, borderRight: "1px solid #111", verticalAlign: "top" }}>12150 28th Street North<br />Saint Petersburg, FL 33716<br />(727) 572-9999</td><td style={{ padding: "6px 10px", fontWeight: 700, fontSize: 14, verticalAlign: "top" }}>{d.companyName}<br />{d.companyAddress}<br />{d.companyCity}</td></tr>
        <tr style={{ background: "#d4d4d4" }}><td style={{ padding: "4px 50px", fontWeight: 700, fontSize: 13, borderRight: "1px solid #111" }}>Prepared by:</td><td style={{ padding: "4px 30px", fontWeight: 700, fontSize: 13 }}>Accepted by:</td></tr>
        <tr><td style={{ padding: "10px 50px", fontSize: 17, borderRight: "1px solid #111", height: 40 }}>{(d.preparedBy || "").toUpperCase()}</td><td /></tr>
      </tbody></table>
    </div>
  );
}
