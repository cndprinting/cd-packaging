"use client";

import { useState, useEffect, useMemo } from "react";
import { DollarSign, Search, Send, Check, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  contactEmail: string | null;
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
  jobId: string | null;
  dueDate: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  deposit_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  deposit_paid: "Deposit Paid",
  paid: "Paid in Full",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => invoices.filter((inv) => {
    if (search && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) && !inv.customerName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && inv.status !== statusFilter) return false;
    return true;
  }), [invoices, search, statusFilter]);

  const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalDeposits = invoices.filter(i => i.status === "deposit_paid").reduce((s, i) => s + i.depositAmount, 0);

  const handleSendInvoice = async (inv: Invoice) => {
    if (!inv.contactEmail) {
      const email = prompt("Customer email address:");
      if (!email) return;
      inv.contactEmail = email;
    }
    setSending(inv.id);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: inv.contactEmail,
          subject: `Invoice ${inv.invoiceNumber} - ${formatCurrency(inv.total)} | C&D Printing`,
          body: `
            <div style="font-family:Arial,sans-serif;max-width:600px;">
              <div style="background:linear-gradient(135deg,#ED1C24,#27AAE1);padding:3px;"></div>
              <div style="padding:24px;">
                <h2 style="margin:0 0 4px;">Invoice from C&D Printing Co.</h2>
                <p style="color:#666;margin:0 0 20px;">12150 28th Street N., St. Petersburg, FL 33716</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:8px 0;color:#888;">Invoice #</td><td style="padding:8px 0;font-weight:bold;">${inv.invoiceNumber}</td></tr>
                  <tr><td style="padding:8px 0;color:#888;">Description</td><td style="padding:8px 0;">${inv.description || "C&D Printing Services"}</td></tr>
                  <tr><td style="padding:8px 0;color:#888;">Subtotal</td><td style="padding:8px 0;">${formatCurrency(inv.subtotal)}</td></tr>
                  <tr><td style="padding:8px 0;color:#888;">Tax (7%)</td><td style="padding:8px 0;">${formatCurrency(inv.taxAmount)}</td></tr>
                  <tr style="border-top:2px solid #ED1C24;"><td style="padding:12px 0;font-weight:bold;">Total</td><td style="padding:12px 0;font-size:20px;font-weight:bold;color:#ED1C24;">${formatCurrency(inv.total)}</td></tr>
                </table>
                <p style="color:#666;font-size:14px;"><strong>50% deposit (${formatCurrency(inv.depositAmount)}) due before production.</strong></p>
                <p style="color:#666;font-size:14px;">Balance due upon delivery. 3% surcharge on credit card payments.</p>
                <a href="https://packaging.cndprinting.com/portal/payments" style="display:inline-block;background:#ED1C24;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">Pay Online</a>
                <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
                <p style="color:#999;font-size:12px;">C&D Printing Co. | 727-572-9999 | Pay by phone or mail check to 12150 28th St N., St. Petersburg, FL 33716</p>
              </div>
              <div style="background:linear-gradient(135deg,#ED1C24,#27AAE1);padding:3px;"></div>
            </div>
          `,
        }),
      });
      if (res.ok) {
        alert(`Invoice sent to ${inv.contactEmail}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send");
      }
    } catch { alert("Failed to send"); }
    setSending(null);
  };

  const handleMarkPaid = async (inv: Invoice, paymentType: "deposit" | "balance") => {
    setMarking(inv.id);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", invoiceId: inv.id, paymentType }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, ...data.invoice } : i));
      }
    } catch { /* ignore */ }
    setMarking(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-sm text-gray-500">{invoices.length} invoices</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          <p className="text-xs text-gray-500">Total Invoices</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalDeposits)}</p>
          <p className="text-xs text-gray-500">Deposits Received</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-gray-500">Paid in Full</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
            { value: "", label: "All Statuses" },
            { value: "pending", label: "Pending" },
            { value: "deposit_paid", label: "Deposit Paid" },
            { value: "paid", label: "Paid" },
            { value: "overdue", label: "Overdue" },
          ]} className="w-40" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-gray-50">
                <TableCell className="font-mono font-medium text-gray-900">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.customerName}</TableCell>
                <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{inv.description || "—"}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(inv.total)}</TableCell>
                <TableCell className="text-right">
                  {inv.depositPaid ? (
                    <span className="text-emerald-600 font-medium">{formatCurrency(inv.depositAmount)} <Check className="h-3 w-3 inline" /></span>
                  ) : (
                    <span className="text-amber-600">{formatCurrency(inv.depositAmount)}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[inv.status] || "bg-gray-100 text-gray-600"}>
                    {statusLabels[inv.status] || inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">{formatDate(inv.createdAt)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="gap-1 text-blue-600" disabled={sending === inv.id} onClick={() => handleSendInvoice(inv)}>
                      {sending === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send
                    </Button>
                    {!inv.depositPaid && (
                      <Button variant="ghost" size="sm" className="gap-1 text-emerald-600" disabled={marking === inv.id} onClick={() => handleMarkPaid(inv, "deposit")}>
                        <Check className="h-3.5 w-3.5" /> Deposit
                      </Button>
                    )}
                    {inv.depositPaid && !inv.balancePaid && (
                      <Button variant="ghost" size="sm" className="gap-1 text-emerald-600" disabled={marking === inv.id} onClick={() => handleMarkPaid(inv, "balance")}>
                        <Check className="h-3.5 w-3.5" /> Balance
                      </Button>
                    )}
                    {inv.jobId && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => window.location.href = `/dashboard/jobs/${inv.jobId}`}>
                        View Job
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No invoices yet</p>
                <p className="text-xs mt-1">Create invoices from the job detail page</p>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
