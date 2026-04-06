"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Truck, Package, MapPin } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getStatusColor, getStatusLabel, formatDate } from "@/lib/utils";

const MOCK_SHIPMENTS: Record<
  string,
  { carrier: string; tracking: string; shipDate: string; destination: string }
> = {
  "j-8": {
    carrier: "FedEx",
    tracking: "FX-789456123",
    shipDate: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
    destination: "Los Angeles, CA",
  },
  "j-14": {
    carrier: "UPS",
    tracking: "1Z999AA10123456784",
    shipDate: new Date().toISOString().split("T")[0],
    destination: "San Jose, CA",
  },
  "j-24": {
    carrier: "FedEx",
    tracking: "FX-321654987",
    shipDate: new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0],
    destination: "Portland, OR",
  },
};

export default function ShippingPage() {
  const shippingJobs = useMemo(
    () =>
      demoJobs.filter(
        (j) => j.status === "PACKED" || j.status === "SHIPPED"
      ),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipping</h1>
          <p className="text-sm text-gray-500 mt-1">
            {shippingJobs.length} shipment{shippingJobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button>
          <Truck className="h-4 w-4 mr-2" />
          Create Shipment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-lime-50 p-2.5">
                <Package className="h-5 w-5 text-lime-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ready to Ship</p>
                <p className="text-2xl font-bold text-gray-900">
                  {shippingJobs.filter((j) => j.status === "PACKED").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">In Transit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {shippingJobs.filter((j) => j.status === "SHIPPED").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2.5">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Delivered (Recent)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {demoJobs.filter((j) => j.status === "DELIVERED").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipments Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Ship Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destination</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shippingJobs.map((job) => {
              const shipment = MOCK_SHIPMENTS[job.id];
              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/jobs/${job.id}`}
                      className="font-mono text-green-700 hover:underline"
                    >
                      {job.jobNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{job.companyName}</TableCell>
                  <TableCell>{shipment?.carrier || "TBD"}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {shipment?.tracking || "--"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {shipment ? formatDate(shipment.shipDate) : "--"}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(job.status)}>
                      {getStatusLabel(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {shipment?.destination || "Not assigned"}
                  </TableCell>
                </TableRow>
              );
            })}
            {shippingJobs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-gray-500"
                >
                  No shipments at this time.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
