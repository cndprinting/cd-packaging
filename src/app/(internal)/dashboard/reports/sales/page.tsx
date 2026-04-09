"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Users, DollarSign, TrendingUp, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Quote {
  id: string;
  quoteNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  createdBy: string | null;
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

interface RepSummary {
  id: string;
  name: string;
  role: string;
  totalQuotes: number;
  totalValue: number;
  approved: number;
  converted: number;
  rejected: number;
  pending: number;
  conversionRate: number;
}

export default function SalesReportPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRep, setSelectedRep] = useState("");
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/quotes").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
    ]).then(([qd, ud]) => {
      setQuotes(qd.quotes || []);
      setUsers(ud.users || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredQuotes = useMemo(() => {
    let q = quotes;
    if (period !== "all") {
      const now = new Date();
      const daysAgo = period === "30" ? 30 : period === "90" ? 90 : 365;
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      q = q.filter(quote => new Date(quote.createdAt) >= cutoff);
    }
    return q;
  }, [quotes, period]);

  const repSummaries = useMemo(() => {
    const repMap = new Map<string, RepSummary>();

    for (const user of users) {
      if (!["SALES_REP", "SALES_MANAGER", "CSR", "OWNER", "GM", "ADMIN"].includes(user.role)) continue;
      repMap.set(user.id, {
        id: user.id,
        name: user.name,
        role: user.role,
        totalQuotes: 0,
        totalValue: 0,
        approved: 0,
        converted: 0,
        rejected: 0,
        pending: 0,
        conversionRate: 0,
      });
    }

    for (const quote of filteredQuotes) {
      if (!quote.createdBy) continue;
      const rep = repMap.get(quote.createdBy);
      if (!rep) continue;
      rep.totalQuotes++;
      rep.totalValue += quote.totalPrice;
      if (quote.status === "approved") rep.approved++;
      if (quote.status === "converted") rep.converted++;
      if (quote.status === "rejected") rep.rejected++;
      if (quote.status === "sent" || quote.status === "draft") rep.pending++;
    }

    for (const rep of repMap.values()) {
      const decided = rep.approved + rep.converted + rep.rejected;
      rep.conversionRate = decided > 0 ? Math.round(((rep.approved + rep.converted) / decided) * 100) : 0;
    }

    return Array.from(repMap.values())
      .filter(r => r.totalQuotes > 0)
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredQuotes, users]);

  const totalValue = repSummaries.reduce((s, r) => s + r.totalValue, 0);
  const totalQuotes = repSummaries.reduce((s, r) => s + r.totalQuotes, 0);
  const totalConverted = repSummaries.reduce((s, r) => s + r.converted + r.approved, 0);
  const avgConversion = totalQuotes > 0 ? Math.round((totalConverted / totalQuotes) * 100) : 0;

  const selectedRepQuotes = selectedRep
    ? filteredQuotes.filter(q => q.createdBy === selectedRep)
    : filteredQuotes;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales by Rep</h1>
            <p className="text-sm text-gray-500">Quote volume, conversion rates, and revenue by team member</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={[
            { value: "all", label: "All Time" },
            { value: "30", label: "Last 30 Days" },
            { value: "90", label: "Last 90 Days" },
            { value: "365", label: "Last Year" },
          ]} className="w-36" />
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalQuotes}</p>
          <p className="text-xs text-gray-500">Total Quotes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-gray-500">Total Value</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalConverted}</p>
          <p className="text-xs text-gray-500">Won</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{avgConversion}%</p>
          <p className="text-xs text-gray-500">Conversion Rate</p>
        </Card>
      </div>

      {/* Rep Summary Table */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-brand-600" /> Sales Team Performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Lost</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repSummaries.map((rep) => (
                <TableRow key={rep.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedRep(selectedRep === rep.id ? "" : rep.id)}>
                  <TableCell className={`font-medium ${selectedRep === rep.id ? "text-brand-600" : ""}`}>{rep.name}</TableCell>
                  <TableCell><Badge className="bg-gray-100 text-gray-600 text-xs">{rep.role.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-right">{rep.totalQuotes}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(rep.totalValue)}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">{rep.approved + rep.converted}</TableCell>
                  <TableCell className="text-right text-amber-600">{rep.pending}</TableCell>
                  <TableCell className="text-right text-red-600">{rep.rejected}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={rep.conversionRate >= 50 ? "bg-emerald-100 text-emerald-700" : rep.conversionRate >= 25 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
                      {rep.conversionRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {repSummaries.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-400">No quote data yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Individual Quotes */}
      {selectedRep && (
        <Card>
          <CardHeader><CardTitle className="text-base">Quotes by {repSummaries.find(r => r.id === selectedRep)?.name}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRepQuotes.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/quotes/${q.id}`}>
                    <TableCell className="font-mono text-brand-600">{q.quoteNumber}</TableCell>
                    <TableCell>{q.customerName}</TableCell>
                    <TableCell>{q.productName}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.totalPrice)}</TableCell>
                    <TableCell><Badge className={q.status === "converted" || q.status === "approved" ? "bg-emerald-100 text-emerald-700" : q.status === "rejected" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}>{q.status}</Badge></TableCell>
                    <TableCell className="text-gray-500">{formatDate(q.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
