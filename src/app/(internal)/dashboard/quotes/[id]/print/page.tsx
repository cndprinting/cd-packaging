"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
  contactName: string | null;
  productName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  validUntil: string;
  notes: string | null;
  specs: string | null;
  createdAt: string;
}

interface ParsedSpecs {
  dimensions?: string;
  sheetSize?: string;
  colors?: string;
  pressName?: string;
  pressConfig?: string;
  stockType?: string;
  paperStock?: string;
  coating?: string;
  finishing?: string;
  quantityTiers?: { quantity: number; total: number; costPerUnit: number; costPer1000: number }[];
  additionalProducts?: { productName: string; productType: string; quantity: number; total: number; tiers: { quantity: number; total: number; costPerUnit: number; costPer1000: number }[] }[];
  commission?: { percent: number; amount: number };
  costBreakdown?: Record<string, number>;
}

export default function PrintQuotePage() {
  const params = useParams();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quotes/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.quote) setQuote(d.quote); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  // Auto-print when loaded
  useEffect(() => {
    if (quote && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [quote, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!quote) {
    return <div className="p-8 text-center text-gray-500">Quote not found</div>;
  }

  let specs: ParsedSpecs = {};
  if (quote.specs) {
    try { specs = JSON.parse(quote.specs); } catch { /* ignore */ }
  }

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const createdDate = new Date(quote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Build quantity tiers for display
  const tiers = specs.quantityTiers || [{ quantity: quote.quantity, total: quote.totalPrice, costPerUnit: quote.unitPrice, costPer1000: 0 }];

  // Parse job description parts from description field
  const descParts = quote.description?.split(" | ") || [];
  const productTypeLabel = descParts[0] || "";
  const sizeLabel = descParts[1] || "";

  // Derive press/paper/bindery info from specs
  const colorsDisplay = specs.colors || "";
  const pressDisplay = specs.pressName ? `${specs.pressName}${specs.pressConfig ? ` - ${specs.pressConfig}` : ""}` : "";
  const stockDisplay = specs.stockType ? (specs.stockType.charAt(0).toUpperCase() + specs.stockType.slice(1)) : "";

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page { padding: 0.5in 0.75in; }
        }
        @media screen {
          .print-page { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.75in; background: white; min-height: 11in; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        }
        .print-page { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; line-height: 1.4; }
        .print-page h1 { font-size: 14px; margin: 0; }
        .print-page .header-title { font-size: 13px; font-weight: normal; text-align: center; margin-bottom: 4px; }
        .print-page .company-name { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 2px; }
        .print-page .company-address { text-align: center; font-size: 11px; line-height: 1.5; }
        .print-page .divider { border-top: 3px double #000; margin: 12px 0; }
        .print-page .divider-thin { border-top: 1px solid #000; margin: 8px 0; }
        .print-page .section-label { font-weight: bold; font-size: 12px; margin: 10px 0 2px 0; }
        .print-page .section-value { margin-left: 16px; font-size: 11px; }
        .print-page .meta-row { display: flex; justify-content: space-between; margin: 4px 0; }
        .print-page .qty-table { width: 100%; margin: 8px 0; }
        .print-page .qty-table td { padding: 2px 8px; font-size: 12px; font-weight: bold; }
        .print-page .signature-area { margin-top: 24px; }
        .print-page .sig-line { border-bottom: 1px solid #000; width: 200px; display: inline-block; margin: 0 8px; }
      `}</style>

      {/* Back button (screen only) */}
      <div className="no-print p-4 text-center bg-gray-100">
        <button
          onClick={() => window.history.back()}
          className="mr-4 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          Print
        </button>
      </div>

      <div className="print-page">
        {/* Header */}
        <div className="header-title">Estimate</div>
        <div className="company-name">C&amp;D Printing Co.</div>
        <div className="company-address">
          12150 28th Street N.<br />
          St. Petersburg, FL 33716<br />
          727-572-9999 &nbsp;&nbsp;&nbsp; FX 727-573-5839
        </div>

        <div className="divider" />

        {/* Estimate Number + Customer */}
        <div className="meta-row">
          <div>{quote.customerName}</div>
          <div>Estimate Number {quote.quoteNumber.replace("QT-", "")}</div>
        </div>
        <div className="meta-row">
          <div />
          <div>Date {createdDate}</div>
        </div>

        <div className="divider" />

        {/* Job Description */}
        <div className="section-label">JOB DESCRIPTION:</div>
        <div className="section-value">
          {quote.productName}
          {productTypeLabel && <><br />{productTypeLabel}</>}
        </div>
        {quote.description && (
          <div className="section-value" style={{ marginTop: 4 }}>
            Estimated as: {quote.description}
          </div>
        )}

        {/* Final Trim Size */}
        {specs.dimensions && (
          <>
            <div className="section-label">FINAL TRIM SIZE:</div>
            <div className="section-value">{specs.dimensions.replace("x", " x ")}{" "}- with Bleeds</div>
          </>
        )}

        {/* Paper */}
        {stockDisplay && (
          <>
            <div className="section-label">PAPER:</div>
            <div className="section-value">
              {stockDisplay} Stock
              {specs.paperStock && <><br />{specs.paperStock}</>}
            </div>
          </>
        )}

        {/* Press Work */}
        {(colorsDisplay || pressDisplay) && (
          <>
            <div className="section-label">PRESS WORK:</div>
            <div className="section-value">
              {colorsDisplay && <>{colorsDisplay.replace("F/", " Front / ").replace("B", " Back")}</>}
              {pressDisplay && <><br />Press: {pressDisplay}</>}
            </div>
          </>
        )}

        {/* Bindery */}
        {specs.finishing && (
          <>
            <div className="section-label">BINDERY:</div>
            <div className="section-value">{specs.finishing}</div>
          </>
        )}

        {/* Notes */}
        {quote.notes && (
          <>
            <div className="section-label">NOTES:</div>
            <div className="section-value" style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</div>
          </>
        )}

        {/* Delivery */}
        <div className="section-label">DELIVERY:</div>
        <div className="section-value">ST PETE/TAMPA</div>

        <div style={{ height: 16 }} />

        {/* Quantity / Price Table */}
        <div className="divider" />
        <table className="qty-table">
          <tbody>
            {tiers.map((tier, i) => (
              <tr key={i}>
                <td style={{ width: 100 }}>QUANTITY:</td>
                <td>{tier.quantity.toLocaleString()} - Price of {formatCurrency(tier.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Additional Products */}
        {specs.additionalProducts && specs.additionalProducts.length > 0 && (
          <>
            <div className="divider-thin" />
            {specs.additionalProducts.map((product, pi) => (
              <div key={pi} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: "bold", fontSize: 11 }}>{product.productName}:</div>
                <table className="qty-table">
                  <tbody>
                    {product.tiers?.map((t, ti) => (
                      <tr key={ti}>
                        <td style={{ width: 100 }}>QUANTITY:</td>
                        <td>{t.quantity.toLocaleString()} - Price of {formatCurrency(t.total)}</td>
                      </tr>
                    )) || (
                      <tr>
                        <td style={{ width: 100 }}>QUANTITY:</td>
                        <td>{product.quantity.toLocaleString()} - Price of {formatCurrency(product.total)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: 4, fontSize: 11 }}>
          <strong>TERMS:</strong> UPON APPROVAL
        </div>

        <div className="divider" />

        {/* Signature Area */}
        <div className="signature-area">
          <div>
            QUOTE ACCEPTED BY <span className="sig-line" /> DATE <span className="sig-line" style={{ width: 80 }} />
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
            <div>
              <span className="sig-line" /><br />
              <span style={{ fontSize: 10, marginLeft: 40 }}>Accepted by</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <span className="sig-line" /><br />
              <span style={{ fontSize: 10 }}>C&amp;D Printing Co.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
