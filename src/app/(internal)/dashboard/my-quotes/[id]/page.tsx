"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, Calendar, User, Printer, Package, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
  contactName: string | null;
  contactEmail: string | null;
  productName: string;
  description: string | null;
  quantity: number;
  totalPrice: number;
  status: string;
  validUntil: string;
  notes: string | null;
  specs: string | null;
  convertedJobId: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

const statusLabels: Record<string, string> = {
  sent: "Sent to Customer",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted to Job",
};

export default function MyQuoteDetailPage() {
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  if (!quote) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/my-quotes" className="inline-flex items-center gap-2 text-sm text-gray-500"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <Card className="p-8 text-center"><p className="text-gray-400">Quote not found</p></Card>
      </div>
    );
  }

  let specs: Record<string, any> = {};
  if (quote.specs) { try { specs = JSON.parse(quote.specs); } catch { /* ignore */ } }

  // Customer-facing price with tax
  const tax = quote.totalPrice * 0.07;
  const totalWithTax = quote.totalPrice + tax;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/my-quotes" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
              <Badge className={statusColors[quote.status] || "bg-gray-100 text-gray-600"}>
                {statusLabels[quote.status] || quote.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{quote.productName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(`/dashboard/quotes/${quote.id}/print`, '_blank')} className="gap-2">
            <Printer className="h-4 w-4" /> Print Quote
          </Button>
          {quote.convertedJobId && (
            <Link href={`/dashboard/jobs/${quote.convertedJobId}`}>
              <Button variant="outline" className="gap-2"><Layers className="h-4 w-4" /> View Job</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Pricing — customer-facing only, NO cost breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Quantity</p>
          <p className="text-2xl font-bold text-gray-900">{quote.quantity.toLocaleString()}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Subtotal</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(quote.totalPrice)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Tax (7%)</p>
          <p className="text-2xl font-bold text-gray-600">{formatCurrency(tax)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(totalWithTax)}</p>
        </Card>
      </div>

      {/* Volume tiers — customer-facing pricing only */}
      {specs.quantityTiers && specs.quantityTiers.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Volume Pricing</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {specs.quantityTiers.map((tier: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{tier.quantity.toLocaleString()} units</span>
                  <span className="font-bold">{formatCurrency(tier.total + tier.total * 0.07)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer & Job Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-brand-600" /> Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-gray-500">Customer</span><span className="text-sm font-medium">{quote.customerName}</span></div>
            {quote.contactName && <div className="flex justify-between"><span className="text-sm text-gray-500">Contact</span><span className="text-sm font-medium">{quote.contactName}</span></div>}
            {quote.contactEmail && <div className="flex justify-between"><span className="text-sm text-gray-500">Email</span><span className="text-sm font-medium">{quote.contactEmail}</span></div>}
            <div className="flex justify-between"><span className="text-sm text-gray-500">Date</span><span className="text-sm font-medium">{formatDate(quote.createdAt)}</span></div>
            {quote.validUntil && <div className="flex justify-between"><span className="text-sm text-gray-500">Valid Until</span><span className="text-sm font-medium">{formatDate(quote.validUntil)}</span></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-brand-600" /> Specs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {quote.description && <div className="flex justify-between"><span className="text-sm text-gray-500">Description</span><span className="text-sm font-medium">{quote.description}</span></div>}
            {specs.dimensions && <div className="flex justify-between"><span className="text-sm text-gray-500">Size</span><span className="text-sm font-medium">{specs.dimensions}"</span></div>}
            {specs.colors && <div className="flex justify-between"><span className="text-sm text-gray-500">Colors</span><span className="text-sm font-medium">{specs.colors}</span></div>}
            {specs.stockType && <div className="flex justify-between"><span className="text-sm text-gray-500">Stock</span><span className="text-sm font-medium">{specs.stockType}</span></div>}
            {/* NO press name, NO markups, NO cost breakdown */}
          </CardContent>
        </Card>
      </div>

      {quote.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
