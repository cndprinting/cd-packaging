"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const SALES_TAX_RATE = 0.07; // 7% Pinellas County FL

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

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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

  const createdDate = new Date(quote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const tiers = specs.quantityTiers || [{ quantity: quote.quantity, total: quote.totalPrice, costPerUnit: quote.unitPrice, costPer1000: 0 }];
  const descParts = quote.description?.split(" | ") || [];
  const productTypeLabel = descParts[0] || "";
  const colorsDisplay = specs.colors || "";
  const pressDisplay = specs.pressName ? `${specs.pressName}${specs.pressConfig ? ` - ${specs.pressConfig}` : ""}` : "";
  const stockDisplay = specs.stockType ? (specs.stockType.charAt(0).toUpperCase() + specs.stockType.slice(1)) : "";

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page { padding: 0.4in 0.6in; }
        }
        @media screen {
          body { background: #e5e7eb; }
          .print-page { max-width: 8.5in; margin: 20px auto; padding: 0.5in 0.7in; background: white; min-height: 11in; box-shadow: 0 4px 24px rgba(0,0,0,0.15); border-radius: 4px; }
        }
        .print-page { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.5; }

        .header-bar { background: linear-gradient(135deg, #ED1C24, #27AAE1); padding: 2px 0; margin-bottom: 16px; }
        .header-content { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
        .header-logo { display: flex; align-items: center; gap: 12px; }
        .header-logo img { height: 48px; }
        .header-company { text-align: right; font-size: 10px; color: #555; line-height: 1.6; }
        .header-company .name { font-size: 16px; font-weight: bold; color: #1a1a1a; }

        .estimate-badge { display: inline-block; background: #ED1C24; color: white; font-size: 10px; font-weight: bold; letter-spacing: 2px; padding: 3px 12px; text-transform: uppercase; }

        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 12px 0; }
        .meta-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
        .meta-value { font-size: 12px; font-weight: 600; color: #1a1a1a; }

        .section-divider { border: none; border-top: 2px solid #ED1C24; margin: 14px 0 10px 0; }
        .section-divider-light { border: none; border-top: 1px solid #ddd; margin: 10px 0; }

        .spec-label { font-weight: bold; font-size: 11px; color: #ED1C24; text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 2px 0; }
        .spec-value { margin-left: 16px; font-size: 11px; color: #333; }

        .pricing-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .pricing-table th { background: #f3f4f6; padding: 6px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 2px solid #ED1C24; }
        .pricing-table td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
        .pricing-table tr:last-child td { border-bottom: 2px solid #ED1C24; }
        .pricing-table .amt { text-align: right; font-weight: bold; font-size: 13px; }
        .pricing-table .tax-row td { font-size: 11px; color: #666; }
        .pricing-table .total-row td { font-weight: bold; font-size: 14px; background: #fef2f2; }

        .terms-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin: 14px 0; font-size: 10px; line-height: 1.7; }
        .terms-box .terms-title { font-weight: bold; font-size: 11px; color: #ED1C24; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }

        .payment-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; margin: 10px 0; font-size: 10px; line-height: 1.7; }
        .payment-box .payment-title { font-weight: bold; font-size: 11px; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }

        .sig-area { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sig-block { border-top: 1px solid #000; padding-top: 4px; }
        .sig-label { font-size: 9px; color: #888; text-transform: uppercase; }

        .footer-bar { background: linear-gradient(135deg, #ED1C24, #27AAE1); padding: 2px 0; margin-top: 20px; }
        .footer-text { text-align: center; font-size: 9px; color: #888; margin-top: 6px; }
      `}</style>

      {/* Screen toolbar */}
      <div className="no-print p-4 text-center bg-gray-200 sticky top-0 z-10">
        <button onClick={() => window.history.back()} className="mr-4 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back</button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Print</button>
      </div>

      <div className="print-page">
        {/* Color bar */}
        <div className="header-bar" />

        {/* Header with logo */}
        <div className="header-content">
          <div className="header-logo">
            <img src="/logo.svg" alt="C&D Printing and Packaging" />
          </div>
          <div className="header-company">
            <div className="name">C&amp;D Printing Co.</div>
            12150 28th Street N.<br />
            St. Petersburg, FL 33716<br />
            727-572-9999 | Fax 727-573-5839
          </div>
        </div>

        {/* Estimate badge + meta */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="estimate-badge">Estimate</div>
        </div>

        <div className="meta-grid" style={{ marginTop: 10 }}>
          <div>
            <div className="meta-label">Customer</div>
            <div className="meta-value">{quote.customerName}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="meta-label">Estimate #</div>
            <div className="meta-value">{quote.quoteNumber}</div>
          </div>
          <div>
            <div className="meta-label">Contact</div>
            <div className="meta-value">{quote.contactName || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="meta-label">Date</div>
            <div className="meta-value">{createdDate}</div>
          </div>
        </div>

        <hr className="section-divider" />

        {/* Job Specs */}
        <div className="spec-label">Job Description</div>
        <div className="spec-value">
          {quote.productName}
          {productTypeLabel && <> &mdash; {productTypeLabel}</>}
        </div>
        {quote.description && <div className="spec-value" style={{ color: "#666", fontSize: 10 }}>{quote.description}</div>}

        {specs.dimensions && (
          <>
            <div className="spec-label">Final Trim Size</div>
            <div className="spec-value">{specs.dimensions.replace("x", '" x ')}"{specs.dimensions ? " - with Bleeds" : ""}</div>
          </>
        )}

        {stockDisplay && (
          <>
            <div className="spec-label">Paper</div>
            <div className="spec-value">
              {stockDisplay} Stock
              {specs.paperStock && <> &mdash; {specs.paperStock}</>}
            </div>
          </>
        )}

        {(colorsDisplay || pressDisplay) && (
          <>
            <div className="spec-label">Press Work</div>
            <div className="spec-value">
              {colorsDisplay && <>{colorsDisplay.replace("F/", " Front / ").replace("B", " Back")}</>}
              {pressDisplay && <> &mdash; {pressDisplay}</>}
            </div>
          </>
        )}

        {specs.finishing && (
          <>
            <div className="spec-label">Bindery / Finishing</div>
            <div className="spec-value">{specs.finishing}</div>
          </>
        )}

        {quote.notes && (
          <>
            <div className="spec-label">Notes</div>
            <div className="spec-value" style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</div>
          </>
        )}

        <div className="spec-label">Delivery</div>
        <div className="spec-value">ST PETE / TAMPA area</div>

        <hr className="section-divider" />

        {/* Pricing Table */}
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th className="amt">Subtotal</th>
              <th className="amt">Sales Tax (7%)</th>
              <th className="amt">Total</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => {
              const tax = tier.total * SALES_TAX_RATE;
              const totalWithTax = tier.total + tax;
              return (
                <tr key={i}>
                  <td><strong>{tier.quantity.toLocaleString()}</strong> units</td>
                  <td className="amt">{fmtMoney(tier.total)}</td>
                  <td className="amt" style={{ color: "#666" }}>{fmtMoney(tax)}</td>
                  <td className="amt">{fmtMoney(totalWithTax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Additional Products */}
        {specs.additionalProducts && specs.additionalProducts.length > 0 && (
          <>
            {specs.additionalProducts.map((product, pi) => (
              <div key={pi}>
                <div style={{ fontWeight: "bold", fontSize: 11, marginTop: 8, color: "#ED1C24" }}>{product.productName}</div>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Quantity</th><th className="amt">Subtotal</th><th className="amt">Tax (7%)</th><th className="amt">Total</th></tr>
                  </thead>
                  <tbody>
                    {(product.tiers || [{ quantity: product.quantity, total: product.total, costPerUnit: 0, costPer1000: 0 }]).map((t, ti) => {
                      const tax = t.total * SALES_TAX_RATE;
                      return (
                        <tr key={ti}>
                          <td><strong>{t.quantity.toLocaleString()}</strong> units</td>
                          <td className="amt">{fmtMoney(t.total)}</td>
                          <td className="amt" style={{ color: "#666" }}>{fmtMoney(tax)}</td>
                          <td className="amt">{fmtMoney(t.total + tax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

        {/* Terms */}
        <div className="terms-box">
          <div className="terms-title">Terms &amp; Conditions</div>
          <strong>Payment Terms:</strong> 50% deposit required before production begins. Remaining balance due upon delivery.<br />
          <strong>Credit Card Payments:</strong> A 3% processing surcharge applies to all credit card transactions.<br />
          <strong>Sales Tax:</strong> Florida sales tax (7%) is included in the totals above.<br />
          <strong>Quote Validity:</strong> This estimate is valid for 30 days from the date above. Prices are subject to change after expiration.<br />
          <strong>Overruns/Underruns:</strong> Industry standard of +/- 10% on quantity. Billing adjusted accordingly.
        </div>

        {/* Payment Instructions */}
        <div className="payment-box">
          <div className="payment-title">Payment Instructions</div>
          <strong>Check:</strong> Make payable to <em>C&amp;D Printing Co.</em> and mail to 12150 28th Street N., St. Petersburg, FL 33716<br />
          <strong>Wire / ACH:</strong> Contact us at 727-572-9999 for wire transfer details.<br />
          <strong>Credit Card:</strong> Call 727-572-9999 to pay by phone. A 3% surcharge applies.
        </div>

        <hr className="section-divider-light" />

        {/* Signature Area */}
        <div className="sig-area">
          <div>
            <div className="sig-block">
              <div className="sig-label">Customer Signature</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="sig-block">
                <div className="sig-label">Date</div>
              </div>
            </div>
          </div>
          <div>
            <div className="sig-block">
              <div className="sig-label">Authorized by &mdash; C&amp;D Printing Co.</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="sig-block">
                <div className="sig-label">Date</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer-bar" />
        <div className="footer-text">
          C&amp;D Printing Co. | 12150 28th Street N., St. Petersburg, FL 33716 | 727-572-9999 | www.cdprinting.com
        </div>
      </div>
    </>
  );
}
