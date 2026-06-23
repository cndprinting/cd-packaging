"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, DollarSign, Send, Package, Check, Loader2,
  FileText, Calendar, User, Mail, Hash, Layers, Printer,
  BarChart3, Clock, X, Scissors, Truck, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
  contactName: string | null;
  contactEmail: string | null;
  productType: string;
  productName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  validUntil: string;
  notes: string | null;
  customerNotes: string | null;
  specs: string | null;
  convertedJobId: string | null;
  sourcingVendor?: string | null;
  sourcingStatus?: string | null;
  sourcingArtworkUrl?: string | null;
  sourcingArtworkName?: string | null;
  sourcingMarkupPct?: number | null;
  sourcingItems?: string | null;
  sourcingFulfillment?: string | null;
  vendorLandedCost?: number | null;
  vendorQuoteFileUrl?: string | null;
  vendorQuoteFileName?: string | null;
  vendorQuoteNotes?: string | null;
  vendorQuoteUploadedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  markups?: { paper: number; material: number; labor: number; outside: number };
  costBreakdown?: { materials: number; tooling: number; labor: number; finishing: number; waste: number; shipping: number; markup: number };
  quantityTiers?: { quantity: number; total: number; costPerUnit: number; costPer1000: number }[];
  additionalProducts?: { productName: string; quantity: number; total: number }[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState<number>(0);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailType, setEmailType] = useState<"customer" | "internal">("customer");
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quotes/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.quote) setQuote(d.quote); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateStatus = async (newStatus: string) => {
    if (!quote) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id, status: newStatus }),
      });
      if (res.ok) {
        setQuote((prev) => prev ? { ...prev, status: newStatus } : null);
        if (newStatus === "converted") {
          // Reload to get the convertedJobId and redirect
          const r = await fetch(`/api/quotes/${quote.id}`);
          const d = await r.json();
          if (d.quote) {
            setQuote(d.quote);
            if (d.quote.convertedJobId) {
              alert(`Job created! Redirecting to job...`);
              window.location.href = `/dashboard/jobs/${d.quote.convertedJobId}`;
              return;
            }
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to update quote");
      }
    } catch { alert("Something went wrong"); }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/quotes" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Quotes
        </Link>
        <Card className="p-8 text-center">
          <p className="text-gray-400">Quote not found</p>
        </Card>
      </div>
    );
  }

  let specs: ParsedSpecs = {};
  if (quote.specs) {
    try { specs = JSON.parse(quote.specs); } catch { /* ignore */ }
  }

  // Wholesale/outsourced quotes are a different beast — no internal estimating,
  // so the page leads with the sourcing workflow and hides the estimator-
  // oriented cards/actions that confused sales (Benjy 6/23).
  const isOutsourced = !!quote.sourcingVendor;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/quotes"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
              {isOutsourced && <Badge className="bg-amber-100 text-amber-700"><Package className="h-3 w-3 mr-1" />Wholesale</Badge>}
              <Badge className={statusColors[quote.status] || "bg-gray-100 text-gray-600"}>
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{isOutsourced ? `${quote.customerName} · sourcing from ${quote.sourcingVendor}` : quote.productName}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit — Mary 6/15: reopen a sent quote in the estimator with all
              data prefilled. Outsourced (wholesale) quotes have no estimating,
              so they edit via the Outsourced Sourcing card on this page instead
              of the estimator (Benjy 6/16). Hidden once converted to a job. */}
          {!quote.convertedJobId && quote.status !== "archived" && !quote.sourcingVendor && (
            <Link href={`/dashboard/quotes/estimate?draftId=${quote.id}`}>
              <Button variant="outline" className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                <FileText className="h-4 w-4" /> Edit Quote
              </Button>
            </Link>
          )}
          {(quote.status === "draft" || quote.status === "sent") && (
            <>
              <Button onClick={() => { setEmailType("customer"); setEmailTo(quote.contactEmail || ""); setShowEmailModal(true); }} disabled={updating} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4" /> Send to...
              </Button>
              <Button variant="outline" onClick={() => window.open(`/dashboard/quotes/${quote.id}/print`, '_blank')} className="gap-2">
                <Printer className="h-4 w-4" /> Print Quote
              </Button>
              {!isOutsourced && (
                <Button variant="outline" onClick={() => {
                  setSelectedVolume(quote.quantity);
                  setShowConvertModal(true);
                }} disabled={updating} className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50">
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Convert to Job
                </Button>
              )}
            </>
          )}
          {quote.status === "sent" && !isOutsourced && (
            <>
              <Button onClick={() => updateStatus("approved")} disabled={updating} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" onClick={() => updateStatus("rejected")} disabled={updating} className="gap-2 text-red-600">
                <X className="h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {quote.status === "approved" && (
            <>
              {!isOutsourced && (
                <Button onClick={() => { setSelectedVolume(quote.quantity); setShowConvertModal(true); }} disabled={updating} className="gap-2 bg-purple-600 hover:bg-purple-700">
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Convert to Job
                </Button>
              )}
              <Button variant="outline" onClick={() => window.open(`/dashboard/quotes/${quote.id}/print`, '_blank')} className="gap-2">
                <Printer className="h-4 w-4" /> Print Quote
              </Button>
            </>
          )}
          {quote.convertedJobId && (
            <Link href={`/dashboard/jobs/${quote.convertedJobId}`}>
              <Button variant="outline" className="gap-2">
                <Layers className="h-4 w-4" /> View Job
              </Button>
            </Link>
          )}
          {/* Print always available */}
          {quote.status !== "draft" && quote.status !== "sent" && quote.status !== "approved" && (
            <Button variant="outline" onClick={() => window.open(`/dashboard/quotes/${quote.id}/print`, '_blank')} className="gap-2">
              <Printer className="h-4 w-4" /> Print Quote
            </Button>
          )}
        </div>
      </div>

      {/* Wholesale: lead with the sourcing workflow (Benjy 6/23) */}
      {isOutsourced && (
        <SourcingCard quote={quote} onChange={async () => {
          const r = await fetch(`/api/quotes/${quote.id}`); const d = await r.json();
          if (d.quote) setQuote(d.quote);
        }} />
      )}

      {/* Overview Cards — "Per 1,000" is a manufacturing metric, hidden for
          outsourced/wholesale quotes (Benjy 6/20). */}
      <div className={`grid grid-cols-2 ${quote.sourcingVendor ? "md:grid-cols-3" : "md:grid-cols-4"} gap-4`}>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Quantity</p>
          <p className="text-2xl font-bold text-gray-900">{quote.quantity.toLocaleString()}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Unit Price</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(quote.unitPrice)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Price</p>
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(quote.totalPrice)}</p>
        </Card>
        {!quote.sourcingVendor && (
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Per 1,000</p>
            <p className="text-2xl font-bold text-gray-900">
              {quote.quantity > 0 ? formatCurrency((quote.totalPrice / quote.quantity) * 1000) : "—"}
            </p>
          </Card>
        )}
      </div>

      {/* Details */}
      <div className={`grid grid-cols-1 ${isOutsourced ? "" : "md:grid-cols-2"} gap-6`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-brand-600" /> Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow icon={User} label="Customer" value={quote.customerName} />
            {quote.contactName && <DetailRow icon={User} label="Contact" value={quote.contactName} />}
            {quote.contactEmail && <DetailRow icon={Mail} label="Email" value={quote.contactEmail} />}
            {!isOutsourced && (
              <DetailRow
                icon={Layers}
                label="Product Type"
                value={quote.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"}
              />
            )}
            {isOutsourced && <DetailRow icon={Package} label="Vendor" value={quote.sourcingVendor || "—"} />}
            <DetailRow icon={Calendar} label="Created" value={formatDate(quote.createdAt)} />
            {quote.validUntil && <DetailRow icon={Clock} label="Valid Until" value={formatDate(quote.validUntil)} />}
          </CardContent>
        </Card>

        {!isOutsourced && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-brand-600" /> Job Specs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quote.description && <DetailRow icon={FileText} label="Description" value={quote.description} />}
            {specs.dimensions && <DetailRow icon={Hash} label="Finished Size" value={`${specs.dimensions}"`} />}
            {specs.sheetSize && <DetailRow icon={Hash} label="Sheet Size" value={`${specs.sheetSize}"`} />}
            {specs.colors && <DetailRow icon={Layers} label="Colors" value={specs.colors} />}
            {specs.pressName && <DetailRow icon={Printer} label="Press" value={`${specs.pressName}${specs.pressConfig ? ` / ${specs.pressConfig}` : ""}`} />}
            {specs.stockType && <DetailRow icon={Layers} label="Stock" value={specs.stockType.charAt(0).toUpperCase() + specs.stockType.slice(1)} />}
            {specs.paperStock && <DetailRow icon={Layers} label="Paper" value={specs.paperStock} />}
            {specs.coating && <DetailRow icon={Layers} label="Coating" value={specs.coating} />}
            {specs.finishing && <DetailRow icon={Scissors} label="Finishing" value={specs.finishing} />}
            {!specs.dimensions && !specs.pressName && !quote.description && (
              <p className="text-sm text-gray-400 italic">No specs recorded — use the Estimator to generate detailed specs.</p>
            )}
          </CardContent>
        </Card>}
      </div>

      {/* Cost Breakdown */}
      {specs.costBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-brand-600" /> Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <CostRow label="Materials" sublabel="Substrate + ink + coating" amount={specs.costBreakdown.materials} icon={Layers} />
              <CostRow label="Tooling" sublabel="Dies, plates, stripping tools" amount={specs.costBreakdown.tooling} icon={Hash} />
              <CostRow label="Labor" sublabel="Press + prepress + setup" amount={specs.costBreakdown.labor} icon={User} />
              <CostRow label="Finishing" sublabel="Bindery, gluing, patching" amount={specs.costBreakdown.finishing} icon={Scissors} />
              <CostRow label="Waste / Make-Ready" sublabel="Waste sheets at paper cost" amount={specs.costBreakdown.waste} icon={RotateCcw} />
              <CostRow label="Shipping" sublabel="Delivery cost" amount={specs.costBreakdown.shipping} icon={Truck} />
              <div className="my-3 border-t border-gray-200" />
              {specs.markups && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 ml-11">Paper Markup ({specs.markups.paper}%)</span>
                    <span className="font-medium text-brand-600">
                      + {formatCurrency(specs.costBreakdown.materials * (specs.markups.paper / 100))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 ml-11">Material Markup ({specs.markups.material}%)</span>
                    <span className="font-medium text-brand-600">
                      + {formatCurrency(specs.costBreakdown.tooling * (specs.markups.material / 100))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 ml-11">Labor Markup ({specs.markups.labor}%)</span>
                    <span className="font-medium text-brand-600">
                      + {formatCurrency(specs.costBreakdown.labor * (specs.markups.labor / 100))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 ml-11">Outside Markup ({specs.markups.outside}%)</span>
                    <span className="font-medium text-brand-600">
                      + {formatCurrency(specs.costBreakdown.shipping * (specs.markups.outside / 100))}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total Markup</span>
                <span className="font-semibold text-brand-600">+ {formatCurrency(specs.costBreakdown.markup)}</span>
              </div>
              <div className="my-3 border-t-2 border-gray-900" />
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-brand-600">{formatCurrency(quote.totalPrice)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-wholesale quotes can still be sent to a vendor later — show the
          sourcing card at the bottom. Wholesale quotes show it up top instead. */}
      {!isOutsourced && (
        <SourcingCard quote={quote} onChange={async () => {
          const r = await fetch(`/api/quotes/${quote.id}`); const d = await r.json();
          if (d.quote) setQuote(d.quote);
        }} />
      )}

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Customer-facing notes (editable by CSRs) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Notes</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Shown to the customer on the quote PDF and email. Use for payment terms, delivery expectations, anything the customer should see.</p>
        </CardHeader>
        <CardContent>
          <CustomerNotesEditor quoteId={quote.id} initial={quote.customerNotes || ""} />
        </CardContent>
      </Card>

      {/* Volume Selection Modal for Conversion */}
      {showConvertModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowConvertModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Convert to Job</h2>
                <button onClick={() => setShowConvertModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                {specs.quantityTiers && specs.quantityTiers.length > 1
                  ? "This quote has multiple volume options. Select which quantity to produce:"
                  : "Confirm the quantity for this job:"}
              </p>
              <div className="space-y-2 mb-6">
                {specs.quantityTiers && specs.quantityTiers.length > 1 ? (
                  specs.quantityTiers.map((tier: any, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedVolume(tier.quantity)}
                      className={`flex w-full items-center justify-between rounded-lg border-2 p-3 transition-all ${selectedVolume === tier.quantity ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{tier.quantity.toLocaleString()} units</p>
                        <p className="text-xs text-gray-500">{formatCurrency(tier.costPerUnit)}/unit</p>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(tier.total)}</p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border-2 border-brand-500 bg-brand-50 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{quote.quantity.toLocaleString()} units</p>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(quote.totalPrice)}</p>
                    <div className="mt-3">
                      <label className="text-xs text-gray-500">Change quantity:</label>
                      <Input
                        type="number"
                        value={selectedVolume || quote.quantity}
                        onChange={(e) => setSelectedVolume(Number(e.target.value))}
                        className="mt-1 text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowConvertModal(false)}>Cancel</Button>
                <Button
                  className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                  disabled={updating || !selectedVolume}
                  onClick={async () => {
                    setShowConvertModal(false);
                    setUpdating(true);
                    try {
                      const res = await fetch("/api/quotes", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: quote.id, status: "converted", quantity: selectedVolume }),
                      });
                      if (res.ok) {
                        const r = await fetch(`/api/quotes/${quote.id}`);
                        const d = await r.json();
                        if (d.quote?.convertedJobId) {
                          alert(`Job created at ${selectedVolume.toLocaleString()} units! Redirecting...`);
                          window.location.href = `/dashboard/jobs/${d.quote.convertedJobId}`;
                          return;
                        }
                        setQuote(d.quote || quote);
                      } else {
                        const errData = await res.json().catch(() => ({}));
                        alert(errData.error || "Failed to convert");
                      }
                    } catch { alert("Something went wrong"); }
                    setUpdating(false);
                  }}
                >
                  <Package className="h-4 w-4" /> Convert at {selectedVolume.toLocaleString()}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowEmailModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {emailType === "customer" ? "Send Quote to Customer" : "Send Quote Internally"}
                </h2>
                <button onClick={() => { setShowEmailModal(false); setEmailSent(false); }}>
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {emailSent ? (
                <div className="text-center py-6">
                  <Check className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-900">Email Sent</p>
                  <p className="text-sm text-gray-500 mt-1">Quote {quote.quoteNumber} sent to {emailTo}</p>
                  <Button className="mt-4" onClick={() => { setShowEmailModal(false); setEmailSent(false); }}>Done</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
                    <Input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="recipient@company.com"
                      autoFocus
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-700 mb-1">Will send:</p>
                    <p className="text-gray-500">Quote {quote.quoteNumber} for {quote.customerName}</p>
                    <p className="text-gray-500">{quote.productName} - {quote.quantity.toLocaleString()} units</p>
                    <p className="text-gray-500 font-semibold">Total: {formatCurrency(quote.totalPrice)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEmailModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={emailSending || !emailTo}
                      onClick={async () => {
                        setEmailSending(true);
                        try {
                          const quoteUrl = `${window.location.origin}/dashboard/quotes/${quote.id}/print`;
                          const res = await fetch("/api/email", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              to: emailTo,
                              subject: `Estimate ${quote.quoteNumber} - ${quote.productName} | C&D Printing`,
                              body: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                                  <div style="background: linear-gradient(135deg, #ED1C24, #27AAE1); padding: 3px;"></div>
                                  <div style="padding: 24px;">
                                    <h2 style="margin: 0 0 4px;">Estimate from C&D Printing Co.</h2>
                                    <p style="color: #666; margin: 0 0 20px;">12150 28th Street N., St. Petersburg, FL 33716</p>
                                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                                      <tr><td style="padding: 8px 0; color: #888;">Estimate #</td><td style="padding: 8px 0; font-weight: bold;">${quote.quoteNumber}</td></tr>
                                      <tr><td style="padding: 8px 0; color: #888;">Product</td><td style="padding: 8px 0;">${quote.productName}</td></tr>
                                      <tr><td style="padding: 8px 0; color: #888;">Quantity</td><td style="padding: 8px 0;">${quote.quantity.toLocaleString()}</td></tr>
                                      <tr style="border-top: 2px solid #ED1C24;"><td style="padding: 12px 0; color: #888; font-weight: bold;">Total</td><td style="padding: 12px 0; font-size: 20px; font-weight: bold; color: #ED1C24;">${formatCurrency(quote.totalPrice)}</td></tr>
                                    </table>
                                    <p style="color: #666; font-size: 14px;">View the full estimate details and print a copy:</p>
                                    <a href="${quoteUrl}" style="display: inline-block; background: #ED1C24; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 8px;">View Estimate</a>
                                    <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                                    <p style="color: #999; font-size: 12px;">
                                      <strong>Terms:</strong> 50% deposit before production. Balance due on delivery. 3% surcharge on credit card payments.<br/>
                                      <strong>Contact:</strong> 727-572-9999 | C&D Printing Co.
                                    </p>
                                  </div>
                                  <div style="background: linear-gradient(135deg, #ED1C24, #27AAE1); padding: 3px;"></div>
                                </div>
                              `,
                              quoteId: quote.id,
                            }),
                          });
                          if (res.ok) {
                            setEmailSent(true);
                            if (emailType === "customer" && quote.status === "draft") {
                              updateStatus("sent");
                            }
                          } else {
                            const data = await res.json();
                            alert(data.error || "Failed to send email");
                          }
                        } catch {
                          alert("Failed to send email");
                        }
                        setEmailSending(false);
                      }}
                    >
                      {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Email
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-gray-400 shrink-0" />
      <span className="text-sm text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function CostRow({ label, sublabel, amount, icon: Icon }: { label: string; sublabel: string; amount: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{sublabel}</p>
      </div>
      <span className="text-sm font-semibold text-gray-900">{formatCurrency(amount)}</span>
    </div>
  );
}

// Outsourced sourcing card (Benjy 6/16). Assign the quote to a vendor (MWI)
// to source; once the vendor uploads a landed cost via their portal, it shows
// here with the markup → customer price math.
// quantity/landedCost stored as raw strings while typing (avoids the React
// number-input leading-zero bug — Benjy 6/20); Number()'d for math.
type SourcingItem = { id: string; sku: string; quantity: number | string; artworkUrl?: string; artworkName?: string; landedCost?: number | string; unitCost?: number; leadTime?: string; moq?: number; fileUrl?: string; fileName?: string; vendorNotes?: string };

function SourcingCard({ quote, onChange }: { quote: QuoteData; onChange: () => void }) {
  // Known sourcing vendors — friendly label, value matches the vendor login's
  // vendorName (Benjy 6/16). Add more here as vendors are onboarded.
  const VENDORS = [{ value: "MWI", label: "MWI — Mel Waxman Industries" }];
  const [vendor, setVendor] = useState(quote.sourcingVendor || "");
  const [markupPct, setMarkupPct] = useState(quote.sourcingMarkupPct ?? 20);
  const [busy, setBusy] = useState(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const [artRow, setArtRow] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  const notifyVendor = async () => {
    setNotifyBusy(true); setNotifyMsg("");
    try {
      const res = await fetch("/api/quotes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id, notifyVendor: true }),
      });
      const d = await res.json();
      setNotifyMsg(d.notified > 0 ? `✓ Notified (${d.notified})` : "No vendor email found");
      setTimeout(() => setNotifyMsg(""), 4000);
    } catch { setNotifyMsg("Failed"); }
    finally { setNotifyBusy(false); }
  };

  const setOutcome = async (outcome: "won" | "lost" | "reopen") => {
    setBusy(true);
    try {
      await fetch("/api/quotes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id, sourcingOutcome: outcome }),
      });
      onChange();
    } finally { setBusy(false); }
  };

  // Light wholesale fulfillment checklist — lives on the quote, no Job.
  type Fulfill = { poSent?: boolean; received?: boolean; shipped?: boolean; tracking?: string; invoiced?: boolean; vendorPaid?: boolean };
  const [fulfill, setFulfill] = useState<Fulfill>(() => {
    try { return quote.sourcingFulfillment ? JSON.parse(quote.sourcingFulfillment) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { setFulfill(quote.sourcingFulfillment ? JSON.parse(quote.sourcingFulfillment) : {}); } catch {}
  }, [quote.sourcingFulfillment]);
  const saveFulfill = async (next: Fulfill) => {
    setFulfill(next);
    await fetch("/api/quotes", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quote.id, sourcingFulfillment: next }),
    }).catch(() => {});
  };

  const [items, setItems] = useState<SourcingItem[]>(() => {
    try { const p = quote.sourcingItems ? JSON.parse(quote.sourcingItems) : []; if (Array.isArray(p) && p.length) return p; } catch {}
    return [{ id: `sku-${Date.now()}`, sku: "", quantity: quote.quantity || 0 }];
  });
  // Re-sync when the quote is refetched (e.g. after Martin submits) — the
  // useState initializer only runs on mount (Benjy 6/20).
  useEffect(() => {
    try { const p = quote.sourcingItems ? JSON.parse(quote.sourcingItems) : []; if (Array.isArray(p) && p.length) setItems(p); } catch {}
  }, [quote.sourcingItems]);

  const totalLanded = items.reduce((s, it) => s + (Number(it.landedCost) || 0), 0);
  const sell = totalLanded * (1 + markupPct / 100);
  const marginDollars = sell - totalLanded;
  const marginPct = sell > 0 ? (marginDollars / sell) * 100 : 0;
  const priceLocked = quote.sourcingStatus === "priced";
  const hasCosts = totalLanded > 0;

  const saveItems = async (next: SourcingItem[]) => {
    setItems(next);
    await fetch("/api/quotes", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quote.id, sourcingItems: next }),
    }).catch(() => {});
  };
  const updateRow = (id: string, patch: Partial<SourcingItem>) => setItems((p) => p.map((it) => it.id === id ? { ...it, ...patch } : it));
  const addRow = () => saveItems([...items, { id: `sku-${Date.now()}`, sku: "", quantity: 0 }]);
  const removeRow = (id: string) => saveItems(items.filter((it) => it.id !== id));

  const assign = async (name: string) => {
    setBusy(true);
    try {
      // Persist current line items first, then assign the vendor.
      await fetch("/api/quotes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: quote.id, sourcingItems: items }) }).catch(() => {});
      await fetch("/api/quotes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: quote.id, assignVendor: name }) });
      onChange();
    } finally { setBusy(false); }
  };

  const uploadRowArtwork = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArtRow(id);
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await up.json();
      if (!up.ok) { alert(d.message || d.error || "Upload failed"); return; }
      await saveItems(items.map((it) => it.id === id ? { ...it, artworkUrl: d.url, artworkName: d.fileName } : it));
    } catch { alert("Upload failed — try again"); }
    finally { setArtRow(null); }
  };

  const setCustomerPrice = async () => {
    setPriceBusy(true);
    try {
      await fetch("/api/quotes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: quote.id, sourcingItems: items }) }).catch(() => {});
      await fetch("/api/quotes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id, setSourcingPrice: true, markupPct, customerPrice: sell }),
      });
      onChange();
    } finally { setPriceBusy(false); }
  };

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-amber-600" /> Outsourced Sourcing</CardTitle>
        <p className="text-xs text-gray-500 mt-1">For items C&amp;D wholesales (oversized cartons, corrugated). Add the SKUs, attach artwork, assign a vendor — they return a landed cost per SKU via their portal, then mark it up for the customer.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sourcing vendor</label>
            <select className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">— select vendor —</option>
              {VENDORS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          {quote.sourcingVendor !== vendor && (
            <Button variant="outline" disabled={busy || !vendor} onClick={() => assign(vendor)}>
              {busy ? "Saving…" : "Assign for sourcing"}
            </Button>
          )}
          {quote.sourcingVendor && (
            <Badge className={quote.sourcingStatus === "quoted" || priceLocked ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
              {priceLocked ? "Priced" : quote.sourcingStatus === "quoted" ? "Quote received" : "Awaiting vendor quote"}
            </Badge>
          )}
          {quote.sourcingVendor === vendor && quote.sourcingVendor && (
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={notifyBusy} onClick={notifyVendor}>
              <Send className="h-4 w-4" /> {notifyBusy ? "Sending…" : notifyMsg || `Send to ${quote.sourcingVendor}`}
            </Button>
          )}
        </div>

        {/* SKU line items */}
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
            <span className="col-span-4">SKU / item</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-3">Artwork</span>
            <span className="col-span-2 text-right">Landed cost</span>
            <span className="col-span-1"></span>
          </div>
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-12 sm:col-span-4" value={it.sku} placeholder="e.g. Coffee box" onChange={(e) => updateRow(it.id, { sku: e.target.value })} onBlur={() => saveItems(items)} />
              <Input className="col-span-4 sm:col-span-2" type="text" inputMode="numeric" value={it.quantity ?? ""} placeholder="Qty" onChange={(e) => updateRow(it.id, { quantity: e.target.value })} onBlur={() => saveItems(items)} />
              <div className="col-span-5 sm:col-span-3 text-xs">
                <label className="inline-flex items-center gap-1 cursor-pointer text-brand-600 hover:text-brand-800">
                  <FileText className="h-3.5 w-3.5" />{artRow === it.id ? "Uploading…" : it.artworkUrl ? "Replace" : "Attach"}
                  <input type="file" className="hidden" onChange={(e) => uploadRowArtwork(it.id, e)} disabled={artRow === it.id} />
                </label>
                {it.artworkUrl && <a href={it.artworkUrl} target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:underline truncate">{it.artworkName}</a>}
              </div>
              <Input className="col-span-2 sm:col-span-2 text-right" type="text" inputMode="decimal" value={it.landedCost ?? ""} placeholder="—" onChange={(e) => updateRow(it.id, { landedCost: e.target.value })} onBlur={() => saveItems(items)} />
              <button type="button" className="col-span-1 text-red-500 hover:text-red-700 text-sm" onClick={() => removeRow(it.id)} disabled={items.length <= 1}>×</button>
              {(Number(it.landedCost) > 0 || it.leadTime || it.moq || it.fileUrl || it.vendorNotes) && (
                <p className="col-span-12 text-xs text-gray-500 pl-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {Number(it.landedCost) > 0 && (
                    <span className="font-medium text-gray-600">
                      {/* Unit derived from landed ÷ qty so the equation always
                          reconciles even if C&D edits the landed cost (Benjy 6/20). */}
                      {Number(it.quantity) || 0} × ${(Number(it.landedCost) / (Number(it.quantity) || 1)).toFixed(4)} = ${Number(it.landedCost).toFixed(2)} landed → ${(Number(it.landedCost) * (1 + markupPct / 100)).toFixed(2)} customer
                    </span>
                  )}
                  {it.leadTime ? <span>Lead: {it.leadTime}</span> : null}
                  {it.moq ? <span>MOQ: {Number(it.moq).toLocaleString()}</span> : null}
                  {it.fileUrl ? <a href={it.fileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1"><FileText className="h-3 w-3" />{it.fileName || "vendor file"}</a> : null}
                  {it.vendorNotes ? <span className="w-full">Vendor: {it.vendorNotes}</span> : null}
                </p>
              )}
            </div>
          ))}
          <button type="button" onClick={addRow} className="text-sm font-medium text-brand-600 hover:text-brand-800">+ Add SKU</button>
        </div>

        {/* Pricing — shows once any landed cost exists */}
        {(hasCosts || priceLocked) && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm items-end">
              <div><span className="text-gray-600 block text-xs">Total landed (our cost)</span><strong>{formatCurrency(totalLanded)}</strong></div>
              <div>
                <label className="text-gray-600 block text-xs mb-1">C&D markup %</label>
                <Input type="number" className="h-8" value={markupPct} onChange={(e) => setMarkupPct(Number(e.target.value))} />
              </div>
              <div><span className="text-gray-600 block text-xs">Customer price</span><strong className="text-emerald-800">{formatCurrency(sell)}</strong></div>
              <div><span className="text-gray-600 block text-xs">Our margin</span><strong className="text-emerald-800">{formatCurrency(marginDollars)} ({marginPct.toFixed(0)}%)</strong></div>
              {quote.vendorQuoteFileUrl && (
                <a href={quote.vendorQuoteFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1"><FileText className="h-4 w-4" />{quote.vendorQuoteFileName || "Vendor quote"}</a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-emerald-200 pt-3">
              <Button onClick={setCustomerPrice} disabled={priceBusy || sell <= 0}>
                {priceBusy ? "Saving…" : priceLocked ? "Update customer quote price" : "Set as customer quote price"}
              </Button>
              {priceLocked
                ? <span className="text-xs text-emerald-700">✓ Quote price set to {formatCurrency(quote.totalPrice)} — use "Send to…" / Print Quote above to send the customer.</span>
                : <span className="text-xs text-gray-500">Locks this price into the quote so the normal Send/Print goes to the customer.</span>}
            </div>
            {/* Outcome — drives Martin's Won/Lost tabs (Benjy 6/20) */}
            <div className="flex flex-wrap items-center gap-2 border-t border-emerald-200 pt-3">
              <span className="text-xs text-gray-600 mr-1">Outcome:</span>
              {quote.sourcingStatus === "won"
                ? <Badge className="bg-emerald-100 text-emerald-700">Won</Badge>
                : <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300" disabled={busy} onClick={() => setOutcome("won")}>Mark Won</Button>}
              {quote.sourcingStatus === "lost"
                ? <Badge className="bg-red-100 text-red-700">Lost</Badge>
                : <Button variant="outline" size="sm" className="text-red-600 border-red-200" disabled={busy} onClick={() => setOutcome("lost")}>Mark Lost</Button>}
              {(quote.sourcingStatus === "won" || quote.sourcingStatus === "lost") && (
                <Button variant="ghost" size="sm" className="text-gray-500" disabled={busy} onClick={() => setOutcome("reopen")}>Reopen</Button>
              )}
              <span className="text-[11px] text-gray-400">Won/Lost moves it out of MWI&apos;s active list.</span>
            </div>
          </div>
        )}

        {/* Wholesale fulfillment — only after Won. Lives here on the quote, no
            manufacturing Job, so it never touches internal production. */}
        {quote.sourcingStatus === "won" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-800">Wholesale fulfillment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                { key: "poSent", label: "PO sent to MWI" },
                { key: "received", label: "Goods received at St. Pete" },
                { key: "shipped", label: "Shipped to customer" },
                { key: "invoiced", label: "Customer invoiced" },
              ].map((step) => (
                <label key={step.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    checked={!!(fulfill as any)[step.key]}
                    onChange={(e) => saveFulfill({ ...fulfill, [step.key]: e.target.checked })} />
                  <span className="text-gray-700">{step.label}</span>
                </label>
              ))}
            </div>
            {fulfill.shipped && (
              <div className="pl-6">
                <Input className="h-8 max-w-xs" placeholder="Tracking / carrier (optional)" value={fulfill.tracking || ""}
                  onChange={(e) => setFulfill({ ...fulfill, tracking: e.target.value })} onBlur={() => saveFulfill(fulfill)} />
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-gray-200 pt-2 mt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  checked={!!fulfill.vendorPaid}
                  onChange={(e) => saveFulfill({ ...fulfill, vendorPaid: e.target.checked })} />
                <span className="text-gray-700">MWI paid</span>
              </label>
              <span className="text-xs text-gray-500">Payable to MWI: <strong>{formatCurrency(totalLanded)}</strong> (their landed cost)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerNotesEditor({ quoteId, initial }: { quoteId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      // PUT requires status — preserve current by reading first
      const cur = await fetch(`/api/quotes/${quoteId}`).then(r => r.json());
      const status = cur?.quote?.status || "draft";
      await fetch("/api/quotes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quoteId, status, customerNotes: value }),
      });
      setSavedAt(new Date());
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="e.g., Net 30 payment terms. Delivery includes lift gate. Proofs must be approved within 48 hours."
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Unsaved changes save when you click Save"}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || value === initial}
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
