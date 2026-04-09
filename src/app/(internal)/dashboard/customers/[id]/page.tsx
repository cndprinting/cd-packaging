"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Building2, Phone, MapPin, Mail,
  DollarSign, Package, FileText, User, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";

interface CompanyDetail {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  totalRevenue: number;
  totalJobs: number;
  activeJobs: number;
  totalOrders: number;
  totalQuotes: number;
  contacts: { id: string; name: string; email: string | null; phone: string | null; title: string | null }[];
  orders: { id: string; orderNumber: string; status: string; priority: string; dueDate: string | null; createdAt: string; totalAmount: number | null; jobs: { id: string; jobNumber: string; name: string; status: string; quantity: number }[] }[];
}

interface Quote {
  id: string;
  quoteNumber: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.company) setCompany(d.company);
        if (d.quotes) setQuotes(d.quotes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/customers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Back to Customers</Link>
        <Card className="p-8 text-center"><p className="text-gray-400">Customer not found</p></Card>
      </div>
    );
  }

  const address = [company.address, company.city, company.state, company.zip].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/customers" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {company.industry && <Badge className="bg-gray-100 text-gray-600">{company.industry}</Badge>}
              {company.phone && <span className="text-sm text-gray-500">{company.phone}</span>}
            </div>
          </div>
        </div>
        <Link href={`/dashboard/quotes/estimate`}>
          <Button className="gap-2"><DollarSign className="h-4 w-4" /> New Estimate</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(company.totalRevenue)}</p>
          <p className="text-xs text-gray-500">Total Revenue</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{company.totalOrders}</p>
          <p className="text-xs text-gray-500">Orders</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{company.totalJobs}</p>
          <p className="text-xs text-gray-500">Total Jobs</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{company.activeJobs}</p>
          <p className="text-xs text-gray-500">Active Jobs</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{company.totalQuotes}</p>
          <p className="text-xs text-gray-500">Quotes</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-600" /> Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {company.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{company.phone}</span>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{address}</span>
              </div>
            )}
            {company.industry && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{company.industry}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-brand-600" /> Contacts</CardTitle></CardHeader>
          <CardContent>
            {company.contacts.length > 0 ? (
              <div className="space-y-3">
                {company.contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                    </div>
                    <div className="text-right">
                      {c.email && <p className="text-xs text-gray-600">{c.email}</p>}
                      {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No contacts on file</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quotes */}
      {quotes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-brand-600" /> Quotes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Quote #</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/dashboard/quotes/${q.id}`}>
                    <TableCell className="font-mono font-medium text-brand-600">{q.quoteNumber}</TableCell>
                    <TableCell>{q.productName}</TableCell>
                    <TableCell className="text-right">{q.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.totalPrice)}</TableCell>
                    <TableCell><Badge className={getStatusColor(q.status.toUpperCase())}>{getStatusLabel(q.status.toUpperCase())}</Badge></TableCell>
                    <TableCell className="text-gray-500">{formatDate(q.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Orders & Jobs */}
      {company.orders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-brand-600" /> Orders & Jobs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {company.orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/dashboard/orders/${order.id}`} className="font-mono font-medium text-brand-600 hover:underline">{order.orderNumber}</Link>
                      <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(order.createdAt)}</span>
                  </div>
                  {order.jobs.length > 0 && (
                    <div className="space-y-1">
                      {order.jobs.map((job) => (
                        <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-gray-500">{job.jobNumber}</span>
                            <span className="text-sm text-gray-900">{job.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{job.quantity.toLocaleString()} units</span>
                            <Badge className={`${getStatusColor(job.status)} text-[10px]`}>{getStatusLabel(job.status)}</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Die Inventory */}
      <DieInventory customerName={company.name} />

      {/* Empty state */}
      {company.orders.length === 0 && quotes.length === 0 && (
        <Card className="p-8 text-center">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No orders or quotes yet for this customer</p>
          <Link href="/dashboard/quotes/estimate"><Button className="mt-4 gap-2"><DollarSign className="h-4 w-4" /> Create First Estimate</Button></Link>
        </Card>
      )}
    </div>
  );
}

function DieInventory({ customerName }: { customerName: string }) {
  const [dies, setDies] = useState<{ id: string; dieNumber: string; item: string | null; description: string | null; length: number | null; width: number | null; notes: string | null }[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`/api/dies?customer=${encodeURIComponent(customerName)}`)
      .then(r => r.json())
      .then(d => { setDies(d.dies || []); setTotal(d.total || 0); })
      .catch(() => {});
  }, [customerName]);

  if (dies.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-brand-600" style={{ animation: "none" }} />
          Cutting Dies ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Die #</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dies.map((die) => (
              <TableRow key={die.id}>
                <TableCell className="font-mono font-medium">{die.dieNumber}</TableCell>
                <TableCell>{die.item || "—"}</TableCell>
                <TableCell className="text-sm text-gray-600">{die.description || "—"}</TableCell>
                <TableCell className="text-sm">{die.length && die.width ? `${die.length} x ${die.width}` : "—"}</TableCell>
                <TableCell className="text-xs text-gray-500">{die.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
