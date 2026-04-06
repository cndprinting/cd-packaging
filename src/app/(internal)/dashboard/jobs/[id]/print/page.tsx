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
          setJob({
            ...j,
            companyName: j.companyName || j.order?.company?.name || "",
            orderNumber: j.orderNumber || j.order?.orderNumber || "",
          });
          setLoading(false);
          setTimeout(() => window.print(), 500);
          return;
        }
      } catch {}
      const found = demoJobs.find(j => j.id === jobId);
      if (found) setJob(found as unknown as Record<string, unknown>);
      setLoading(false);
      setTimeout(() => window.print(), 500);
    }
    load();
  }, [jobId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!job) return <div className="p-8 text-center">Job not found</div>;

  const f = (key: string) => (job[key] as string) || "";
  const b = (key: string) => Boolean(job[key]);
  const n = (key: string) => job[key] as number || 0;

  return (
    <div className="print-ticket max-w-[8.5in] mx-auto p-4 font-mono text-[11px] bg-white">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print-ticket { padding: 0.25in; }
          .no-print { display: none !important; }
          @page { size: letter; margin: 0.25in; }
        }
        .ticket-grid { display: grid; gap: 1px; background: #000; }
        .ticket-grid > div { background: #fff; padding: 2px 4px; }
        .ticket-header { font-size: 14px; font-weight: bold; }
        .field-label { font-size: 9px; color: #666; text-transform: uppercase; }
        .field-value { font-size: 11px; font-weight: 600; min-height: 16px; }
        .section-title { background: #1a1a1a; color: #fff; padding: 3px 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .checkbox { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #333; margin-right: 4px; vertical-align: middle; text-align: center; font-size: 9px; line-height: 10px; }
        .checkbox.checked { background: #333; color: #fff; }
        .tear-line { border-top: 2px dashed #999; margin: 8px 0; position: relative; }
        .tear-line::after { content: "✂ TEAR HERE"; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: white; padding: 0 8px; font-size: 8px; color: #999; }
      `}</style>

      {/* Back button - hidden on print */}
      <div className="no-print mb-4 flex items-center justify-between">
        <a href={`/dashboard/jobs/${jobId}`} className="text-blue-600 underline text-sm">← Back to Job</a>
        <button onClick={() => window.print()} className="bg-green-700 text-white px-4 py-2 rounded text-sm font-bold">🖨 Print Job Ticket</button>
      </div>

      {/* HEADER */}
      <div className="border-2 border-black p-2 mb-1">
        <div className="flex justify-between items-start">
          <div>
            <div className="ticket-header">{f("jobNumber")}</div>
            <div className="text-[9px] text-gray-500">C&D Printing — Job Ticket</div>
          </div>
          <div className="text-right">
            <div className="field-label">Job Type</div>
            <div className="field-value">
              <span className="checkbox {b('jobType') ? 'checked' : ''}">{f("jobType") === "NEW_ORDER" ? "✓" : ""}</span> New Order
              <span className="checkbox ml-2">{f("jobType") === "EXACT_REPRINT" ? "✓" : ""}</span> Exact Reprint
              <span className="checkbox ml-2">{f("jobType") === "REPRINT_WITH_CHANGES" ? "✓" : ""}</span> Reprint w/Changes
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMER & JOB INFO */}
      <div className="section-title">Customer & Job Information</div>
      <div className="border border-black">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1 w-1/4"><span className="field-label">Customer</span><br/><span className="field-value">{f("companyName")}</span></td>
              <td className="border border-gray-300 p-1 w-1/4"><span className="field-label">Contact</span><br/><span className="field-value">{f("contactName")}</span></td>
              <td className="border border-gray-300 p-1 w-1/4"><span className="field-label">Customer P.O.</span><br/><span className="field-value">{f("customerPO")}</span></td>
              <td className="border border-gray-300 p-1 w-1/4"><span className="field-label">Estimate #</span><br/><span className="field-value">{f("estimateNumber")}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1" colSpan={2}><span className="field-label">Job Title</span><br/><span className="field-value text-[13px]">{f("name")}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Quantity</span><br/><span className="field-value text-[14px] font-bold">{n("quantity").toLocaleString()}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label"># Pages</span><br/><span className="field-value">{n("numPages") || "—"}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1" colSpan={4}><span className="field-label">Job Description</span><br/><span className="field-value">{f("description") || "—"}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DATES & ASSIGNMENT */}
      <div className="section-title mt-1">Dates & Assignment</div>
      <div className="border border-black">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1"><span className="field-label">CSR</span><br/><span className="field-value">{f("csrName") || f("csr")}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Sales</span><br/><span className="field-value">{f("salesRepName") || f("salesRep")}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Rep</span><br/><span className="field-value">{f("repName")}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Due</span><br/><span className="field-value font-bold">{job.dueDate ? formatDate(String(job.dueDate)) : "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Status</span><br/><span className="field-value">{getStatusLabel(f("status"))}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1"><span className="field-label">Proof Date</span><br/><span className="field-value">{job.proofDate ? formatDate(String(job.proofDate)) : "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Entered</span><br/><span className="field-value">{job.enteredDate ? formatDate(String(job.enteredDate)) : job.createdAt ? formatDate(String(job.createdAt)) : "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Est. Hours</span><br/><span className="field-value">{n("estimatedHours") || "—"}</span></td>
              <td className="border border-gray-300 p-1" colSpan={2}>
                <span className="checkbox {b('pressCheck') ? 'checked' : ''}">{b("pressCheck") ? "✓" : ""}</span> Press Check
                <span className="checkbox ml-3 {b('ledInk') ? 'checked' : ''}">{b("ledInk") ? "✓" : ""}</span> LED Ink
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* STOCK & SPECS */}
      <div className="section-title mt-1">Stock & Specifications</div>
      <div className="border border-black">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1" colSpan={2}><span className="field-label">Stock Description</span><br/><span className="field-value">{f("stockDescription") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Blanket No.</span><br/><span className="field-value">{f("blanketNumber") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">DIE #</span><br/><span className="field-value">{f("dieNumber") || "—"}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1"><span className="field-label">Flat Size</span><br/><span className="field-value">{n("flatSizeWidth") || "—"} x {n("flatSizeHeight") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Finished Size</span><br/><span className="field-value">{n("finishedWidth") || "—"} x {n("finishedHeight") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Ink - Front / Back</span><br/><span className="field-value">{f("inkFront") || "—"} / {f("inkBack") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Varnish / Coating</span><br/><span className="field-value">{f("varnish") || "—"} / {f("coating") || "—"}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1" colSpan={4}>
                <span className="checkbox">{b("fscCertified") ? "✓" : ""}</span> FSC
                <span className="checkbox ml-3">{b("softCover") ? "✓" : ""}</span> Soft Cover
                <span className="checkbox ml-3">{b("plusCover") ? "✓" : ""}</span> Plus Cover
                <span className="checkbox ml-3">{b("hasBleeds") ? "✓" : ""}</span> Bleeds
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PRESS INFO */}
      <div className="section-title mt-1">Press Information</div>
      <div className="border border-black">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1"><span className="field-label">Press</span><br/><span className="field-value">{f("pressAssignment") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Format</span><br/><span className="field-value">{f("pressFormat") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Imposition</span><br/><span className="field-value">{f("imposition") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label"># Up</span><br/><span className="field-value">{n("numberUp") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Running Size</span><br/><span className="field-value">{f("runningSize") || "—"}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1"><span className="field-label">Make Ready</span><br/><span className="field-value">{n("makeReadyCount") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">First Pass</span><br/><span className="field-value">{n("firstPassCount") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Final Count</span><br/><span className="field-value">{n("finalPressCount") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Pressman</span><br/><span className="field-value">{f("pressmanInitials") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Press Notes</span><br/><span className="field-value">{f("pressNotes") || "—"}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* BINDERY */}
      <div className="section-title mt-1">Bindery Instructions</div>
      <div className="border border-black p-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="checkbox">{b("binderyScore") ? "✓" : ""}</span> Score</span>
          <span><span className="checkbox">{b("binderyPerf") ? "✓" : ""}</span> Perf</span>
          <span><span className="checkbox">{b("binderyDrill") ? "✓" : ""}</span> Drill</span>
          <span><span className="checkbox">{b("binderyPad") ? "✓" : ""}</span> Pad</span>
          <span><span className="checkbox">{b("binderyFold") ? "✓" : ""}</span> Fold</span>
          <span><span className="checkbox">{b("binderyCount") ? "✓" : ""}</span> Count</span>
          <span><span className="checkbox">{b("binderyStitch") ? "✓" : ""}</span> Stitch</span>
          <span><span className="checkbox">{b("binderyCollate") ? "✓" : ""}</span> Collate</span>
          <span><span className="checkbox">{b("binderyPockets") ? "✓" : ""}</span> Pockets</span>
          <span><span className="checkbox">{b("binderyGlue") ? "✓" : ""}</span> Glue</span>
          <span><span className="checkbox">{b("binderyWrap") ? "✓" : ""}</span> Wrap</span>
          <span><span className="checkbox">{b("binderyOther") ? "✓" : ""}</span> Other: {f("binderyOther")}</span>
        </div>
        {f("binderyNotes") && <div className="mt-1 text-[10px]"><strong>Notes:</strong> {f("binderyNotes")}</div>}
      </div>

      {/* DELIVERY & SAMPLES */}
      <div className="section-title mt-1">Delivery & Samples</div>
      <div className="border border-black">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1"><span className="field-label">Delivery QTY</span><br/><span className="field-value">{n("deliveryQty") || n("quantity").toLocaleString()}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Packaging</span><br/><span className="field-value">{f("deliveryPackaging") || "—"}</span></td>
              <td className="border border-gray-300 p-1"><span className="field-label">Deliver To</span><br/><span className="field-value">{f("deliveryTo") || "—"}</span></td>
              <td className="border border-gray-300 p-1">
                <span className="checkbox">{b("samplesRequired") ? "✓" : ""}</span> Samples Required<br/>
                <span className="field-label">To:</span> {f("samplesTo") || "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* MUST PUT SAMPLES stamp */}
      <div className="border-2 border-black mt-1 p-2 text-center">
        <div className="font-bold text-[13px]">⚠ MUST PUT SAMPLES IN THIS JOB TICKET ⚠</div>
      </div>

      {/* ═══ TEAR LINE ═══ */}
      <div className="tear-line mt-4"></div>

      {/* TEAR-OFF STRIP for Darrin's board */}
      <div className="border-2 border-black p-3 mt-2">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[18px] font-bold">{f("jobNumber")}</div>
            <div className="text-[12px]">{f("name")}</div>
            <div className="text-[10px] text-gray-600">{f("companyName")} — Qty: {n("quantity").toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-bold">Due: {job.dueDate ? formatDate(String(job.dueDate)) : "—"}</div>
            <div className="text-[10px]">{getStatusLabel(f("status"))}</div>
          </div>
        </div>
        <div className="mt-2 text-[9px] text-gray-500 text-center">
          STAMP HERE FOR NEW DIE — TEAR OFF AND PUT ON DARRIN&apos;S DESK AFTER APPROVAL
        </div>
      </div>
    </div>
  );
}
