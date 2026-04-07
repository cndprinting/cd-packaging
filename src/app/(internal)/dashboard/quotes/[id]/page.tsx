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
  specs: string | null;
  convertedJobId: string | null;
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
          // Reload to get the convertedJobId
          const r = await fetch(`/api/quotes/${quote.id}`);
          const d = await r.json();
          if (d.quote) setQuote(d.quote);
        }
      }
    } catch { /* ignore */ }
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
              <Badge className={statusColors[quote.status] || "bg-gray-100 text-gray-600"}>
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{quote.productName}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {(quote.status === "draft" || quote.status === "sent") && (
            <>
              <Button onClick={() => updateStatus("sent")} disabled={updating || quote.status === "sent"} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4" /> Send to Customer
              </Button>
              <Button variant="outline" onClick={() => { /* TODO: Send internal email */ alert("Send to CSR/Salesperson — email integration coming soon"); }} className="gap-2">
                <Mail className="h-4 w-4" /> Send Internal
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" /> Print Quote
              </Button>
            </>
          )}
          {quote.status === "sent" && (
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
              <Button onClick={() => updateStatus("converted")} disabled={updating} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <Package className="h-4 w-4" /> Convert to Job
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
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
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Per 1,000</p>
          <p className="text-2xl font-bold text-gray-900">
            {quote.quantity > 0 ? formatCurrency((quote.totalPrice / quote.quantity) * 1000) : "—"}
          </p>
        </Card>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <DetailRow
              icon={Layers}
              label="Product Type"
              value={quote.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"}
            />
            <DetailRow icon={Calendar} label="Created" value={formatDate(quote.createdAt)} />
            {quote.validUntil && <DetailRow icon={Clock} label="Valid Until" value={formatDate(quote.validUntil)} />}
          </CardContent>
        </Card>

        <Card>
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
        </Card>
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

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
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
