"use client";

import React from "react";
import { demoJobs } from "@/lib/demo-data";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  FileText, Download, Search, Image, FileSpreadsheet, File, Filter,
} from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

interface Document {
  id: string;
  name: string;
  type: "artwork" | "proof" | "purchase_order" | "shipping_doc" | "invoice" | "specification";
  jobNumber: string;
  jobName: string;
  date: string;
  size: string;
}

function generateDocuments(): Document[] {
  const myJobs = demoJobs.filter((j) => j.companyId === CUSTOMER_COMPANY_ID);
  const docs: Document[] = [];

  myJobs.forEach((job, idx) => {
    // Artwork file for every job
    docs.push({
      id: `doc-art-${job.id}`,
      name: `${job.name.replace(/\s+/g, "_")}_Artwork_v2.pdf`,
      type: "artwork",
      jobNumber: job.jobNumber,
      jobName: job.name,
      date: new Date(new Date(job.dueDate).getTime() - 20 * 86400000).toISOString(),
      size: `${(2.4 + idx * 0.3).toFixed(1)} MB`,
    });

    // Proof for jobs past proofing
    const pastProof = [
      "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED",
      "SCHEDULED", "PRINTING", "COATING_FINISHING", "DIE_CUTTING",
      "GLUING_FOLDING", "QA", "PACKED", "SHIPPED", "DELIVERED", "INVOICED",
    ];
    if (pastProof.includes(job.status)) {
      docs.push({
        id: `doc-proof-${job.id}`,
        name: `${job.jobNumber}_Proof_Approved.pdf`,
        type: "proof",
        jobNumber: job.jobNumber,
        jobName: job.name,
        date: new Date(new Date(job.dueDate).getTime() - 14 * 86400000).toISOString(),
        size: `${(1.1 + idx * 0.2).toFixed(1)} MB`,
      });
    }

    // PO for all
    docs.push({
      id: `doc-po-${job.id}`,
      name: `PO_${job.orderNumber}.pdf`,
      type: "purchase_order",
      jobNumber: job.jobNumber,
      jobName: job.name,
      date: new Date(new Date(job.dueDate).getTime() - 25 * 86400000).toISOString(),
      size: "245 KB",
    });

    // Shipping doc for shipped/delivered
    if (["SHIPPED", "DELIVERED", "INVOICED"].includes(job.status)) {
      docs.push({
        id: `doc-ship-${job.id}`,
        name: `${job.jobNumber}_BOL.pdf`,
        type: "shipping_doc",
        jobNumber: job.jobNumber,
        jobName: job.name,
        date: new Date(new Date(job.dueDate).getTime() - 1 * 86400000).toISOString(),
        size: "180 KB",
      });
    }

    // Spec sheet
    docs.push({
      id: `doc-spec-${job.id}`,
      name: `${job.name.replace(/\s+/g, "_")}_Spec_Sheet.pdf`,
      type: "specification",
      jobNumber: job.jobNumber,
      jobName: job.name,
      date: new Date(new Date(job.dueDate).getTime() - 22 * 86400000).toISOString(),
      size: "520 KB",
    });
  });

  return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const typeLabels: Record<string, { label: string; color: string }> = {
  artwork: { label: "Artwork", color: "bg-purple-100 text-purple-700" },
  proof: { label: "Proof", color: "bg-blue-100 text-blue-700" },
  purchase_order: { label: "Purchase Order", color: "bg-amber-100 text-amber-700" },
  shipping_doc: { label: "Shipping Doc", color: "bg-emerald-100 text-emerald-700" },
  invoice: { label: "Invoice", color: "bg-gray-100 text-gray-700" },
  specification: { label: "Spec Sheet", color: "bg-teal-100 text-teal-700" },
};

const typeIcons: Record<string, React.ElementType> = {
  artwork: Image,
  proof: FileText,
  purchase_order: FileSpreadsheet,
  shipping_doc: File,
  invoice: FileSpreadsheet,
  specification: FileText,
};

export default function PortalDocumentsPage() {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const allDocs = generateDocuments();

  const filteredDocs = allDocs.filter((doc) => {
    const matchesSearch =
      search === "" ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
      doc.jobName.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || doc.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const types = ["all", "artwork", "proof", "purchase_order", "shipping_doc", "specification"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Access artwork files, proofs, purchase orders, and shipping documents
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {types.map((t) => (
                <Button
                  key={t}
                  variant={typeFilter === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(t)}
                >
                  {t === "all" ? "All" : typeLabels[t]?.label || t}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Related Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No documents found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.slice(0, 25).map((doc) => {
                  const Icon = typeIcons[doc.type] || FileText;
                  const typeInfo = typeLabels[doc.type];
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[240px]">
                            {doc.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeInfo?.color || "bg-gray-100 text-gray-600"}>
                          {typeInfo?.label || doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-700">{doc.jobNumber}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{doc.jobName}</p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(doc.date)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {doc.size}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredDocs.length > 25 && (
            <div className="p-4 text-center border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing 25 of {filteredDocs.length} documents
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
