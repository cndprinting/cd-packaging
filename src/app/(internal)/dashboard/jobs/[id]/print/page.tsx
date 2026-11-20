"use client";

// Printed job ticket, laid out like C&D's FileMaker ticket (Darrin's sample
// #263686, 11/20/26) so the floor sees the same paper after the changeover:
// header with DUE / TIME / partials / CSR / Sales, customer block, job
// description rows, Proofs + MAILS + DIE# + notes, Size / Quantity / Stock
// with AA Charges and Vendor Information, the press table with the bindery
// checklist beside it, Press + Bindery instructions, samples / COD / delivery,
// and the two tear-offs (press tag, and the new-die stamp for Darrin's desk).
// Printed on 11 x 17 ledger paper (Kelsey 11/20/26). Quote-request extras go on page 2.
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const d = (v: any) => (v ? new Date(v).toLocaleDateString("en-US", { timeZone: "UTC", month: "2-digit", day: "2-digit", year: "2-digit" }) : "");
const num = (v: any) => (v === null || v === undefined || v === "" ? "" : typeof v === "number" ? v.toLocaleString("en-US") : String(v));
const size = (w: any, h: any) => (w || h ? `${w || ""} X ${h || ""}` : "");
const pressName = (p: string) => (/^KOM-/.test(p || "") ? "KOM" : p || "");
const BINDERY: [string, string, string][] = [
  ["score", "Score", "binderyScore"], ["perf", "Perf", "binderyPerf"], ["drill", "Drill", "binderyDrill"], ["pad", "Pad", "binderyPad"],
  ["fold", "Fold", "binderyFold"], ["count", "Count", "binderyCount"], ["stitch", "Stitch", "binderyStitch"], ["collate", "Collate", "binderyCollate"],
  ["pockets", "Pockets", "binderyPockets"], ["glue", "Glue", "binderyGlue"], ["wrap", "Wrap", "binderyWrap"], ["other", "Other", ""],
];
const JOB_TYPES: [string, string][] = [["NEW_ORDER", "New Order"], ["EXACT_REPRINT", "Exact Reprint"], ["REPRINT_WITH_CHANGES", "Reprint With Changes"], ["REPRINT_NEW_FILE", "Reprint New File Supplied"]];

// Notes anywhere: every line prints and wraps (nothing cut off); a line that starts with ** prints red.
function Lines({ text, min = 0, lineStyle, upper = true }: { text?: string | null; min?: number; lineStyle?: React.CSSProperties; upper?: boolean }) {
  const lines = String(text || "").split(/\r?\n/);
  while (lines.length < min) lines.push("");
  return <>{lines.map((l, i) => <div key={i} style={{ borderBottom: "1px dotted #333", minHeight: 17, fontWeight: 700, fontSize: 12, paddingLeft: 2, whiteSpace: "pre-wrap", wordBreak: "break-word", textTransform: upper ? "uppercase" : undefined, color: /^\s*\*\*/.test(l) ? "#d00000" : undefined, ...lineStyle }}>{l}</div>)}</>;
}
const red = (t: any) => (/^\s*\*\*/.test(String(t || "")) ? { color: "#d00000" } : {});

