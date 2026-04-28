"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Detailed Estimate Summary — Mary's request (4/28/26).
// Models the C&D internal estimate printout with three-column cost
// breakdowns by section (Prep / Press / Bindery), markup matrix, and
// commission. All data pulled from the quote's specs JSON (no new
// schema needed).

interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
  contactName?: string | null;
  productName: string;
  description?: string | null;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  status: string;
  createdAt: string;
  validUntil?: string;
  specs?: string | null;
  notes?: string | null;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtNum = (n: number, dp = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function DetailedEstimatePage() {
  const params = useParams();
  const id = params.id as string;
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsedSpecs, setParsedSpecs] = useState<any>({});

  useEffect(() => {
    fetch(`/api/quotes?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        const q = (d.quotes || [])[0];
        if (q) {
          setQuote(q);
          try {
            setParsedSpecs(q.specs ? JSON.parse(q.specs) : {});
          } catch {
            setParsedSpecs({});
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }
  if (!quote) {
    return <div className="p-12 text-center text-gray-500">Quote not found</div>;
  }

  const data = parsedSpecs.estimateData || {};
  const totals = parsedSpecs.estimateTotals || {};
  const jt = parsedSpecs.jobTicket || {};

  // ─── Derived sheet/run fields (best-effort from estimateData) ─────
  const flatW = Number(data.sheetWidth) || 0;
  const flatH = Number(data.sheetHeight) || 0;
  const finW = Number(data.finishedWidth) || 0;
  const finH = Number(data.finishedHeight) || 0;
  const numberUp = Number(data.numberUp) || 1;
  const numPages = Number(data.numPages) || 0;
  const inkF = Number(data.inkColorsFront) || 0;
  const inkB = Number(data.inkColorsBack) || 0;
  const totalColors = inkF + inkB;
  const qty = Number(data.quantity) || quote.quantity || 0;
  const versions = Number(data.versions) || 1;
  const mrSheets = Number(data.makeReadySheets) || 0;
  const wasteFactor = Number(data.wasteFactor) || 0;

  // Sheets through press (rough — for display)
  const sheetsThroughPress = Math.ceil((qty * versions) / Math.max(numberUp, 1)) + mrSheets;

  // Press info
  const pressName = parsedSpecs.pressName || data.selectedPressId || "—";
  const pressConfig = parsedSpecs.pressConfig || data.selectedConfigId || "—";

  // Costs from totals
  const paperCost = Number(totals.materialsCost ?? data.paperCostPer1000 ?? 0);
  const inkCost = Number(totals.inkCost ?? 0);
  const platesCost = Number(totals.toolingCost ?? 0);
  const finishingCost = Number(totals.finishingCost ?? 0);
  const makeReadyCost = Number(totals.makeReadyCost ?? 0);
  const laborCost = Number(totals.laborCost ?? 0);
  const shippingCost = Number(totals.shippingCost ?? 0);
  const total = Number(totals.total ?? quote.totalPrice ?? 0);
  const markupAmount = Number(totals.markupAmount ?? 0);
  const commissionAmount = Number(totals.commissionAmount ?? 0);
  const subtotalCost = Number(totals.subtotalCost ?? (paperCost + inkCost + platesCost + finishingCost + makeReadyCost + laborCost + shippingCost));

  // Markup percentages from form
  const markupPaper = Number(data.markupPaper ?? 22);
  const markupMaterial = Number(data.markupMaterial ?? 22);
  const markupLabor = Number(data.markupLabor ?? 63);
  const markupOutside = Number(data.markupOutside ?? 30);
  const commissionPct = Number(data.commissionPercent ?? 10);

  // Section breakdowns (best-effort decomposition for display)
  const prepHours = Number(data.prepressTime) || 0;
  const prepRate = Number(data.prepressRate) || 0;
  const prepCost = prepHours * prepRate;

  const pressRunHours = Number(data.pressRunTime) || 0;
  const pressOpRate = Number(data.pressOperatorRate) || 0;
  const setupHours = Number(data.setupTime) || 0;
  const pressCost = (pressRunHours + setupHours) * pressOpRate;

  // Outside / finishing
  const outsideTotal = ((data.outsidePurchases || []) as any[]).reduce(
    (s: number, op: any) => s + (Number(op.cost) || 0),
    0
  );

  // Markup amounts (recompute from inputs for the table)
  const paperMarkupAmt = paperCost * (markupPaper / 100);
  const materialMarkupAmt = (inkCost + platesCost) * (markupMaterial / 100);
  const outsideMarkupAmt = outsideTotal * (markupOutside / 100);
  const laborMarkupAmt = laborCost * (markupLabor / 100);

  return (
    <div className="bg-white">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 9.5pt; }
          .detailed-page { padding: 0 !important; }
          @page { size: letter; margin: 0.5in; }
        }
        .det-section-header {
          background: #f3f4f6;
          font-weight: 700;
          padding: 4px 8px;
          margin-top: 12px;
          margin-bottom: 4px;
          border-top: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          font-size: 10pt;
          letter-spacing: 0.5px;
        }
        .det-row {
          display: grid;
          grid-template-columns: 1.5fr 1.4fr 0.8fr;
          gap: 8px;
          padding: 2px 8px;
          font-size: 9.5pt;
          border-bottom: 1px dotted #e5e7eb;
        }
        .det-row .label { font-weight: 500; }
        .det-row .secondary { color: #555; font-size: 9pt; }
        .det-row .amt { text-align: right; font-variant-numeric: tabular-nums; }
        .det-totalrow {
          display: grid;
          grid-template-columns: 1.5fr 1.4fr 0.8fr;
          gap: 8px;
          padding: 4px 8px;
          font-weight: 700;
          background: #fef3c7;
          border-top: 2px solid #b45309;
          border-bottom: 1px solid #b45309;
          font-size: 10pt;
        }
        .det-totalrow .amt { text-align: right; font-variant-numeric: tabular-nums; }
      `}</style>

      <div className="detailed-page max-w-5xl mx-auto p-8 font-mono text-sm">
        {/* Print toolbar */}
        <div className="no-print flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <Link href={`/dashboard/quotes`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Back to Quotes
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"
          >
            <Printer className="h-4 w-4" /> Print Detailed Estimate
          </button>
        </div>

        {/* Header — matches the C&D internal printout */}
        <div className="border-b-2 border-black pb-2 mb-3">
          <p className="text-xs font-bold">C&amp;D Printing Co. Estimate No. {quote.quoteNumber}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-4">
          <div>
            <p>Customer {quote.customerName} - 0</p>
            <p>Contact {quote.contactName || "—"}</p>
            <p>Sold by {data.salesRepName || data.salesRep || "—"}</p>
          </div>
          <div className="text-right">
            <p>
              Date {new Date(quote.createdAt).toLocaleDateString()}{" "}
              <span className="ml-2">Time {new Date(quote.createdAt).toLocaleTimeString()}</span>
            </p>
            <p>Phone {data.contactPhone || "—"}</p>
            <p>Estimator {data.csrName || "—"}</p>
          </div>
        </div>

        {/* Quantity / Description / Final Trim Size */}
        <table className="w-full border-y border-black text-xs my-2">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-1 px-2 font-bold w-32">Quantity</th>
              <th className="text-left py-1 px-2 font-bold">Description</th>
              <th className="text-left py-1 px-2 font-bold w-40">Final Trim Size</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-2">{fmtInt(qty)}</td>
              <td className="py-2 px-2">{quote.productName} — {finW} x {finH} - {inkF}/{inkB}</td>
              <td className="py-2 px-2">{finW} x {finH}</td>
            </tr>
          </tbody>
        </table>

        {/* Pages / Part info */}
        <p className="text-xs my-2">
          Pages ({numPages || "—"}) in Part 1 of 1 {numPages ? `${numPages}pg` : ""} {data.softCover ? "S/C" : data.plusCover ? "+C" : ""} {finW && finH ? `${finW} x ${finH}` : ""}
        </p>

        {/* Paper row */}
        <div className="text-[10px] grid grid-cols-9 gap-1 border-y border-gray-300 py-1 mb-2">
          <div><strong>Quantity</strong><br/>{fmtInt(sheetsThroughPress)} shts</div>
          <div><strong>Brand</strong><br/>{data.paperBrand || "—"}</div>
          <div><strong>Color</strong><br/>{data.paperColor || "—"}</div>
          <div><strong>Finish</strong><br/>{data.paperFinish || "—"}</div>
          <div><strong>Weight</strong><br/>{data.paperBasisWeight || "—"} lb</div>
          <div><strong>Inv</strong><br/>{data.sheetsPerCarton || "—"}</div>
          <div><strong>Type</strong><br/>{data.paperType || "—"}</div>
          <div><strong>Parent</strong><br/>{data.parentSheetWidth || "—"} x {data.parentSheetHeight || "—"}</div>
          <div><strong>Press / Pages</strong><br/>{flatW} x {flatH} / {numPages}</div>
        </div>

        {/* Run summary */}
        <div className="border border-double border-black p-2 my-3 text-xs leading-relaxed">
          <p>
            <strong>Run</strong> 1 — {numberUp} pages per side for {Math.max(1, Math.ceil(numPages / Math.max(numberUp * 2, 1)))} sigs SHEETWISE on the <strong>{pressName}</strong>
          </p>
          <p>
            <strong>Use</strong> {fmtInt(sheetsThroughPress)} sheets of {flatW} x {flatH}
            {wasteFactor > 0 ? `   No. of Wash and Makereadys ${Math.round(wasteFactor)}` : ""}
          </p>
          <p>
            Make ready {fmtInt(mrSheets)} · Press waste {fmtInt(Math.round(sheetsThroughPress * 0.025))} · Bind waste 200 · Minimum count {fmtInt(qty)}
          </p>
        </div>

        {/* Outside Purchases */}
        {((data.outsidePurchases || []) as any[]).length > 0 && (
          <>
            <p className="text-xs font-bold mt-3">Outside Purchases:</p>
            <div className="text-xs space-y-0.5">
              {((data.outsidePurchases || []) as any[]).map((op: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <span>{op.vendor || "Vendor"} — {op.operation || op.description}</span>
                  <span className="text-gray-600">{op.pricingMode === "per_unit" ? `${op.unitCount} × $${op.unitAmount}` : "Lump sum"}</span>
                  <span className="text-right">{fmtMoney(Number(op.cost) || 0)}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-300 font-semibold">
                <span>Outside Total</span>
                <span></span>
                <span className="text-right">{fmtMoney(outsideTotal)}</span>
              </div>
            </div>
          </>
        )}

        {/* ─────────────── Page 2: Cost breakdown ─────────────── */}
        <div className="page-break-before mt-8">
          <div className="border-b-2 border-black pb-2 mb-3">
            <p className="text-xs font-bold">C&amp;D Printing Co. Estimate No. {quote.quoteNumber} — Cost Breakdown</p>
          </div>

          <p className="text-xs mb-2">
            Use {fmtInt(sheetsThroughPress)} Sheets {flatW} x {flatH} · {data.paperBasisWeight || "—"} LB ·{" "}
            <strong>Press Sheet Size {flatW} x {flatH}</strong>
          </p>
          <p className="text-xs mb-3">
            {data.paperBrand || "—"} · {data.paperColor || "—"} · {data.paperFinish || "—"}
          </p>

          {/* Paper handling */}
          <div className="det-row">
            <div className="label">Paper handling</div>
            <div className="secondary">Paper Cost {fmtMoney(paperCost)}</div>
            <div className="amt">{fmtMoney(paperCost + 5)}</div>
          </div>

          {/* PREP */}
          <div className="det-section-header">[ Prep ]</div>
          <div className="det-row">
            <div className="label">Type Output</div>
            <div className="secondary">{prepHours.toFixed(1)} Hrs</div>
            <div className="amt">{fmtMoney(prepCost * 0.1)}</div>
          </div>
          <div className="det-row">
            <div className="label">Proof</div>
            <div className="secondary">
              Proof material{" "}
              {fmtMoney(((data.hiResProofCount || 0) * 30) + ((data.lowResProofCount || 0) * 12))}
            </div>
            <div className="amt">
              {fmtMoney(((data.hiResProofCount || 0) * 30) + ((data.lowResProofCount || 0) * 12))}
            </div>
          </div>
          <div className="det-row">
            <div className="label">Plates</div>
            <div className="secondary">
              {data.plateLaborMinutesEach || 0} min × {totalColors} plates
            </div>
            <div className="amt">{fmtMoney(platesCost)}</div>
          </div>
          <div className="det-row" style={{ borderTop: "1px solid #999", fontWeight: 600 }}>
            <div className="label">Hours Prep</div>
            <div className="secondary">{prepHours.toFixed(1)} Hrs · Prep Materials {fmtMoney(platesCost * 0.3)}</div>
            <div className="amt">{fmtMoney(prepCost + platesCost)}</div>
          </div>

          {/* PRESS */}
          <div className="det-section-header">[ Press ]</div>
          <p className="text-xs px-2 italic">Press {pressName} · Configuration {pressConfig}</p>
          <div className="det-row">
            <div className="label">Setup</div>
            <div className="secondary">{setupHours.toFixed(1)} Hrs · {numberUp} Pages up</div>
            <div className="amt">{fmtMoney(setupHours * pressOpRate)}</div>
          </div>
          <div className="det-row">
            <div className="label">Makeready</div>
            <div className="secondary">{(setupHours * 0.5).toFixed(1)} Hrs · {fmtInt(mrSheets)} sheets</div>
            <div className="amt">{fmtMoney(makeReadyCost)}</div>
          </div>
          <div className="det-row">
            <div className="label">Run</div>
            <div className="secondary">{pressRunHours.toFixed(1)} Hrs · Side 1 in {inkF} Color(s)</div>
            <div className="amt">{fmtMoney(pressRunHours * pressOpRate * 0.5)}</div>
          </div>
          {inkB > 0 && (
            <div className="det-row">
              <div className="label">Run</div>
              <div className="secondary">{pressRunHours.toFixed(1)} Hrs · Side 2 in {inkB} Color(s)</div>
              <div className="amt">{fmtMoney(pressRunHours * pressOpRate * 0.5)}</div>
            </div>
          )}
          <div className="det-row">
            <div className="label">Ink</div>
            <div className="secondary">{totalColors} colors @ {data.inkCostPerLb || 0}/lb</div>
            <div className="amt">{fmtMoney(inkCost)}</div>
          </div>
          <div className="det-row" style={{ borderTop: "1px solid #999", fontWeight: 600 }}>
            <div className="label">Hours Press</div>
            <div className="secondary">
              {(pressRunHours + setupHours).toFixed(1)} Hrs · Press Materials {fmtMoney(inkCost)}
            </div>
            <div className="amt">{fmtMoney(pressCost + inkCost)}</div>
          </div>

          {/* BINDERY */}
          <div className="det-section-header">[ Bindery ]</div>
          {Number(data.numCuts) > 0 && (
            <div className="det-row">
              <div className="label">Trim to Size</div>
              <div className="secondary">{data.numCuts} cuts</div>
              <div className="amt">—</div>
            </div>
          )}
          {data.foldType && data.foldType !== "none" && Number(data.numFolds) > 0 && (
            <div className="det-row">
              <div className="label">Folding</div>
              <div className="secondary">
                {data.numFolds} {data.foldType} folds × {fmtInt(qty)} sheets
              </div>
              <div className="amt">—</div>
            </div>
          )}
          {Number(data.saddleStitchCost) > 0 && (
            <div className="det-row">
              <div className="label">Saddlebind</div>
              <div className="secondary">on the Mueller</div>
              <div className="amt">{fmtMoney(Number(data.saddleStitchCost))}</div>
            </div>
          )}
          {Number(data.numDrillHoles) > 0 && (
            <div className="det-row">
              <div className="label">Drill</div>
              <div className="secondary">{data.numDrillHoles} holes × {fmtInt(qty)}</div>
              <div className="amt">—</div>
            </div>
          )}
          {data.skidPack && (
            <div className="det-row">
              <div className="label">Ctn Pack</div>
              <div className="secondary">{data.cartonType ? `Carton type ${data.cartonType}` : "Skid pack"}</div>
              <div className="amt">—</div>
            </div>
          )}
          {outsideTotal > 0 && (
            <div className="det-row">
              <div className="label">Finish Outside</div>
              <div className="secondary">Outside vendor</div>
              <div className="amt">{fmtMoney(outsideTotal)}</div>
            </div>
          )}
          <div className="det-row" style={{ borderTop: "1px solid #999", fontWeight: 600 }}>
            <div className="label">Hours Bind</div>
            <div className="secondary">Bind Materials {fmtMoney(finishingCost)}</div>
            <div className="amt">{fmtMoney(finishingCost + outsideTotal)}</div>
          </div>

          {/* Summary */}
          <div className="mt-6 border-t-2 border-black pt-2">
            <div className="grid grid-cols-3 gap-2 text-xs px-2">
              <div>Total Time {(prepHours + pressRunHours + setupHours).toFixed(1)} Hrs</div>
              <div>Material is {Math.round(((paperCost + inkCost) / Math.max(subtotalCost, 1)) * 100)}% of cost</div>
              <div className="text-right font-bold">Selling Price</div>
            </div>
          </div>

          {/* Markup matrix */}
          <table className="w-full mt-4 text-xs">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-1 px-2"></th>
                <th className="text-right py-1 px-2">Cost</th>
                <th className="text-right py-1 px-2">Markup %</th>
                <th className="text-right py-1 px-2">Markup $</th>
                <th className="text-right py-1 px-2">Selling Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 px-2 font-medium">Paper</td>
                <td className="text-right">{fmtMoney(paperCost)}</td>
                <td className="text-right">{markupPaper}%</td>
                <td className="text-right">{fmtMoney(paperMarkupAmt)}</td>
                <td className="text-right font-semibold">{fmtMoney(paperCost + paperMarkupAmt)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-medium">Material</td>
                <td className="text-right">{fmtMoney(inkCost + platesCost)}</td>
                <td className="text-right">{markupMaterial}%</td>
                <td className="text-right">{fmtMoney(materialMarkupAmt)}</td>
                <td className="text-right font-semibold">{fmtMoney(inkCost + platesCost + materialMarkupAmt)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-medium">Outside</td>
                <td className="text-right">{fmtMoney(outsideTotal)}</td>
                <td className="text-right">{markupOutside}%</td>
                <td className="text-right">{fmtMoney(outsideMarkupAmt)}</td>
                <td className="text-right font-semibold">{fmtMoney(outsideTotal + outsideMarkupAmt)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-medium">Labor</td>
                <td className="text-right">{fmtMoney(laborCost)}</td>
                <td className="text-right">{markupLabor}%</td>
                <td className="text-right">{fmtMoney(laborMarkupAmt)}</td>
                <td className="text-right font-semibold">{fmtMoney(laborCost + laborMarkupAmt)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-medium">Commission</td>
                <td className="text-right">—</td>
                <td className="text-right">{commissionPct}%</td>
                <td className="text-right">{fmtMoney(commissionAmount)}</td>
                <td className="text-right font-semibold">{fmtMoney(commissionAmount)}</td>
              </tr>
              <tr className="border-t-2 border-black bg-amber-100">
                <td className="py-2 px-2 font-bold">Totals</td>
                <td className="text-right py-2 font-bold">{fmtMoney(subtotalCost)}</td>
                <td className="text-right py-2 text-gray-600">By {data.csrName || "MARY BITTING"}</td>
                <td className="text-right py-2 font-bold">{fmtMoney(paperMarkupAmt + materialMarkupAmt + outsideMarkupAmt + laborMarkupAmt + commissionAmount)}</td>
                <td className="text-right py-2 font-bold text-lg">{fmtMoney(total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Notes */}
          {data.specialInstructions && (
            <div className="mt-6 p-3 border border-gray-300 bg-gray-50">
              <p className="text-xs font-bold mb-1">Notes</p>
              <p className="text-xs whitespace-pre-wrap">{data.specialInstructions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
