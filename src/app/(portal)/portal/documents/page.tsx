"use client";

import React, { useState, useMemo } from "react";
import { demoJobs } from "@/lib/demo-data";
import { cn, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileImage, Download, Search } from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

const docTypes = ["artwork", "proof", "po", "shipping", "spec"];
const typeBadge: Record<string, string> = { artwork: "bg-purple-100 text-purple-700", proof: "bg-blue-100 text-blue-700", po: "bg-amber-100 text-amber-700", shipping: "bg-green-100 text-green-700", spec: "bg-gray-100 text-gray-700" };

export default function PortalDocumentsPage() {
  const customerJobs = demoJobs.filter((j) => j.companyId === CUSTOMER_COMPANY_ID);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const documents = useMemo(() => {
    const docs = customerJobs.flatMap((j) => [
      { id: `${j.id}-art`, name: `${j.name} - Artwork.pdf`, type: "artwork", order: j.orderNumber, date: j.dueDate, size: "2.4 MB" },
      { id: `${j.id}-proof`, name: `${j.name} - Proof v1.pdf`, type: "proof", order: j.orderNumber, date: j.dueDate, size: "5.1 MB" },
      { id: `${j.id}-spec`, name: `${j.name} - Spec Sheet.pdf`, type: "spec", order: j.orderNumber, date: j.dueDate, size: "890 KB" },
    ]);
    return docs.filter((d) => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && d.type !== typeFilter) return false;
      return true;
    });
  }, [customerJobs, search, typeFilter]);

  const handleDownload = (doc: { name: string }) => {
    const content = `C&D Packaging Document\n\nFile: ${doc.name}\nGenerated: ${new Date().toISOString()}\n\nThis is a placeholder document. In production, the actual file would be served from cloud storage.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name.replace(".pdf", ".txt");
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          <Button variant={typeFilter === "" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("")}>All</Button>
          {docTypes.map((t) => <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)} className="capitalize">{t}</Button>)}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Size</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell><Badge className={typeBadge[d.type] || "bg-gray-100 text-gray-600"}>{d.type}</Badge></TableCell>
                <TableCell className="text-gray-500">{d.order}</TableCell>
                <TableCell className="text-gray-500">{formatDate(d.date)}</TableCell>
                <TableCell className="text-gray-500">{d.size}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(d)}>
                    <Download className="h-3.5 w-3.5" />Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {documents.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No documents found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