export default function PrintJobTicketPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [qr, setQr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // ?copies=3: Kelsey prints three (two for Darrin, one of those for paper ordering, one for entering the job).
  const [copies, setCopies] = useState(1);
  useEffect(() => { const c = Number(new URLSearchParams(window.location.search).get("copies")); if (c > 1 && c <= 5) setCopies(c); }, []);
  // A crowded ticket shrinks to fit one 11 x 17 sheet so the tear-offs stay on it (like FileMaker crams it).
  const sheetRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1.15);
  useEffect(() => {
    const el = sheetRef.current; if (!el) return;
    const t = setTimeout(() => { const h = el.scrollHeight; const room = 16.4 * 96; setFit(Math.max(0.6, Math.min(1.15, room / Math.max(1, h)))); }, 300);
    return () => clearTimeout(t);
  });
  useEffect(() => {
    fetch(`/api/jobs/${jobId}`).then((r) => r.json()).then((x) => { if (x.job) { setJob(x.job); setQr(x.quoteRequest || null); } }).catch(() => {}).finally(() => setLoading(false));
  }, [jobId]);
  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!job) return <div style={{ padding: 40, fontFamily: "Arial" }}>Job not found</div>;

  const co = job.order?.company || {};
  const cod = job.paymentTerms === "cod";
  const ink = (f: any, b: any, v: any) => (f || b || v ? `${f || ""} / ${b || ""}${v ? ` -${v}` : ""}` : "");
  // Job description rows
  const lines: any[] = (job.lineItems || []).length
    ? job.lineItems.map((li: any) => ({
        qty: li.quantity, desc: [li.description, li.productCode, li.batchNumber ? `#${li.batchNumber}` : "", li.poNumber ? `PO ${li.poNumber}` : ""].filter(Boolean).join(" "),
        flat: li.flatSize ? li.flatSize.replace(/x/i, " X ") : "", fin: size(li.finishedWidth, li.finishedHeight), ink: li.inkSpec || ink(job.inkFront, job.inkBack, job.varnish),
      }))
    : [{ qty: job.quantity, desc: job.description || job.name, flat: size(job.flatSizeWidth, job.flatSizeHeight), fin: size(job.finishedWidth, job.finishedHeight), ink: ink(job.inkFront, job.inkBack, job.varnish) }];
  const descRows = [...lines, ...Array(Math.max(0, 6 - lines.length)).fill(null)];
  // Proofs box
  const proofs = (job.proofsNote || "").split(/\r?\n/).filter(Boolean);
  if (!proofs.length) { proofs.push("PDF"); if (job.hardProof === "customer" || job.hardProof === "internal") proofs.push("Hard proof"); }
  const notes = job.prepressNotes || "";
  // Stock: 4 slots of 2 lines each
  const stockRaw: any[] = Array.isArray(job.stockLines) && job.stockLines.length ? job.stockLines : job.stockDescription ? [{ size: job.runningSize || "", qty: "", description: job.stockDescription, detail: "" }] : [];
  const stock = [...stockRaw.slice(0, 10), ...Array(Math.max(0, 4 - stockRaw.length)).fill(null)];
  // Vendor Information: what the CSR typed, plus purchases that name a vendor (not the auto-made checklist rows).
  const vendor = [job.vendorInfo, ...(job.purchases || []).filter((p: any) => p.vendor).map((p: any) => [p.description, p.vendor].filter(Boolean).join(" - "))].filter(Boolean);
  // Press runs (or one row from the job's press fields)
  const runs: any[] = (job.pressRuns || []).length ? job.pressRuns : (job.pressAssignment || job.runningSize || job.imposition) ? [{
    press: job.pressAssignment, formNumber: job.pressFormat || "1", finishCount: job.finalPressCount, makeReady: job.makeReadyCount, runningSize: job.runningSize,
    imposition: job.imposition, numberUp: job.numberUp, inkSpec: job.inkFront && job.inkBack ? `${job.inkFront}/${job.inkBack}` : job.inkFront, firstPassCount: job.firstPassCount, finalPressCount: null, pressmanInitials: job.pressmanInitials,
  }] : [];
  const pressRows = [...runs, ...Array(Math.max(0, 12 - runs.length)).fill(null)];
  // Bindery checklist with text lines
  const bv: Record<string, string> = { ...(job.binderyValues || {}) };
  if (!bv.other && job.binderyOther && job.binderyOther !== "true") bv.other = job.binderyOther;
  const bOn = (k: string, col: string) => !!bv[k] || (col ? !!job[col] : false);
  const binderyShort = BINDERY.filter(([k, , c]) => bOn(k, c)).map(([k, l]) => `${l}${bv[k] ? ` ${bv[k]}` : ""}`).join(", ");
  const samples = job.samplesQty || (job.samplesRequired ? "" : null);
  const first = runs[0];
  const deliveryTo = (job.deliveryTo || "").split(/\r?\n/);
  const csr = job.csr?.name?.split(" ")[0] || "";
  const sales = job.salesRep?.name?.split(" ")[0] || job.repName || "";

  const sheet = (
    <>
      {/* ── Header ── */}
      <table><tbody><tr>
        <td style={{ width: "62%", verticalAlign: "top", paddingTop: 4 }}>
          <div><span className="l">Job Ticket #</span> <span className="v" style={{ fontSize: 16, minWidth: 80 }}>{job.jobNumber}</span>
            <span className="l" style={{ marginLeft: 10 }}>Last Job #</span> <span className="v" style={{ minWidth: 60 }}>{job.lastJobNumber || ""}</span>
            <span className="l" style={{ marginLeft: 10 }}>Rep job #</span> <span style={{ display: "inline-block", border: "1px solid #999", minWidth: 70, height: 16, verticalAlign: "bottom", fontWeight: 700, paddingLeft: 3 }}>{job.repJobNumber || ""}</span></div>
          <div style={{ marginTop: 5, fontSize: 11, whiteSpace: "nowrap" }}>{JOB_TYPES.map(([k, l], i) => <span key={k}><span className={`rd ${(job.jobType || "NEW_ORDER") === k ? "on" : ""}`} style={i === 0 ? { marginLeft: 4 } : { marginLeft: 7 }} />{l}</span>)}</div>
        </td>
        <td style={{ width: "19%", verticalAlign: "top", textAlign: "center" }}>
          <table><tbody><tr><td className="l" style={{ textAlign: "center" }}>ENTERED</td><td className="l" style={{ textAlign: "center" }}>PROOF DATE</td></tr>
            <tr><td style={{ border: "1px solid #999", height: 18, fontWeight: 700, fontSize: 13, textAlign: "center" }}>{d(job.enteredDate || job.createdAt)}</td><td style={{ border: "1px solid #999", fontWeight: 700, fontSize: 13, textAlign: "center" }}>{d(job.proofDate)}</td></tr></tbody></table>
        </td>
        <td style={{ width: "19%", verticalAlign: "top", border: "1px solid #999", padding: 3 }}>
          <div style={{ textAlign: "right" }}><span className="l">DUE</span> <span className="v" style={{ minWidth: 70 }}>{d(job.dueDate)}</span></div>
          <div style={{ textAlign: "right" }}><span className="l">TIME</span> <span className="v" style={{ minWidth: 70 }}>{job.dueTime || ""}</span></div>
          <table style={{ marginTop: 2 }}><tbody><tr><td className="l" style={{ fontSize: 9 }}>PARTIAL QTY</td><td className="l" style={{ fontSize: 9 }}>PARTIAL Due</td></tr>
            <tr><td style={{ border: "1px solid #999", height: 16, fontWeight: 700, fontSize: 11 }}>{num(job.partialQty)}</td><td style={{ border: "1px solid #999", fontWeight: 700, fontSize: 11 }}>{d(job.partialDue)}</td></tr></tbody></table>
        </td>
      </tr></tbody></table>

      {/* ── Customer ── */}
      <table style={{ marginTop: 2 }}><tbody>
        <tr>
          <td style={{ width: "46%" }}><div style={{ display: "flex" }}><span className="l" style={{ width: 52 }}>Customer</span><div className="dot" style={{ flex: 1 }}>{co.name}</div></div></td>
          <td style={{ width: "27%" }}><div style={{ display: "flex" }}><span className="l" style={{ width: 42 }}>Contact</span><div className="dot" style={{ flex: 1 }}>{job.contactName || ""}</div></div></td>
          <td rowSpan={4} style={{ width: "27%", verticalAlign: "top", paddingLeft: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1 }}><span className="l">Estimate No.</span><div className="dot">{job.estimateNumber || ""}</div>
                <span className="l">Customer #</span><div className="dot">{co.customerNumber || ""}</div></div>
              <div style={{ background: "#d9d9d9", padding: 3, width: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span className="l" style={{ fontWeight: 700, width: 32 }}>CSR</span><div style={{ background: "#fff", flex: 1, fontWeight: 700, fontSize: 13, padding: "1px 3px", textTransform: "uppercase" }}>{csr}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}><span className="l" style={{ fontWeight: 700, width: 32 }}>Sales</span><div style={{ background: "#fff", flex: 1, fontWeight: 700, fontSize: 13, padding: "1px 3px", textTransform: "uppercase" }}>{sales}</div></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}><span className="l">Customer P.O.</span><div className="dot" style={{ flex: 1 }}>{job.customerPO || ""}</div></div>
          </td>
        </tr>
        <tr>
          <td><div style={{ display: "flex" }}><span className="l" style={{ width: 52 }}>Address</span><div className="dot" style={{ flex: 1 }}>{co.address || ""}</div></div></td>
          <td><div style={{ display: "flex" }}><span className="l" style={{ width: 42 }}>Phone</span><div className="dot" style={{ flex: 1 }}>{co.phone || ""}</div></div></td>
        </tr>
        <tr>
          <td><div style={{ display: "flex", gap: 4 }}><span className="l" style={{ width: 48, textAlign: "right" }}>City</span><div className="dot" style={{ flex: 2 }}>{co.city || ""}</div><span className="l">State</span><div className="dot" style={{ width: 28 }}>{co.state || ""}</div><span className="l">Zip</span><div className="dot" style={{ width: 52 }}>{co.zip || ""}</div></div></td>
          <td><div style={{ display: "flex" }}><span className="l" style={{ width: 42 }}>Fax</span><div className="dot" style={{ flex: 1 }} /></div></td>
        </tr>
        <tr>
          <td colSpan={2} style={{ fontSize: 12 }}><span className="l"># Pages</span> <span className="v" style={{ minWidth: 34 }}>{job.numPages || ""}</span>
            <span className={`rd ${job.softCover ? "on" : ""}`} />Self Cover<span className={`rd ${job.plusCover ? "on" : ""}`} />Plus Cover
            <span className="l" style={{ marginLeft: 24 }}>Bleeds</span><span className={`rd ${job.hasBleeds ? "on" : ""}`} />Yes<span className={`rd ${!job.hasBleeds ? "on" : ""}`} />No</td>
        </tr>
        <tr><td colSpan={3}><div style={{ display: "flex" }}><span className="l" style={{ width: 52 }}>Job Title</span><div className="dot" style={{ width: "62%", fontSize: 13 }}>{job.name}</div></div></td></tr>
      </tbody></table>

      {/* ── Job description rows ── */}
      <table style={{ marginTop: 6 }}>
        <colgroup><col style={{ width: "7%" }} /><col style={{ width: "35%" }} /><col style={{ width: "12%" }} /><col style={{ width: "13%" }} /><col style={{ width: "17%" }} /><col style={{ width: "16%" }} /></colgroup>
        <tbody>
          <tr>
            <td className="hd" style={{ textAlign: "left" }}>Quantity</td><td className="hd" style={{ textAlign: "left" }}>Job Description</td>
            <td className="hd" style={{ fontSize: 13 }}>Flat Size</td><td className="hd"><span style={{ fontSize: 9 }}>Finished Size</span><br /><span style={{ fontSize: 10 }}>Width&nbsp;&nbsp;&nbsp;&nbsp;Height</span></td>
            <td className="hd" style={{ textAlign: "left" }}>X / X &nbsp; Ink &nbsp;- Varnish</td>
            <td style={{ background: "#fff", verticalAlign: "middle" }}><span style={{ border: "1px solid #999", display: "block", padding: "1px 4px", fontSize: 13, whiteSpace: "nowrap" }}><span className="box">{job.pressCheck ? "X" : ""}</span>Press Check</span></td>
          </tr>
          {descRows.map((r, i) => (
            <tr key={i} className="g">
              <td style={{ textAlign: "center" }}>{r ? num(r.qty) : ""}</td><td style={{ whiteSpace: "normal", height: "auto", wordBreak: "break-word", ...red(r?.desc) }}>{r?.desc || ""}</td>
              <td style={{ textAlign: "center" }}>{r?.flat || "x"}</td><td style={{ textAlign: "center" }}>{r?.fin || "X"}</td>
              <td>{r?.ink || <span style={{ fontWeight: 400 }}>&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;-</span>}</td><td style={{ background: "#fff" }} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Proofs / MAILS / DIE# / Blanket / notes ── */}
      <table style={{ marginTop: 6 }}><tbody><tr>
        <td style={{ width: "7%", verticalAlign: "top" }}><div className="l">Proofs</div>{[0, 1, 2].map((i) => <div key={i} className="dot" style={{ fontSize: 11 }}>{proofs[i] || ""}</div>)}</td>
        <td style={{ width: "19%", verticalAlign: "top", background: "#ececec", padding: 2 }}>
          <table><tbody>
            <tr><td className="l" style={{ fontSize: 8, textAlign: "center" }}>MAILS</td><td className="l" style={{ fontSize: 8, textAlign: "center" }}>QTY</td><td className="l" style={{ fontSize: 8, textAlign: "center" }}>Drop CITY</td></tr>
            <tr>{[job.mailDate, num(job.mailQty), job.mailDropCity].map((v, i) => <td key={i} style={{ background: "#fff", border: "1px solid #999", height: 16, fontSize: 10, fontWeight: 700 }}>{v || ""}</td>)}</tr>
            <tr><td className="l" style={{ fontSize: 9 }}>Weight</td><td colSpan={2} style={{ background: "#fff", border: "1px solid #999", height: 16, fontSize: 10, fontWeight: 700 }}>{job.mailWeight || ""}</td></tr>
            <tr><td className="l" style={{ fontSize: 9 }}>Postage</td><td colSpan={2} style={{ background: "#fff", border: "1px solid #999", height: 16, fontSize: 10, fontWeight: 700 }}>{job.mailPostage || ""}</td></tr>
          </tbody></table>
        </td>
        <td style={{ width: "10%", verticalAlign: "top", padding: "0 3px" }}>
          <div style={{ display: "flex", border: "1px solid #999", height: 32 }}><span className="vt l" style={{ fontWeight: 700, fontSize: 9, borderLeft: "1px solid #999", padding: "0 1px" }}>DIE#</span><span style={{ fontWeight: 700, fontSize: 12, padding: 2 }}>{job.dieNumber || ""}</span></div>
          <div style={{ border: "1px solid #999", marginTop: 2, height: 30, fontSize: 12, fontWeight: 700, padding: 2 }}><div className="l" style={{ fontSize: 8, textAlign: "center" }}>Blanket No.</div>{job.blanketNumber || ""}</div>
        </td>
        <td style={{ verticalAlign: "top" }}><Lines text={notes} min={4} /></td>
      </tr></tbody></table>

      {/* ── Stock / AA Charges / Vendor Information ── */}
      <table style={{ marginTop: 6 }}>
        <colgroup><col style={{ width: "11%" }} /><col style={{ width: "10%" }} /><col style={{ width: "36%" }} /><col style={{ width: "11%" }} /><col style={{ width: "32%" }} /></colgroup>
        <tbody>
          <tr>
            <td className="hd" style={{ fontSize: 12 }}>Size</td><td className="hd" style={{ fontSize: 12 }}>Quantity</td>
            <td className="hd" style={{ textAlign: "left", fontSize: 12 }}>Stock Description <b style={{ color: "#1d39a6", fontSize: 15 }}>FSC:</b> <span style={{ display: "inline-block", background: "#fff", width: "45%", height: 14, verticalAlign: "middle", fontWeight: 700, paddingLeft: 3 }}>{job.fscCertified ? "YES" : ""}</span></td>
            <td className="hd" style={{ fontSize: 12 }}>AA Charges{job.aaCharges ? <><br /><b>${Number(job.aaCharges).toFixed(2)}</b></> : null}</td>
            <td className="hd" style={{ textAlign: "left", fontWeight: 700, fontSize: 12, background: "#fff", borderBottom: "1px solid #ccc" }}>Vendor Information</td>
          </tr>
          {stock.flatMap((s, i) => [0, 1].map((k) => {
            const row = i * 2 + k;
            return (
              <tr key={row} className="w">
                <td style={{ textAlign: "center" }}>{k === 0 ? s?.size || "" : ""}</td>
                <td style={{ textAlign: "center" }}>{k === 0 ? num(s?.qty) : ""}</td>
                <td style={{ whiteSpace: "normal", height: "auto", wordBreak: "break-word", ...red(k === 0 ? s?.description : s?.detail) }}>{k === 0 ? s?.description || "" : s?.detail || ""}</td>
                <td style={{ background: "#ececec", fontSize: 10, fontWeight: 400, borderBottom: k === 1 ? "2px solid #fff" : undefined }}>{i < 4 ? (k === 0 ? "Date:" : "Time:") : ""}</td>
                {row === 0 && <td rowSpan={stock.length * 2} style={{ borderLeft: "1px solid #ccc", whiteSpace: "normal", verticalAlign: "top", fontSize: 11, padding: "2px 4px" }}>{vendor.join("\n").split(/\r?\n/).map((l, x) => <div key={x} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", ...red(l) }}>{l}</div>)}</td>}
              </tr>
            );
          }))}
        </tbody>
      </table>

      {/* ── Press table + bindery checklist ── */}
      <table style={{ marginTop: 8 }}>
        <colgroup><col style={{ width: "8%" }} /><col style={{ width: "9%" }} /><col style={{ width: "7.5%" }} /><col style={{ width: "6.5%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} /><col style={{ width: "6%" }} /><col style={{ width: "4.5%" }} /><col style={{ width: "7.5%" }} /><col style={{ width: "7.5%" }} /><col style={{ width: "6.5%" }} /><col style={{ width: "16%" }} /></colgroup>
        <tbody>
          <tr>
            {["Press", "Form# / Info", "Finish Count", "Make Ready", "Running Size", "Imposition", "# UP", "X / X", "First Pass Count", "Final Press Count", "Pressman Initials"].map((h) => <td key={h} className="hd" style={{ fontSize: h.length > 10 ? 9.5 : 11 }}>{h}</td>)}
            <td style={{ fontSize: 11, color: "#555", paddingLeft: 8, verticalAlign: "bottom" }}>Bindery Instructions</td>
          </tr>
          {pressRows.map((r, i) => (
            <tr key={i} className="w">
              <td style={{ textAlign: "center" }}>{r ? pressName(r.press) : ""}</td><td style={{ textAlign: "center" }}>{r?.formNumber || ""}</td>
              <td style={{ textAlign: "center" }}>{r ? num(r.finishCount) : ""}</td><td style={{ textAlign: "center" }}>{r ? num(r.makeReady) : ""}</td>
              <td style={{ textAlign: "center" }}>{r?.runningSize || ""}</td><td style={{ textAlign: "center" }}>{r?.imposition || ""}</td>
              <td style={{ textAlign: "center" }}>{r?.numberUp || ""}</td><td style={{ textAlign: "center" }}>{r?.inkSpec || ""}</td>
              <td style={{ textAlign: "center" }}>{r ? num(r.firstPassCount) : ""}</td><td style={{ textAlign: "center" }}>{r ? num(r.finalPressCount) : ""}</td><td style={{ textAlign: "center" }}>{r?.pressmanInitials || ""}</td>
              <td style={{ border: 0, paddingLeft: 8, fontWeight: 400 }}>{BINDERY[i] && (() => { const [k, l, c] = BINDERY[i]; return <span style={{ display: "flex", alignItems: "center" }}><span className="box">{bOn(k, c) ? "X" : ""}</span><span style={{ width: 46, fontSize: 11.5 }}>{l}</span><span style={{ flex: 1, borderBottom: "1px solid #000", fontWeight: 700, fontSize: 10, textDecoration: bv[k] ? "underline" : undefined, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.1, ...red(bv[k]) }}>{bv[k] || ""}</span></span>; })()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Press + Bindery instructions ── */}
      <table style={{ marginTop: 6 }}><tbody><tr>
        <td style={{ width: "48%", verticalAlign: "top" }}><div className="l" style={{ fontSize: 11 }}>Press Instructions</div>
          <div style={{ background: "#ffffc8", border: "1.5px solid #000", minHeight: 70 }}><Lines text={job.pressNotes} min={4} /></div></td>
        <td style={{ verticalAlign: "top", paddingLeft: 4 }}><div className="l" style={{ fontSize: 11 }}>Bindery Instructions</div>
          <Lines text={job.binderyNotes} min={4} /></td>
      </tr></tbody></table>

      {/* ── Samples / COD / Delivery ── */}
      <table style={{ marginTop: 6 }}><tbody><tr>
        <td style={{ width: "40%", verticalAlign: "top" }}>
          {samples !== null && <div style={{ fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, fontSize: 17, textAlign: "center", lineHeight: 1.2 }}>MUST PUT <span style={{ fontSize: 26, WebkitTextStroke: "1px #000", color: "#bbb" }}>{samples || "__"}</span> SAMPLES<br />IN THIS JOB TICKET</div>}
          {cod && <div style={{ color: "#e00000", fontWeight: 900, fontStyle: "italic", fontSize: 64, lineHeight: 1, marginTop: 2 }}>COD</div>}
          <div style={{ marginTop: 4 }}><Lines text={job.generalNotes} min={2} upper={false} lineStyle={{ fontSize: 10.5, minHeight: 14 }} /></div>
        </td>
        <td style={{ width: "21%", verticalAlign: "top", paddingLeft: 4 }}>
          <div style={{ display: "flex", fontSize: 10, color: "#555", textAlign: "center" }}><span style={{ width: "40%" }}>Delivery<br />QTY</span><span style={{ flex: 1, paddingTop: 11 }}>Packaging</span></div>
          <table><tbody>{[0, 1, 2, 3].map((i) => <tr key={i}><td style={{ background: "#ececec", borderBottom: "1px solid #fff", borderRight: "1px solid #000", height: 16, width: "40%", fontWeight: 700, fontSize: 11, textAlign: "center" }}>{i === 0 ? num(job.deliveryQty) : ""}</td><td style={{ background: "#ececec", borderBottom: "1px solid #fff", fontWeight: 700, fontSize: 10 }}>{i === 0 ? job.deliveryPackaging || "" : ""}</td></tr>)}</tbody></table>
          <div style={{ fontWeight: 900, fontStyle: "italic", fontSize: 13, marginTop: 4 }}>SAMPLES CHECKED</div>
          <div style={{ background: "#d9d9d9", border: "1px solid #000", height: 26, fontSize: 9, padding: 2 }}>By: {job.samplesChecked ? <b style={{ fontSize: 12 }}>✓</b> : ""}</div>
        </td>
        <td style={{ verticalAlign: "top", paddingLeft: 6 }}>
          <div className="l" style={{ fontSize: 11 }}>Delivery To:</div>
          {[...deliveryTo, ...Array(Math.max(0, 6 - deliveryTo.length)).fill("")].map((l: string, i: number) => <div key={i} style={{ borderBottom: "1px solid #000", minHeight: 16, fontWeight: 700, fontSize: 12, textDecoration: l ? "underline" : undefined, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{l}</div>)}
        </td>
      </tr>
      <tr><td colSpan={3} style={{ paddingTop: 4 }}><div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <div className="dot" style={{ flex: 2 }} /><span className="l" style={{ fontSize: 11 }}>Samples To</span><div className="dot" style={{ flex: 3, textTransform: "uppercase" }}>{job.samplesTo || ""}</div>
        <span className="l" style={{ fontSize: 11 }}>QTY</span><div className="dot" style={{ width: 50 }}>{job.samplesQty || ""}</div>
        <span style={{ fontSize: 11 }}><span className="box">{cod ? "X" : ""}</span>COD</span></div></td></tr>
      </tbody></table>

      {/* ── Tear-offs: press tag + new-die stamp ── */}
      <div style={{ display: "flex", gap: 24, marginTop: 12, borderTop: "1px dashed #999", paddingTop: 10, height: "2.2in", overflow: "hidden", breakInside: "avoid" }}>
        <div className="vt" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, height: "100%", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, borderLeft: "3px solid #000", paddingLeft: 3 }}><span>{job.jobNumber}</span><span style={{ fontWeight: 400, marginLeft: 30 }}>{co.name}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: "1px solid #000" }}><span><span className="box" />Press Check</span><span style={{ background: "#999", color: "#000", fontWeight: 700, padding: "3px 1px", display: "inline-flex", alignItems: "center", gap: 4 }}>PAPER<span style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", background: "#fff", border: "1px solid #000" }} /></span><span style={{ fontWeight: 700 }}>Due: {d(job.dueDate)}</span></div>
          <div style={{ display: "flex", gap: 10, fontWeight: 700 }}><span>{job.name}</span><span style={{ fontWeight: 400 }}><span className="box">{job.ledInk ? "X" : ""}</span>LED INK</span><span style={{ fontWeight: 400, fontSize: 9 }}>{job.varnish || ""}</span></div>
          <div style={{ display: "flex", gap: 10 }}><b style={{ fontSize: 14, fontStyle: "italic", textDecoration: "underline" }}>Press:</b>{first ? <span>{first.formNumber || ""}&nbsp;&nbsp;{num(first.finishCount)}&nbsp;&nbsp;{first.runningSize || ""}&nbsp;&nbsp;{first.imposition || ""}&nbsp;&nbsp;{first.numberUp || ""}&nbsp;&nbsp;{first.inkSpec || ""}</span> : null}</div>
          <div style={{ fontWeight: 700, fontSize: 10 }}>{stockRaw[0]?.description || ""}<br />{stockRaw[0]?.detail || ""}</div>
          <div style={{ display: "flex", gap: 10 }}><b style={{ fontStyle: "italic", textDecoration: "underline" }}>Bindery:</b><span>{binderyShort}</span></div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="vt" style={{ border: "1.5px solid #000", height: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 6, color: "#777", fontSize: 13, textAlign: "center", overflow: "hidden" }}>
          <div style={{ alignSelf: "center" }}>STAMP HERE FOR NEW DIE<br />TEAR OFF AND PUT ON<br />DARRIN&apos;S DESK AFTER<br />APPROVAL</div>
          <div style={{ color: "#000", fontWeight: 700, fontSize: 12, alignSelf: "center" }}>{job.jobNumber}&nbsp;&nbsp;&nbsp;&nbsp;{co.name}</div>
        </div>
        <div style={{ width: 30, border: "1px solid #000", background: "#ddd", height: "100%" }} />
        <div style={{ flex: 1 }} />
      </div>

    </>
  );

  return (
    <div className="tk print-color">
      <style>{`
        @page { size: 11in 17in; margin: 0.25in; }
        @media print { html, body { margin: 0 !important; padding: 0 !important; } .tk { zoom: ${fit.toFixed(3)}; width: 8.2in; } }
        @media print { .noprint { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { background: #fff; }
        .tk { width: 7.85in; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; }
        .tk table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .l { font-size: 10px; color: #222; white-space: nowrap; }
        .v { font-weight: 700; font-size: 13px; border-bottom: 1px dotted #333; display: inline-block; min-height: 15px; vertical-align: bottom; }
        .hd { background: #d9d9d9; font-size: 11px; text-align: center; border: 1px solid #fff; padding: 1px 2px; line-height: 1.05; }
        .g td { border: 1px solid #fff; background: #ececec; height: 16px; padding: 0 4px; font-weight: 700; font-size: 11.5px; overflow: hidden; white-space: nowrap; }
        .w td { border: 1px solid #ccc; height: 16px; padding: 0 4px; font-weight: 700; font-size: 11.5px; overflow: hidden; white-space: nowrap; }
        .dot { border-bottom: 1px dotted #333; height: 17px; font-weight: 700; font-size: 12px; padding-left: 2px; white-space: nowrap; overflow: hidden; }
        .box { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; text-align: center; line-height: 10px; font-size: 10px; margin-right: 3px; vertical-align: -1px; }
        .rd { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; border-radius: 50%; margin: 0 3px 0 10px; vertical-align: -1px; position: relative; }
        .rd.on::after { content: ""; position: absolute; inset: 2px; background: #000; border-radius: 50%; }
        .vt { writing-mode: vertical-rl; transform: rotate(180deg); }
      `}</style>

      <div className="noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #ddd", marginBottom: 8 }}>
        <a href={`/dashboard/jobs/${jobId}`} style={{ color: "#15803d", fontSize: 14, textDecoration: "none" }}>&larr; Back to Job</a>
        <span style={{ fontSize: 12, color: "#666" }}>Prints on 11 x 17 (ledger) · {copies === 1 ? <a href="?copies=3" style={{ color: "#15803d" }}>switch to 3 copies</a> : <>{copies} copies · <a href="?" style={{ color: "#15803d" }}>just 1</a></>}</span>
        <button onClick={() => window.print()} style={{ background: "#15803d", color: "#fff", padding: "9px 22px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: 0, cursor: "pointer" }}>{copies > 1 ? `Print ${copies} copies` : "Print Job Ticket"}</button>
      </div>

      {Array.from({ length: copies }, (_, n) => <div key={n} ref={n === 0 ? sheetRef : undefined} style={n < copies - 1 ? { breakAfter: "page", pageBreakAfter: "always" } : undefined}>{sheet}</div>)}

      {/* ── Page 2: quote-request extras (not on the FileMaker ticket) ── */}
      {qr && (() => {
        const rows: [string, string][] = [];
        const push = (l: string, v: any) => { if (v == null || v === "" || v === false) return; rows.push([l, v === true ? "Yes" : String(v)]); };
        push("Pickup from", qr.pickupJobNumber); push("Low-res proofs", qr.lowResProofs); push("Hi-res proofs", qr.hiResProofs); push("Orientation", qr.orientation);
        push("Flood UV", qr.floodUv && (qr.uvSides || "yes")); push("Spot UV", qr.spotUv && (qr.uvSides || "yes")); push("Flood LED UV", qr.floodLedUv && (qr.ledUvSides || "yes")); push("Spot LED UV", qr.spotLedUv && (qr.ledUvSides || "yes"));
        push("Aqueous", qr.aqueous); push("Dry trap", qr.drytrap); push("Fold type", qr.foldType); push("Saddle stitch", qr.saddleStitch); push("Corner stitch", qr.cornerStitch);
        push("Perfect bind", qr.perfectBind); push("Plastic coil", qr.plasticCoil); push("Wire-O", qr.wireO); push("GBC", qr.gbc); push("Case bind", qr.caseBind); push("Lamination", qr.lamination);
        push("Foil", qr.foil && `${qr.foil}${qr.foilIsNew ? " (NEW)" : ""}`); push("Emboss", qr.emboss && `${qr.emboss}${qr.embossIsNew ? " (NEW)" : ""}`);
        push("Die cut", qr.dieCut && `${qr.existingDieNumber ? `#${qr.existingDieNumber}` : "yes"}${qr.dieVHSize ? ` (${qr.dieVHSize})` : ""}`);
        push("Drill", qr.drill); push("Punch", qr.punch); push("Score", qr.score); push("Perf", qr.perf); push("Round corner", qr.roundCorner); push("Numbering", qr.numbering);
        push("NCR pad", qr.ncrPad); push("Band", qr.bandIn); push("Wrap", qr.wrapIn); push("Pad", qr.padIn); push("Mailing", qr.mailingServices);
        push("Wafer seal", qr.waferSeal && `${qr.waferSealTabs ? `x${qr.waferSealTabs}` : ""}${qr.waferSealLocation ? ` @ ${qr.waferSealLocation}` : ""}`);
        push("# Pockets", qr.numPockets); push("Artwork", qr.artworkIsNew ? "NEW" : qr.artworkFileName || qr.artworkUrl || null); push("Vendor", qr.vendorName);
        if (!rows.length && !qr.customColorCoatingNotes) return null;
        return (
          <div style={{ breakBefore: "page", pageBreakBefore: "always", paddingTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "2px solid #000", marginBottom: 6 }}>{job.jobNumber} {co.name}: from quote request #{qr.requestNumber}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "3px 14px", fontSize: 12 }}>
              {rows.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted #999" }}><span style={{ color: "#555" }}>{k}</span><b>{v}</b></div>)}
            </div>
            {qr.customColorCoatingNotes && <div style={{ marginTop: 6, fontSize: 12 }}><b>Color/coating notes:</b> {qr.customColorCoatingNotes}</div>}
          </div>
        );
      })()}
    </div>
  );
}
