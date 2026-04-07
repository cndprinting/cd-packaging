"use client";

import { useState, useEffect, useMemo } from "react";
import { Warehouse, Search, Plus, X, Loader2, Phone, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Vendor {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  industry: string | null;
  contacts?: { name: string; email: string | null; phone: string | null; title: string | null }[];
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/companies?type=vendor")
      .then((r) => r.json())
      .then((d) => setVendors(d.companies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.state?.toLowerCase().includes(q) ||
        v.phone?.includes(q)
    );
  }, [vendors, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
            <p className="text-sm text-gray-500 mt-1">{vendors.length} vendors</p>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search vendors by name, city, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => (
              <TableRow key={v.id} className="hover:bg-gray-50">
                <TableCell>
                  <p className="font-medium text-gray-900">{v.name}</p>
                </TableCell>
                <TableCell>
                  {v.contacts && v.contacts.length > 0 ? (
                    <div>
                      <p className="text-sm text-gray-900">{v.contacts[0].name}</p>
                      {v.contacts[0].email && (
                        <p className="text-xs text-gray-500">{v.contacts[0].email}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {v.phone ? (
                    <span className="text-sm text-gray-700">{v.phone}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {v.city || v.state ? (
                    <span className="text-sm text-gray-700">
                      {[v.city, v.state].filter(Boolean).join(", ")} {v.zip || ""}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                  {search ? `No vendors matching "${search}"` : "No vendors found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
