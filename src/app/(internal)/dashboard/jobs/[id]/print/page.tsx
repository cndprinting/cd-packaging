"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function PrintJobTicketPage() {
  const params = useParams();
  const jobId = params.id as string;
  const [job, setJob] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [pressRuns, setPressRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [jobRes, linesRes] = await Promise.all([
          fetch(`/api/jobs/${jobId}`),
          fetch(`/api/jobs/${jobId}/lines`),
        ]);
        const jobData = await jobRes.json();
        const linesData = await linesRes.json();

        if (jobRes.ok && jobData.job) {
          const j = jobData.job;
          setJob({
            ...j,
            companyName: j.companyName || j.order?.company?.name || "",
            companyAddress: j.order?.company?.address || "",
            companyCity: j.order?.company?.city || "",
            companyState: j.order?.company?.state || "",
            companyZip: j.order?.company?.zip || "",
            companyPhone: j.order?.company?.phone || "",
            orderNumber: j.orderNumber || j.order?.orderNumber || "",
            poNumber: j.customerPO || j.order?.poNumber || "",
          });
          // Merge lineItems: prefer lines endpoint, fall back to job include
          const li = (linesData.lineItems?.length ? linesData.lineItems : j.lineItems) || [];
          const pr = (linesData.pressRuns?.length ? linesData.pressRuns : j.pressRuns) || [];
          setLineItems(li);
          setPressRuns(pr);
        }
      } catch (e) {
        console.error("Failed to load job:", e);
      }
      setLoading(false);
    }
    load();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!job) return <div className="p-8 text-center">Job not found</div>;

  // Helpers
  const f = (key: string) => (job[key] as string) || "";
  const b = (key: string) => Boolean(job[key]);
  const n = (key: string) => (job[key] as number) || 0;
  const radio = (selected: boolean) => (selected ? "\u25C9" : "\u25CB");
  const check = (val: boolean) => (val ? "\u2611" : "\u2610");
  const blank = (width?: string) => (
    <span style={{ display: "inline-block", borderBottom: "1px solid #000", minWidth: width || "80px" }}>
      &nbsp;
    </span>
  );

  // Pad line items and press runs to minimum rows for the form
  const MIN_LINE_ROWS = 6;
  const MIN_PRESS_ROWS = 6;
  const displayLineItems = [
    ...lineItems,
    ...Array(Math.max(0, MIN_LINE_ROWS - lineItems.length)).fill(null),
  ];
  const displayPressRuns = [
    ...pressRuns,
    ...Array(Math.max(0, MIN_PRESS_ROWS - pressRuns.length)).fill(null),
  ];

  // Purchases for stock section
  const purchases = job.purchases || [];

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { size: letter portrait; margin: 0.25in; }
        }
        .print-page {
          width: 8in;
          margin: 0 auto;
          font-family: "Courier New", Courier, monospace;
          font-size: 9px;
          color: #000;
          line-height: 1.3;
        }
        table { width: 100%; border-collapse: collapse; }
        td, th {
          border: 1px solid #000;
          padding: 2px 4px;
          vertical-align: top;
          font-size: 9px;
        }
        th {
          font-size: 8px;
          font-weight: bold;
          text-align: center;
          background: #eee;
        }
        .lbl {
          font-size: 7px;
          text-transform: uppercase;
          color: #333;
          letter-spacing: 0.3px;
          display: block;
          line-height: 1.1;
        }
        .val { font-size: 11px; font-weight: bold; display: block; min-height: 14px; }
        .val-lg { font-size: 14px; font-weight: bold; display: block; min-height: 16px; }
        .val-xl { font-size: 22px; font-weight: bold; display: block; }
        .val-xxl { font-size: 30px; font-weight: bold; display: block; }
        .section-hd {
          background: #000;
          color: #fff;
          font-size: 8px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          padding: 3px 6px;
          text-align: center;
        }
        .wr { border-bottom: 1px solid #999; min-height: 16px; display: block; }
        .wr-box { border: 1px solid #999; min-height: 40px; width: 100%; display: block; padding: 2px; }
        .chk { font-size: 12px; margin-right: 1px; }
        .chk-item { display: inline-block; margin-right: 8px; font-size: 9px; white-space: nowrap; }
        .radio-item { display: inline-block; margin-right: 10px; font-size: 9px; white-space: nowrap; }
        .tear {
          border-top: 2px dashed #666;
          margin: 6px 0;
          position: relative;
        }
        .tear::after {
          content: "\\2702  CUT HERE \\2014 TEAR OFF FOR TRACKING BOARD";
          position: absolute;
          top: -7px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 0 10px;
          font-size: 7px;
          color: #666;
          letter-spacing: 1px;
        }
        .strip {
          border: 2px solid #000;
          padding: 6px 10px;
        }
        .mt { margin-top: -1px; }
      `}</style>

      {/* ── NO-PRINT CONTROLS ── */}
      <div
        className="no-print"
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "sans-serif",
          borderBottom: "1px solid #ddd",
          marginBottom: "8px",
        }}
      >
        <a
          href={`/dashboard/jobs/${jobId}`}
          style={{ color: "#15803d", fontSize: "14px", textDecoration: "none" }}
        >
          &larr; Back to Job
        </a>
        <button
          onClick={() => window.print()}
          style={{
            background: "#15803d",
            color: "#fff",
            padding: "10px 24px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
          }}
        >
          Print Job Ticket
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 1: HEADER                                          */}
      {/* ════════════════════════════════════════════════════════ */}
      <table>
        <tbody>
          <tr>
            <td style={{ width: "22%" }}>
              <span className="lbl">Job Ticket #</span>
              <span className="val-xl">{f("jobNumber")}</span>
            </td>
            <td style={{ width: "15%" }}>
              <span className="lbl">Last Job #</span>
              <span className="val">{f("lastJobNumber") || blank()}</span>
            </td>
            <td style={{ width: "15%" }}>
              <span className="lbl">Rep Job #</span>
              <span className="val">{f("repName") || blank()}</span>
            </td>
            <td style={{ width: "20%" }}>
              <span className="lbl">Entered</span>
              <span className="val">
                {job.enteredDate
                  ? formatDate(String(job.enteredDate))
                  : job.createdAt
                    ? formatDate(String(job.createdAt))
                    : ""}
              </span>
            </td>
            <td style={{ width: "20%" }}>
              <span className="lbl">Proof Date</span>
              <span className="val">
                {job.proofDate ? formatDate(String(job.proofDate)) : blank()}
              </span>
            </td>
            <td style={{ width: "8%" }}>
              <span className="lbl">Due Date</span>
              <span className="val" style={{ fontSize: "10px", color: "#c00" }}>
                {job.dueDate ? formatDate(String(job.dueDate)) : ""}
              </span>
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ padding: "3px 6px" }}>
              <span className="radio-item">
                {radio(f("jobType") === "NEW_ORDER")} New Order
              </span>
              <span className="radio-item">
                {radio(f("jobType") === "EXACT_REPRINT")} Exact Reprint
              </span>
              <span className="radio-item">
                {radio(f("jobType") === "REPRINT_WITH_CHANGES")} Reprint With Changes
              </span>
              <span className="radio-item">
                {radio(f("jobType") === "REPRINT_NEW_FILE")} Reprint New File Supplied
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 2: CUSTOMER INFO                                   */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <tbody>
          <tr>
            <td colSpan={6} className="section-hd">
              Customer Information
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ width: "50%" }}>
              <span className="lbl">Customer</span>
              <span className="val-lg">{f("companyName")}</span>
            </td>
            <td colSpan={2} style={{ width: "30%" }}>
              <span className="lbl">Contact</span>
              <span className="val">{f("contactName") || blank()}</span>
            </td>
            <td style={{ width: "20%" }}>
              <span className="lbl">Estimate No.</span>
              <span className="val">{f("estimateNumber") || blank()}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={3}>
              <span className="lbl">Address</span>
              <span className="val">{f("companyAddress") || blank("200px")}</span>
            </td>
            <td colSpan={3}>
              <span className="lbl">Phone</span>
              <span className="val">{f("companyPhone") || blank()}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="lbl">City</span>
              <span className="val">{f("companyCity") || blank("60px")}</span>
            </td>
            <td>
              <span className="lbl">State</span>
              <span className="val">{f("companyState") || blank("30px")}</span>
            </td>
            <td>
              <span className="lbl">Zip</span>
              <span className="val">{f("companyZip") || blank("40px")}</span>
            </td>
            <td>
              <span className="lbl">Fax</span>
              <span className="val">{blank("60px")}</span>
            </td>
            <td>
              <span className="lbl">Customer #</span>
              <span className="val">{blank("50px")}</span>
            </td>
            <td>
              <span className="lbl">Customer P.O.</span>
              <span className="val">{f("poNumber") || blank("60px")}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <span className="lbl"># Pages</span>
              <span className="val">{n("numPages") || blank("30px")}</span>
            </td>
            <td colSpan={2}>
              <span className="radio-item">
                {radio(b("softCover"))} Self Cover
              </span>
              <span className="radio-item">
                {radio(b("plusCover"))} Plus Cover
              </span>
            </td>
            <td colSpan={2}>
              <span className="lbl">Bleeds</span>
              <span className="radio-item">
                {radio(b("hasBleeds"))} Yes
              </span>
              <span className="radio-item">
                {radio(!b("hasBleeds"))} No
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 3: JOB TITLE                                       */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <tbody>
          <tr>
            <td
              style={{
                textAlign: "center",
                padding: "4px 6px",
                background: "#f0f0f0",
              }}
            >
              <span className="lbl">Job Title</span>
              <span className="val-xl" style={{ fontSize: "18px" }}>
                {f("name")}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 4: JOB DESCRIPTION TABLE (multiple rows)           */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <thead>
          <tr>
            <th colSpan={6} className="section-hd">
              Job Description
            </th>
          </tr>
          <tr>
            <th style={{ width: "12%" }}>Quantity</th>
            <th style={{ width: "30%" }}>Job Description</th>
            <th style={{ width: "14%" }}>Flat Size</th>
            <th style={{ width: "20%" }}>Finished Size (W x H)</th>
            <th style={{ width: "8%" }}>X/X</th>
            <th style={{ width: "16%" }}>Ink - Varnish</th>
          </tr>
        </thead>
        <tbody>
          {displayLineItems.map((item: any, idx: number) => (
            <tr key={idx} style={{ height: "20px" }}>
              <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>
                {item ? item.quantity?.toLocaleString() : ""}
              </td>
              <td style={{ fontSize: "9px" }}>{item ? item.description : ""}</td>
              <td style={{ textAlign: "center" }}>{item ? item.flatSize || "" : ""}</td>
              <td style={{ textAlign: "center" }}>
                {item && item.finishedWidth
                  ? `${item.finishedWidth} x ${item.finishedHeight || ""}`
                  : ""}
              </td>
              <td style={{ textAlign: "center" }}>{item ? item.inkSpec || "" : ""}</td>
              <td>{item ? (f("varnish") && idx === 0 ? f("varnish") : "") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 5: PROOFS / MAILS / DROP / DIE / BLANKET           */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <tbody>
          <tr>
            <td colSpan={6} className="section-hd">
              Proofs / Mailing / Die / Blanket
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <span style={{ fontWeight: "bold", fontSize: "8px" }}>PROOFS:</span>{" "}
              <span style={{ fontSize: "9px" }}>
                Web{blank("30px")} Sh.{blank("30px")} Epson{blank("30px")}
              </span>
            </td>
            <td>
              <span className="lbl">Mails</span>
              <span className="val">{blank("40px")}</span>
            </td>
            <td>
              <span className="lbl">QTY</span>
              <span className="val">{blank("40px")}</span>
            </td>
            <td>
              <span className="lbl">Drop City</span>
              <span className="val">{blank("60px")}</span>
            </td>
            <td>
              <span className="lbl">RC-</span>
              <span className="val">{blank("40px")}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <span className="lbl">DIE #</span>
              <span className="val">{f("dieNumber") || blank("80px")}</span>
            </td>
            <td colSpan={2}>
              <span className="lbl">Blanket No.</span>
              <span className="val">{f("blanketNumber") || blank("80px")}</span>
            </td>
            <td colSpan={2}>
              <span className="chk-item">
                <span className="chk">{check(b("pressCheck"))}</span> Press Check
              </span>
              <span className="chk-item">
                <span className="chk">{check(b("ledInk"))}</span> LED Ink
              </span>
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ minHeight: "36px" }}>
              <span className="lbl">Notes</span>
              <span className="val" style={{ minHeight: "28px", whiteSpace: "pre-wrap" }}>
                {f("description") || ""}
              </span>
              {!f("description") && <span className="wr">&nbsp;</span>}
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ minHeight: "20px" }}>
              <span className="val" style={{ minHeight: "14px" }}>
                {f("pressNotes") || ""}
              </span>
              {!f("pressNotes") && <span className="wr">&nbsp;</span>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 6: STOCK INFO                                      */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <thead>
          <tr>
            <th colSpan={7} className="section-hd">
              Stock Information
            </th>
          </tr>
          <tr>
            <th style={{ width: "10%" }}>Size</th>
            <th style={{ width: "12%" }}>Quantity</th>
            <th style={{ width: "30%" }}>Stock Description</th>
            <th style={{ width: "6%" }}>FSC</th>
            <th style={{ width: "14%" }}>AA Charges</th>
            <th style={{ width: "14%" }}>Date / Time</th>
            <th style={{ width: "14%" }}>Vendor Info</th>
          </tr>
        </thead>
        <tbody>
          {/* Main stock row from job fields */}
          <tr style={{ height: "22px" }}>
            <td style={{ textAlign: "center", fontWeight: "bold" }}>
              {n("flatSizeWidth")
                ? `${n("flatSizeWidth")}X${n("flatSizeHeight")}`
                : ""}
            </td>
            <td style={{ textAlign: "center", fontWeight: "bold" }}>
              {n("quantity") ? n("quantity").toLocaleString() : ""}
            </td>
            <td style={{ fontWeight: "bold" }}>
              {f("stockDescription")}
            </td>
            <td style={{ textAlign: "center" }}>
              {b("fscCertified") ? check(true) : check(false)}
            </td>
            <td style={{ textAlign: "center" }}>
              {n("aaCharges") ? `$${n("aaCharges").toLocaleString()}` : ""}
            </td>
            <td>&nbsp;</td>
            <td style={{ fontSize: "8px" }}>{f("vendorInfo")}</td>
          </tr>
          {/* Rows from purchases */}
          {purchases.map((p: any, idx: number) => (
            <tr key={idx} style={{ height: "20px" }}>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td style={{ fontSize: "8px" }}>{p.description}</td>
              <td>&nbsp;</td>
              <td style={{ textAlign: "center", fontSize: "8px" }}>
                {p.estimatedCost ? `$${p.estimatedCost.toLocaleString()}` : ""}
              </td>
              <td style={{ fontSize: "8px" }}>
                {p.orderedDate ? formatDate(p.orderedDate) : ""}
              </td>
              <td style={{ fontSize: "8px" }}>{p.vendor || ""}</td>
            </tr>
          ))}
          {/* Empty rows to fill space */}
          {Array(Math.max(0, 3 - purchases.length))
            .fill(null)
            .map((_, idx) => (
              <tr key={`empty-stock-${idx}`} style={{ height: "20px" }}>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 7: SPECIAL INSTRUCTIONS                            */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <tbody>
          <tr>
            <td className="section-hd">Special Instructions</td>
          </tr>
          <tr>
            <td
              style={{
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "12px",
                minHeight: "30px",
                padding: "6px",
              }}
            >
              {f("description") || ""}
              {!f("description") && (
                <>
                  <span className="wr">&nbsp;</span>
                  <span className="wr" style={{ marginTop: "4px" }}>
                    &nbsp;
                  </span>
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 8: PRESS TABLE (multiple rows)                     */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <thead>
          <tr>
            <th colSpan={11} className="section-hd">
              Press Information
            </th>
          </tr>
          <tr>
            <th style={{ width: "7%" }}>Press</th>
            <th style={{ width: "10%" }}>Form# / Info</th>
            <th style={{ width: "9%" }}>Finish Count</th>
            <th style={{ width: "9%" }}>Make Ready</th>
            <th style={{ width: "10%" }}>Running Size</th>
            <th style={{ width: "10%" }}>Imposition</th>
            <th style={{ width: "6%" }}># UP</th>
            <th style={{ width: "6%" }}>X/X</th>
            <th style={{ width: "11%" }}>First Pass Count</th>
            <th style={{ width: "11%" }}>Final Press Count</th>
            <th style={{ width: "11%" }}>Pressman Initials</th>
          </tr>
        </thead>
        <tbody>
          {displayPressRuns.map((run: any, idx: number) => (
            <tr key={idx} style={{ height: "20px" }}>
              <td style={{ textAlign: "center", fontWeight: "bold" }}>
                {run ? run.press : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run ? run.formNumber || "" : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run && run.finishCount ? run.finishCount.toLocaleString() : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run && run.makeReady ? run.makeReady.toLocaleString() : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run ? run.runningSize || "" : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run ? run.imposition || "" : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run && run.numberUp ? run.numberUp : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run ? run.inkSpec || "" : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run && run.firstPassCount
                  ? run.firstPassCount.toLocaleString()
                  : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run && run.finalPressCount
                  ? run.finalPressCount.toLocaleString()
                  : ""}
              </td>
              <td style={{ textAlign: "center" }}>
                {run ? run.pressmanInitials || "" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ROW 9 & 10: PRESS INSTRUCTIONS + BINDERY               */}
      {/* ════════════════════════════════════════════════════════ */}
      <table className="mt">
        <tbody>
          <tr>
            <td style={{ width: "50%" }} className="section-hd">
              Press Instructions
            </td>
            <td style={{ width: "50%" }} className="section-hd">
              Bindery Instructions
            </td>
          </tr>
          <tr>
            <td style={{ verticalAlign: "top", minHeight: "80px" }}>
              <div className="wr-box" style={{ minHeight: "90px" }}>
                {f("pressNotes") || ""}
              </div>
            </td>
            <td style={{ verticalAlign: "top" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "2px 0",
                  marginBottom: "4px",
                }}
              >
                <span className="chk-item">
                  <span className="chk">{check(b("binderyScore"))}</span> Score
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyPerf"))}</span> Perf
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyDrill"))}</span> Drill
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyPad"))}</span> Pad
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyFold"))}</span> Fold
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyCount"))}</span> Count
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyStitch"))}</span> Stitch
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyCollate"))}</span> Collates
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyPockets"))}</span> Pockets
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyGlue"))}</span> Glue
                </span>
                <span className="chk-item">
                  <span className="chk">{check(b("binderyWrap"))}</span> Wrap
                </span>
                <span className="chk-item">
                  <span className="chk">{check(!!f("binderyOther"))}</span> Other:{" "}
                  {f("binderyOther") || "________"}
                </span>
              </div>
              <span className="lbl">Notes</span>
              <div className="wr-box" style={{ minHeight: "40px" }}>
                {f("binderyNotes") || ""}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ════════════════════════════════════════════════════════ */}
      {/* TEAR LINE                                              */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="tear" style={{ marginTop: "10px" }}></div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* TEAR-OFF STRIP                                         */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="strip" style={{ marginTop: "6px" }}>
        <table style={{ border: "none" }}>
          <tbody>
            <tr style={{ border: "none" }}>
              <td
                style={{
                  border: "none",
                  width: "25%",
                  verticalAlign: "top",
                }}
              >
                <span className="lbl">Job #</span>
                <span className="val-xxl">{f("jobNumber")}</span>
              </td>
              <td
                style={{
                  border: "none",
                  width: "35%",
                  verticalAlign: "top",
                }}
              >
                <span className="lbl">Job Title</span>
                <span className="val-lg">{f("name")}</span>
              </td>
              <td
                style={{
                  border: "none",
                  width: "20%",
                  verticalAlign: "top",
                }}
              >
                <span className="lbl">Customer</span>
                <span className="val">{f("companyName")}</span>
              </td>
              <td
                style={{
                  border: "none",
                  width: "20%",
                  verticalAlign: "top",
                  textAlign: "right",
                }}
              >
                <span className="lbl">Due Date</span>
                <span className="val-lg" style={{ color: "#c00" }}>
                  {job.dueDate ? formatDate(String(job.dueDate)) : "________"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          style={{
            textAlign: "center",
            fontSize: "8px",
            fontWeight: "bold",
            color: "#333",
            marginTop: "6px",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          STAMP HERE FOR NEW DIE &mdash; TEAR OFF AND PUT ON DARRIN&apos;S DESK
          AFTER APPROVAL
        </div>
      </div>
    </div>
  );
}
