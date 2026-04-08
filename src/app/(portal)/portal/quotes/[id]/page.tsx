"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, X, FileText, Printer, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
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

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

export default function PortalQuoteDetailPage() {
  const params = useParams();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quotes/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.quote) setQuote(d.quote); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!quote) return;
    setUpdating(true);
    try {
      await fetch("/api/quotes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id, status }),
      });
      setQuote((prev) => prev ? { ...prev, status } : null);
      setDecided(true);
    } catch { /* ignore */ }
    setUpdating(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  if (!quote) {
    return (
      <div className="space-y-6">
        <Link href="/portal/quotes" className="inline-flex items-center gap-2 text-sm text-gray-500"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <Card className="p-8 text-center"><p className="text-gray-400">Quote not found</p></Card>
      </div>
    );
  }

  let specs: Record<string, any> = {};
  if (quote.specs) { try { specs = JSON.parse(quote.specs); } catch { /* ignore */ } }

  const SALES_TAX_RATE = 0.07;
  const tax = quote.totalPrice * SALES_TAX_RATE;
  const totalWithTax = quote.totalPrice + tax;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/quotes" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
              <Badge className={statusColors[quote.status] || "bg-gray-100 text-gray-600"}>
                {quote.status === "sent" ? "Awaiting Your Approval" : quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{quote.productName}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.open(`/dashboard/quotes/${quote.id}/print`, '_blank')} className="gap-2">
          <Printer className="h-4 w-4" /> View PDF
        </Button>
      </div>

      {/* Pricing */}
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Quoted Price</p>
            <p className="text-4xl font-bold text-brand-600">{formatCurrency(totalWithTax)}</p>
            <p className="text-xs text-gray-400 mt-1">{formatCurrency(quote.totalPrice)} + {formatCurrency(tax)} tax</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <p className="text-xs text-gray-500">Quantity</p>
              <p className="text-lg font-bold">{quote.quantity.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Per Unit</p>
              <p className="text-lg font-bold">{formatCurrency(quote.unitPrice)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Valid Until</p>
              <p className="text-lg font-bold">{formatDate(quote.validUntil)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantity Tiers */}
      {specs.quantityTiers && specs.quantityTiers.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Volume Pricing</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {specs.quantityTiers.map((tier: any, i: number) => {
                const tierTax = tier.total * SALES_TAX_RATE;
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{tier.quantity.toLocaleString()} units</span>
                    <span className="font-bold text-brand-600">{formatCurrency(tier.total + tierTax)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-brand-600" /> Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {quote.description && <div className="flex justify-between"><span className="text-sm text-gray-500">Description</span><span className="text-sm font-medium">{quote.description}</span></div>}
          {specs.dimensions && <div className="flex justify-between"><span className="text-sm text-gray-500">Size</span><span className="text-sm font-medium">{specs.dimensions}"</span></div>}
          {specs.colors && <div className="flex justify-between"><span className="text-sm text-gray-500">Colors</span><span className="text-sm font-medium">{specs.colors}</span></div>}
          {specs.pressName && <div className="flex justify-between"><span className="text-sm text-gray-500">Press</span><span className="text-sm font-medium">{specs.pressName}</span></div>}
          {specs.stockType && <div className="flex justify-between"><span className="text-sm text-gray-500">Stock</span><span className="text-sm font-medium">{specs.stockType}</span></div>}
          <div className="flex justify-between"><span className="text-sm text-gray-500">Date</span><span className="text-sm font-medium">{formatDate(quote.createdAt)}</span></div>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card className="bg-gray-50">
        <CardContent className="p-4 text-xs text-gray-600 space-y-1">
          <p><strong>Payment Terms:</strong> 50% deposit required before production. Balance due upon delivery.</p>
          <p><strong>Credit Card:</strong> 3% processing surcharge applies.</p>
          <p><strong>Sales Tax:</strong> 7% FL sales tax included in quoted price.</p>
          <p><strong>Overruns/Underruns:</strong> Industry standard +/- 10%.</p>
        </CardContent>
      </Card>

      {/* Approval Buttons */}
      {quote.status === "sent" && !decided && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6 text-center">
            <p className="text-lg font-semibold text-gray-900 mb-2">Ready to proceed?</p>
            <p className="text-sm text-gray-600 mb-6">Approve this quote to start production, or reject to request changes.</p>
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => handleDecision("approved")}
                disabled={updating}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 px-8 py-3 text-lg"
              >
                {updating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Approve Quote
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDecision("rejected")}
                disabled={updating}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50 px-8 py-3 text-lg"
              >
                <X className="h-5 w-5" /> Request Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {decided && quote.status === "approved" && (
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardContent className="p-6 text-center">
            <Check className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-lg font-semibold text-emerald-800">Quote Approved!</p>
            <p className="text-sm text-emerald-600 mt-1">Thank you! C&D Printing will begin production shortly.</p>
          </CardContent>
        </Card>
      )}

      {decided && quote.status === "rejected" && (
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <X className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-red-800">Changes Requested</p>
            <p className="text-sm text-red-600 mt-1">Your sales rep will follow up with a revised quote.</p>
          </CardContent>
        </Card>
      )}

      {quote.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
