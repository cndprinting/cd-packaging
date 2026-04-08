"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DollarSign, Check, CreditCard, Loader2, FileText, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  description: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt: string | null;
  balancePaid: boolean;
  balancePaidAt: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  deposit_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  pending: "Payment Due",
  deposit_paid: "Deposit Paid — Balance Due",
  paid: "Paid in Full",
  overdue: "Overdue",
};

export default function PortalPaymentsPage() {
  return <Suspense><PaymentsContent /></Suspense>;
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const success = searchParams.get("success");
  const invoiceNum = searchParams.get("invoice");

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePay = async (invoiceId: string, paymentType: "deposit" | "balance") => {
    setPaying(invoiceId);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", invoiceId, paymentType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe checkout
      } else {
        alert(data.error || "Payment not available. Please call 727-572-9999.");
      }
    } catch {
      alert("Payment failed. Please call 727-572-9999.");
    }
    setPaying(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  const pending = invoices.filter(i => i.status === "pending" || i.status === "deposit_paid");
  const completed = invoices.filter(i => i.status === "paid");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">View invoices and make payments</p>
      </div>

      {/* Success message */}
      {success && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Check className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800">Payment successful!</p>
              <p className="text-sm text-emerald-600">Invoice {invoiceNum} has been updated. Thank you!</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-gray-500">Payments Due</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{completed.length}</p>
          <p className="text-xs text-gray-500">Paid</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(pending.reduce((s, i) => s + (i.depositPaid ? i.total - i.depositAmount : i.depositAmount), 0))}
          </p>
          <p className="text-xs text-gray-500">Amount Due</p>
        </Card>
      </div>

      {/* Pending Invoices */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Payments Due
          </h2>
          {pending.map((inv) => (
            <Card key={inv.id} className="border-l-4 border-l-amber-400">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-mono font-semibold text-gray-900">{inv.invoiceNumber}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{inv.description || "C&D Printing Services"}</p>
                  </div>
                  <Badge className={statusColors[inv.status]}>{statusLabels[inv.status]}</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p className="font-medium">{formatCurrency(inv.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tax (7%)</p>
                    <p className="font-medium">{formatCurrency(inv.taxAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-lg">{formatCurrency(inv.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium">{formatDate(inv.createdAt)}</p>
                  </div>
                </div>

                {/* Payment Progress */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">50% Deposit</span>
                    <span className="text-sm font-medium">{formatCurrency(inv.depositAmount)}</span>
                    {inv.depositPaid ? (
                      <Badge className="bg-emerald-100 text-emerald-700"><Check className="h-3 w-3 mr-1" />Paid</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700">Due</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Balance</span>
                    <span className="text-sm font-medium">{formatCurrency(inv.total - inv.depositAmount)}</span>
                    {inv.balancePaid ? (
                      <Badge className="bg-emerald-100 text-emerald-700"><Check className="h-3 w-3 mr-1" />Paid</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">Due on Delivery</Badge>
                    )}
                  </div>
                </div>

                {/* Pay Button */}
                {!inv.depositPaid && (
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handlePay(inv.id, "deposit")}
                      disabled={paying === inv.id}
                      className="gap-2 bg-brand-600 hover:bg-brand-700 flex-1"
                    >
                      {paying === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Pay Deposit — {formatCurrency(inv.depositAmount)}
                    </Button>
                    <p className="text-xs text-gray-400">3% CC surcharge applies</p>
                  </div>
                )}
                {inv.depositPaid && !inv.balancePaid && (
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handlePay(inv.id, "balance")}
                      disabled={paying === inv.id}
                      className="gap-2 bg-brand-600 hover:bg-brand-700 flex-1"
                    >
                      {paying === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Pay Balance — {formatCurrency(inv.total - inv.depositAmount)}
                    </Button>
                    <p className="text-xs text-gray-400">3% CC surcharge applies</p>
                  </div>
                )}

                {/* Alt payment instructions */}
                <div className="mt-3 text-xs text-gray-400">
                  <p>Other payment options: Check payable to C&D Printing Co. | Wire/ACH: call 727-572-9999 | Credit card by phone: 727-572-9999</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" /> Paid
          </h2>
          {completed.map((inv) => (
            <Card key={inv.id} className="border-l-4 border-l-emerald-400">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-mono font-medium text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">{inv.description || "C&D Printing Services"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(inv.total)}</p>
                  <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {invoices.length === 0 && (
        <Card className="p-12 text-center">
          <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No invoices yet</p>
          <p className="text-xs text-gray-400 mt-1">Invoices will appear here when orders are ready for payment.</p>
        </Card>
      )}
    </div>
  );
}
