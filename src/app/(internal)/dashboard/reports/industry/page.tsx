"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Building2, Users, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Company {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface IndustryGroup {
  industry: string;
  count: number;
  companies: Company[];
}

export default function IndustryReportPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies?type=customer")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Company[]>();
    for (const c of companies) {
      const ind = c.industry || "Uncategorized";
      if (!map.has(ind)) map.set(ind, []);
      map.get(ind)!.push(c);
    }
    return Array.from(map.entries())
      .map(([industry, comps]) => ({ industry, count: comps.length, companies: comps }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.industry.toLowerCase().includes(q));
  }, [groups, search]);

  const selectedGroup = selectedIndustry ? groups.find((g) => g.industry === selectedIndustry) : null;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers by Industry</h1>
            <p className="text-sm text-gray-500">{companies.length} customers across {groups.length} industries</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="gap-2 print:hidden">Print Report</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
          <p className="text-xs text-gray-500">Total Customers</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{groups.length}</p>
          <p className="text-xs text-gray-500">Industries</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{groups[0]?.industry || "—"}</p>
          <p className="text-xs text-gray-500">Largest Industry</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{groups[0]?.count || 0}</p>
          <p className="text-xs text-gray-500">Customers in Top</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Industry List */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Filter industries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Industries ({filteredGroups.length})</CardTitle></CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-1">
              {filteredGroups.map((g) => (
                <button
                  key={g.industry}
                  onClick={() => setSelectedIndustry(selectedIndustry === g.industry ? null : g.industry)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    selectedIndustry === g.industry
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">{g.industry}</span>
                  <Badge className={selectedIndustry === g.industry ? "bg-brand-200 text-brand-800" : "bg-gray-100 text-gray-600"}>
                    {g.count}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Distribution</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {groups.slice(0, 15).map((g) => {
                const pct = (g.count / companies.length) * 100;
                return (
                  <div key={g.industry}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate max-w-[150px]">{g.industry}</span>
                      <span className="text-gray-500 shrink-0">{g.count} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Company List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-600" />
                {selectedGroup ? `${selectedGroup.industry} (${selectedGroup.count})` : `All Customers (${companies.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedGroup ? selectedGroup.companies : companies.slice(0, 100)).map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/customers/${c.id}`}>
                      <TableCell className="font-medium text-brand-600 hover:underline">{c.name}</TableCell>
                      <TableCell><Badge className="bg-gray-100 text-gray-600 text-xs">{c.industry || "—"}</Badge></TableCell>
                      <TableCell className="text-sm text-gray-600">{c.phone || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-500">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!selectedGroup && companies.length > 100 && (
                <p className="text-xs text-gray-400 text-center mt-4">Showing first 100 — select an industry to filter</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
