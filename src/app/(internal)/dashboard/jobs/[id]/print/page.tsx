"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { getStatusLabel, formatDate } from "@/lib/utils";

export default function PrintJobTicketPage() {
  const params = useParams();
  const jobId = params.id as string;
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (res.ok && data.job) {
          const j = data.job;
          setJob({ ...j, companyName: j.companyName || j.order?.company?.name || "", orderNumber: j.orderNumber || j.order?.orderNumber || "" });
          setLoading(false);
          return;
        }
      } catch {}
      const found = demoJobs.find(j => j.id === jobId);
      if (found) setJob(found as unknown as Record<string, unknown>);
      setLoading(false);
    }
    load();
  }, [jobId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!job) return <div className="p-8 text-center">Job not found</div>;

  const f = (key: string) => (job[key] as string) || "";
  const b = (key: string) => Boolean(job[key]);
  const n = (key: string) => (job[key] as number) || 0;
  const check = (val: boolean) => val ? "☑" : "☐";

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { size: letter portrait; margin: 0.3in; }
        }
        .print-page { width: 8in; margin: 0 auto; font-family: "Courier New", Courier, monospace; font-size: 10px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
        .label { font-size: 7.5px; text-transform: uppercase; color: #444; letter-spacing: 0.5px; font-weight: normal; display: block; margin-bottom: 1px; }
        .val { font-size: 12px; font-weight: bold; min-height: 18px; display: block; }
        .val-lg { font-size: 15px; font-weight: bold; min-height: 22px; }
        .val-xl { font-size: 20px; font-weight: bold; }
        .section-head { background: #000; color: #fff; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 6px; }
        .write-line { border-bottom: 1px solid #999; min-height: 20px; display: block; }
        .write-box { border: 1px solid #999; min-height: 50px; width: 100%; display: block; }
        .check { font-size: 13px; margin-right: 2px; }
        .check-item { display: inline-block; margin-right: 12px; font-size: 11px; white-space: nowrap; }
        .stamp { border: 3px solid #000; text-align: center; padding: 6px; font-size: 12px; font-weight: bold; letter-spacing: 1px; }
        .tear { border-top: 2px dashed #666; margin: 10px 0; position: relative; }
        .tear::after { content: "✂  CUT HERE — TEAR OFF FOR TRACKING BOARD"; position: absolute; top: -7px; left: 50%; transform: translateX(-50%); background: white; padding: 0 10px; font-size: 7px; color: #666; letter-spacing: 1px; }
        .strip { border: 2px solid #000; padding: 8px 12px; }
        .half { width: 50%; }
        .third { width: 33.33%; }
        .quarter { width: 25%; }
        .fifth { width: 20%; }
        .spacer { height: 6px; border: none; }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "sans-serif" }}>
        <a href={`/dashboard/jobs/${jobId}`} style={{ color: "#15803d", fontSize: "14px" }}>← Back to Job</a>
        <button onClick={() => window.print()} style={{ background: "#15803d", color: "#fff", padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "bold", border: "none", cursor: "pointer" }}>🖨️ Print Job Ticket</button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* HEADER ROW */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table>
        <tbody>
          <tr>
            <td style={{ width: "30%" }}>
              <div className="val-xl">{f("jobNumber")}</div>
              <div style={{ fontSize: "8px", color: "#666" }}>C&D PRINTING — JOB TICKET</div>
            </td>
            <td style={{ width: "25%" }}>
              <span className="label">Job Type</span>
              <div style={{ fontSize: "11px", lineHeight: "18px" }}>
                <span className="check">{f("jobType") === "NEW_ORDER" ? "☑" : "☐"}</span> New Order<br/>
                <span className="check">{f("jobType") === "EXACT_REPRINT" ? "☑" : "☐"}</span> Exact Reprint<br/>
                <span className="check">{f("jobType") === "REPRINT_WITH_CHANGES" ? "☑" : "☐"}</span> Reprint With Changes<br/>
                <span className="check">{f("jobType") === "REPRINT_NEW_FILE" ? "☑" : "☐"}</span> Reprint New File Supplied
              </div>
            </td>
            <td style={{ width: "20%" }}>
              <span className="label">Last Job #</span>
              <span className="val">{f("lastJobNumber") || <span className="write-line">&nbsp;</span>}</span>
              <span className="label" style={{ marginTop: "4px" }}>Estimate #</span>
              <span className="val">{f("estimateNumber") || <span className="write-line">&nbsp;</span>}</span>
            </td>
            <td style={{ width: "25%" }}>
              <span className="label">Due Date</span>
              <span className="val-lg">{job.dueDate ? formatDate(String(job.dueDate)) : ""}</span>
              <span className="label">Time</span>
              <span className="write-line">&nbsp;</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* CUSTOMER INFO */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={6} className="section-head">Customer Information</td></tr>
          <tr>
            <td className="half" colSpan={3}><span className="label">Customer</span><span className="val-lg">{f("companyName")}</span></td>
            <td className="quarter"><span className="label">Customer #</span><span className="val"><span className="write-line">&nbsp;</span></span></td>
            <td className="quarter"><span className="label">Customer P.O.</span><span className="val">{f("customerPO") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
          <tr>
            <td colSpan={2}><span className="label">Address</span><span className="write-line">&nbsp;</span></td>
            <td><span className="label">City</span><span className="write-line">&nbsp;</span></td>
            <td><span className="label">State / Zip</span><span className="write-line">&nbsp;</span></td>
            <td><span className="label">Phone / Fax</span><span className="write-line">&nbsp;</span></td>
          </tr>
          <tr>
            <td colSpan={2}><span className="label">Contact</span><span className="val">{f("contactName") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Rep</span><span className="val">{f("repName") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">CSR</span><span className="val">{f("csrName") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Sales</span><span className="val">{f("salesRepName") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* JOB DESCRIPTION */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={5} className="section-head">Job Description</td></tr>
          <tr>
            <td colSpan={3}><span className="label">Job Title</span><span className="val-lg">{f("name")}</span></td>
            <td><span className="label">Quantity</span><span className="val-xl">{n("quantity").toLocaleString()}</span></td>
            <td><span className="label"># Pages</span><span className="val">{n("numPages") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
          <tr>
            <td colSpan={5} style={{ minHeight: "40px" }}><span className="label">Description / Special Instructions</span><span className="val" style={{ minHeight: "30px" }}>{f("description") || ""}</span><span className="write-line">&nbsp;</span></td>
          </tr>
          <tr>
            <td colSpan={3}>
              <span className="check-item"><span className="check">{check(b("softCover"))}</span> Soft Cover</span>
              <span className="check-item"><span className="check">{check(b("plusCover"))}</span> Plus Cover</span>
              <span className="check-item"><span className="check">{check(b("hasBleeds"))}</span> Bleeds</span>
              <span className="check-item"><span className="check">{check(b("fscCertified"))}</span> FSC</span>
            </td>
            <td><span className="label">Proof Date</span><span className="val">{job.proofDate ? formatDate(String(job.proofDate)) : <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Entered</span><span className="val">{job.createdAt ? formatDate(String(job.createdAt)) : <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* STOCK & SIZE */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={6} className="section-head">Stock & Size Specifications</td></tr>
          <tr>
            <td colSpan={3}><span className="label">Stock Description</span><span className="val">{f("stockDescription") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Blanket No.</span><span className="val">{f("blanketNumber") || <span className="write-line">&nbsp;</span>}</span></td>
            <td colSpan={2}><span className="label">DIE #</span><span className="val">{f("dieNumber") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
          <tr>
            <td colSpan={2}><span className="label">Flat Size (W × H)</span><span className="val">{n("flatSizeWidth") ? `${n("flatSizeWidth")} × ${n("flatSizeHeight")}` : <span className="write-line">&nbsp;</span>}</span></td>
            <td colSpan={2}><span className="label">Finished Size (W × H)</span><span className="val">{n("finishedWidth") ? `${n("finishedWidth")} × ${n("finishedHeight")}` : <span className="write-line">&nbsp;</span>}</span></td>
            <td colSpan={2}><span className="label">Ink (Front / Back) — Varnish</span><span className="val">{f("inkFront") || "___"} / {f("inkBack") || "___"} — {f("varnish") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* PRESS INFORMATION */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={6} className="section-head">Press Information</td></tr>
          <tr>
            <td><span className="label">Press</span><span className="val">{f("pressAssignment") || <span className="write-line">&nbsp;</span>}</span></td>
            <td>
              <span className="check-item"><span className="check">{check(b("pressCheck"))}</span> Press Check</span><br/>
              <span className="check-item"><span className="check">{check(b("ledInk"))}</span> LED Ink</span>
            </td>
            <td><span className="label">Format / Info</span><span className="val">{f("pressFormat") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Imposition</span><span className="val">{f("imposition") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label"># Up</span><span className="val">{n("numberUp") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Running Size</span><span className="val">{f("runningSize") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
          <tr>
            <td><span className="label">Make Ready</span><span className="val">{n("makeReadyCount") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Finish Count</span><span className="write-line">&nbsp;</span></td>
            <td><span className="label">First Pass Count</span><span className="val">{n("firstPassCount") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Final Press Count</span><span className="val">{n("finalPressCount") || <span className="write-line">&nbsp;</span>}</span></td>
            <td colSpan={2}><span className="label">Pressman Initials</span><span className="val">{f("pressmanInitials") || <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
          <tr>
            <td colSpan={6}><span className="label">Press Instructions / Notes</span><span className="val" style={{ minHeight: "24px" }}>{f("pressNotes") || ""}</span><span className="write-line">&nbsp;</span></td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BINDERY */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={2} className="section-head">Bindery Instructions</td></tr>
          <tr>
            <td style={{ width: "55%" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 0" }}>
                <span className="check-item"><span className="check">{check(b("binderyScore"))}</span> Score</span>
                <span className="check-item"><span className="check">{check(b("binderyPerf"))}</span> Perf</span>
                <span className="check-item"><span className="check">{check(b("binderyDrill"))}</span> Drill</span>
                <span className="check-item"><span className="check">{check(b("binderyPad"))}</span> Pad</span>
                <span className="check-item"><span className="check">{check(b("binderyFold"))}</span> Fold</span>
                <span className="check-item"><span className="check">{check(b("binderyCount"))}</span> Count</span>
                <span className="check-item"><span className="check">{check(b("binderyStitch"))}</span> Stitch</span>
                <span className="check-item"><span className="check">{check(b("binderyCollate"))}</span> Collates</span>
                <span className="check-item"><span className="check">{check(b("binderyPockets"))}</span> Pockets</span>
                <span className="check-item"><span className="check">{check(b("binderyGlue"))}</span> Glue</span>
                <span className="check-item"><span className="check">{check(b("binderyWrap"))}</span> Wrap</span>
                <span className="check-item"><span className="check">{check(!!f("binderyOther"))}</span> Other: {f("binderyOther") || "________"}</span>
              </div>
            </td>
            <td><span className="label">Bindery Notes</span><span className="val" style={{ minHeight: "20px" }}>{f("binderyNotes") || ""}</span><span className="write-line">&nbsp;</span></td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TRACKING GRID — multiple Date/Time rows for production */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={8} className="section-head">Production Tracking</td></tr>
          <tr style={{ fontSize: "8px", textAlign: "center" }}>
            <td><b>Department</b></td>
            <td><b>Date</b></td>
            <td><b>Time In</b></td>
            <td><b>Time Out</b></td>
            <td><b>Operator</b></td>
            <td><b>Qty Good</b></td>
            <td><b>Qty Waste</b></td>
            <td><b>Notes</b></td>
          </tr>
          {["Prepress", "Offset Press", "Digital Press", "Die Cutting", "Bindery", "Gluing/Folding", "QA", "Shipping"].map((dept) => (
            <tr key={dept} style={{ height: "22px" }}>
              <td style={{ fontSize: "9px", fontWeight: "bold" }}>{dept}</td>
              <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* DELIVERY & SAMPLES + AA CHARGES + VENDOR */}
      {/* ══════════════════════════════════════════════════════════ */}
      <table style={{ marginTop: "-1px" }}>
        <tbody>
          <tr><td colSpan={5} className="section-head">Delivery / Samples / Vendor</td></tr>
          <tr>
            <td><span className="label">Delivery QTY</span><span className="val">{n("deliveryQty") || n("quantity").toLocaleString()}</span></td>
            <td><span className="label">Packaging</span><span className="val">{f("deliveryPackaging") || <span className="write-line">&nbsp;</span>}</span></td>
            <td><span className="label">Deliver To</span><span className="val">{f("deliveryTo") || <span className="write-line">&nbsp;</span>}</span></td>
            <td>
              <span className="check-item"><span className="check">{check(b("samplesRequired"))}</span> Samples Req&apos;d</span><br/>
              <span className="label">To: {f("samplesTo") || "________"}</span>
            </td>
            <td><span className="label">AA Charges</span><span className="val">{n("aaCharges") ? `$${n("aaCharges")}` : <span className="write-line">&nbsp;</span>}</span></td>
          </tr>
          <tr>
            <td colSpan={5}><span className="label">Vendor Information</span><span className="val" style={{ minHeight: "18px" }}>{f("vendorInfo") || ""}</span><span className="write-line">&nbsp;</span></td>
          </tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* STAMP */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="stamp" style={{ marginTop: "6px" }}>
        ⚠ MUST PUT SAMPLES IN THIS JOB TICKET ⚠
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TEAR-OFF STRIP */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="tear" style={{ marginTop: "12px" }}></div>

      <div className="strip" style={{ marginTop: "8px", minHeight: "80px" }}>
        <table style={{ border: "none" }}>
          <tbody>
            <tr style={{ border: "none" }}>
              <td style={{ border: "none", width: "50%", verticalAlign: "top" }}>
                <div className="val-xl">{f("jobNumber")}</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", marginTop: "4px" }}>{f("name")}</div>
                <div style={{ fontSize: "11px", marginTop: "2px" }}>{f("companyName")} — Qty: {n("quantity").toLocaleString()}</div>
              </td>
              <td style={{ border: "none", width: "50%", verticalAlign: "top", textAlign: "right" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>Due: {job.dueDate ? formatDate(String(job.dueDate)) : "________"}</div>
                <div style={{ fontSize: "11px", marginTop: "2px" }}>{getStatusLabel(f("status"))}</div>
                <div style={{ fontSize: "9px", marginTop: "8px", color: "#666" }}>Est. Hours: {n("estimatedHours") || "____"}</div>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ textAlign: "center", fontSize: "8px", color: "#666", marginTop: "8px", letterSpacing: "1px" }}>
          STAMP HERE FOR NEW DIE — TEAR OFF AND PUT ON DARRIN&apos;S DESK AFTER APPROVAL
        </div>
      </div>
    </div>
  );
}
