"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import { demoCompanies, demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export default function CustomersPage() {
  const customerData = useMemo(() => {
    return demoCompanies.map((company) => {
      const companyJobs = demoJobs.filter((j) => j.companyId === company.id);
      const activeJobs = companyJobs.filter(
        (j) =>
          j.status !== "DELIVERED" &&
          j.status !== "INVOICED"
      ).length;
      const uniqueOrders = new Set(companyJobs.map((j) => j.orderId)).size;
      return {
        ...company,
        activeJobs,
        totalOrders: uniqueOrders,
        totalJobs: companyJobs.length,
      };
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {demoCompanies.length} companies
          </p>
        </div>
        <Button>+ Add Customer</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead className="text-right">Active Jobs</TableHead>
              <TableHead className="text-right">Total Orders</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customerData.map((company) => (
              <TableRow key={company.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <Building2 className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {company.name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-gray-100 text-gray-600">
                    {company.industry}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-medium ${
                      company.activeJobs > 0
                        ? "text-green-700"
                        : "text-gray-400"
                    }`}
                  >
                    {company.activeJobs}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {company.totalOrders}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
