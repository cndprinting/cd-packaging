"use client";

import { useState, useEffect, useMemo } from "react";
import { DollarSign, Search, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Quote {
  id: string;
  quoteNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  validUntil: string;
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

export default function MyQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((d) => {
        // Only show finished quotes (not drafts — those are still being estimated)
        const finished = (d.quotes || []).filter((q: Quote) => q.status !== "draft");
        setQuotes(finished);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => quotes.filter((q) => {
    if (search && !q.quoteNumber.toLowerCase().includes(search.toLowerCase()) && !q.customerName.toLowerCase().includes(search.toLowerCase()) && !q.productName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && q.status !== statusFilter) return false;
    return true;
  }), [quotes, search, statusFilter]);

  const totalValue = quotes.reduce((s, q) => s + q.totalPrice, 0);
  const approved = quotes.filter(q => q.status === "approved" || q.status === "converted").length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Quotes</h1>
          <p className="text-sm text-gray-500">{quotes.length} finished quotes</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{quotes.length}</p>
          <p className="text-xs text-gray-500">Total Quotes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{approved}</p>
          <p className="text-xs text-gray-500">Won</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-gray-500">Total Value</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search quotes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
            { value: "", label: "All Statuses" },
            { value: "sent", label: "Sent" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "converted", label: "Converted" },
          ]} className="w-36" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((q) => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/my-quotes/${q.id}`}>
                <TableCell className="font-mono font-medium text-brand-600">{q.quoteNumber}</TableCell>
                <TableCell>{q.customerName}</TableCell>
                <TableCell className="font-medium">{q.productName}</TableCell>
                <TableCell className="text-right">{q.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(q.totalPrice)}</TableCell>
                <TableCell>
                  <Badge className={statusColors[q.status] || "bg-gray-100 text-gray-600"}>
                    {statusLabels[q.status] || q.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">{formatDate(q.createdAt)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No quotes found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
