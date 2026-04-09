"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, TrendingUp, DollarSign, Package, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface Quote {
  id: string;
  quoteNumber: string;
  customerName: string;
  totalPrice: number;
  status: string;
  createdAt: string;
}

interface MonthData {
  month: string;
  label: string;
  quotesCreated: number;
  quotesValue: number;
  quotesWon: number;
  wonValue: number;
}

export default function RevenueTrendsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    fetch("/api/quotes").then(r => r.json()).then(d => setQuotes(d.quotes || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const monthlyData = useMemo(() => {
    const data: MonthData[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      const monthQuotes = quotes.filter(q => q.createdAt.startsWith(monthKey));
      const won = monthQuotes.filter(q => q.status === "approved" || q.status === "converted");

      data.push({
        month: monthKey,
        label,
        quotesCreated: monthQuotes.length,
        quotesValue: monthQuotes.reduce((s, q) => s + q.totalPrice, 0),
        quotesWon: won.length,
        wonValue: won.reduce((s, q) => s + q.totalPrice, 0),
      });
    }
    return data;
  }, [quotes, months]);

  const totalValue = monthlyData.reduce((s, m) => s + m.quotesValue, 0);
  const totalWonValue = monthlyData.reduce((s, m) => s + m.wonValue, 0);
  const totalQuotes = monthlyData.reduce((s, m) => s + m.quotesCreated, 0);
  const totalWon = monthlyData.reduce((s, m) => s + m.quotesWon, 0);
  const maxValue = Math.max(...monthlyData.map(m => m.quotesValue), 1);

  // Top customers by value
  const customerTotals = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const q of quotes) {
      const existing = map.get(q.customerName) || { name: q.customerName, value: 0, count: 0 };
      existing.value += q.totalPrice;
      existing.count++;
      map.set(q.customerName, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [quotes]);

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
            <h1 className="text-2xl font-bold text-gray-900">Revenue Trends</h1>
            <p className="text-sm text-gray-500">Quote volume and revenue over time</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} options={[
            { value: "3", label: "3 Months" },
            { value: "6", label: "6 Months" },
            { value: "12", label: "12 Months" },
          ]} className="w-32" />
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalQuotes}</p>
          <p className="text-xs text-gray-500">Quotes Created</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-gray-500">Total Quoted</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalWonValue)}</p>
          <p className="text-xs text-gray-500">Won Revenue</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalQuotes > 0 ? Math.round((totalWon / totalQuotes) * 100) : 0}%</p>
          <p className="text-xs text-gray-500">Win Rate</p>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand-600" /> Monthly Trend</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2" style={{ height: 200 }}>
            {monthlyData.map((m) => {
              const height = maxValue > 0 ? (m.quotesValue / maxValue) * 180 : 0;
              const wonHeight = maxValue > 0 ? (m.wonValue / maxValue) * 180 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: 180 }}>
                    <div className="w-full max-w-12 rounded-t-md bg-gray-200 relative" style={{ height: Math.max(height, 2) }}>
                      <div className="absolute bottom-0 w-full rounded-t-md bg-brand-500" style={{ height: Math.max(wonHeight, 0) }} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 text-center">{m.label}</p>
                  <p className="text-[9px] font-medium text-gray-700">{formatCurrency(m.quotesValue)}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-200" /> Quoted</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-brand-500" /> Won</div>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-brand-600" /> Top Customers by Quote Value</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {customerTotals.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.count} quote{c.count !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(c.value)}</span>
              </div>
            ))}
            {customerTotals.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No quote data yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
