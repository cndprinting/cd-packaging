"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Quote {
  id: string;
  quoteNumber: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  validUntil: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

export default function PortalQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((d) => setQuotes((d.quotes || []).filter((q: Quote) => q.status !== "draft")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quotes & Estimates</h1>
        <p className="text-sm text-gray-500 mt-1">Review and approve quotes from C&D Printing</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{quotes.filter(q => q.status === "sent").length}</p>
          <p className="text-xs text-gray-500">Awaiting Your Approval</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{quotes.filter(q => q.status === "approved").length}</p>
          <p className="text-xs text-gray-500">Approved</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{quotes.length}</p>
          <p className="text-xs text-gray-500">Total Quotes</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((q) => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/portal/quotes/${q.id}`}>
                <TableCell className="font-mono font-medium text-brand-600">{q.quoteNumber}</TableCell>
                <TableCell className="font-medium">{q.productName}</TableCell>
                <TableCell className="text-right">{q.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(q.totalPrice)}</TableCell>
                <TableCell>
                  <Badge className={statusColors[q.status] || "bg-gray-100 text-gray-600"}>
                    {q.status === "sent" ? "Awaiting Approval" : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">{formatDate(q.createdAt)}</TableCell>
              </TableRow>
            ))}
            {quotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No quotes yet</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
