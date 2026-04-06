"use client";

import React from "react";
import Link from "next/link";
import { demoJobs } from "@/lib/demo-data";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck, Package, MapPin, Clock, CheckCircle, Circle, Eye,
} from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

interface Shipment {
  id: string;
  jobId: string;
  jobName: string;
  jobNumber: string;
  carrier: string;
  trackingNumber: string;
  status: "in_transit" | "out_for_delivery" | "delivered";
  shipDate: string;
  estimatedDelivery: string;
  deliveredDate?: string;
  lastLocation: string;
  quantity: number;
}

function generateShipments(): Shipment[] {
  const myJobs = demoJobs.filter(
    (j) => j.companyId === CUSTOMER_COMPANY_ID && ["SHIPPED", "DELIVERED", "INVOICED", "PACKED"].includes(j.status)
  );

  return myJobs
    .filter((j) => ["SHIPPED", "DELIVERED", "INVOICED"].includes(j.status))
    .map((job, idx) => {
      const isDelivered = job.status === "DELIVERED" || job.status === "INVOICED";
      const shipDate = new Date(new Date(job.dueDate).getTime() - 2 * 86400000).toISOString();
      const estDelivery = new Date(new Date(job.dueDate).getTime() + 1 * 86400000).toISOString();

      return {
        id: `ship-${job.id}`,
        jobId: job.id,
        jobName: job.name,
        jobNumber: job.jobNumber,
        carrier: idx % 2 === 0 ? "FedEx Freight" : "UPS Ground",
        trackingNumber: `${748920345612 + idx * 1111}`,
        status: isDelivered ? "delivered" as const : "in_transit" as const,
        shipDate,
        estimatedDelivery: estDelivery,
        deliveredDate: isDelivered ? job.dueDate : undefined,
        lastLocation: isDelivered
          ? "Delivered - Your Facility"
          : "Memphis, TN Distribution Center",
        quantity: job.quantity,
      };
    });
}

const timelineSteps = [
  { key: "picked_up", label: "Picked Up" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function getTimelineIndex(status: string): number {
  const map: Record<string, number> = {
    in_transit: 1,
    out_for_delivery: 2,
    delivered: 3,
  };
  return map[status] ?? 0;
}

export default function PortalShipmentsPage() {
  const shipments = generateShipments();

  const inTransit = shipments.filter((s) => s.status !== "delivered");
  const delivered = shipments.filter((s) => s.status === "delivered");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track deliveries for your packaging orders
        </p>
      </div>

      {/* In Transit */}
      {inTransit.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            In Transit ({inTransit.length})
          </h2>
          {inTransit.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}

      {inTransit.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">No shipments in transit</p>
            <p className="text-xs text-gray-500 mt-1">
              Active shipments will appear here once orders are dispatched.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delivered */}
      {delivered.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Delivered ({delivered.length})
          </h2>
          {delivered.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const stepIndex = getTimelineIndex(shipment.status);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{shipment.jobName}</p>
              <Badge
                variant={shipment.status === "delivered" ? "success" : "default"}
              >
                {shipment.status === "delivered" ? "Delivered" : "In Transit"}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{shipment.jobNumber}</p>
          </div>
          <Link href={`/portal/orders/${shipment.jobId}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-3.5 w-3.5 mr-1" />
              View Order
            </Button>
          </Link>
        </div>

        {/* Shipment Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-500">Carrier</p>
            <p className="text-sm font-medium text-gray-900">{shipment.carrier}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tracking #</p>
            <p className="text-sm font-medium text-brand-600">{shipment.trackingNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Ship Date</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(shipment.shipDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {shipment.status === "delivered" ? "Delivered" : "Est. Delivery"}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {shipment.deliveredDate
                ? formatDate(shipment.deliveredDate)
                : formatDate(shipment.estimatedDelivery)}
            </p>
          </div>
        </div>

        {/* Delivery Timeline */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            {timelineSteps.map((step, idx) => {
              const isComplete = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div className="relative flex items-center w-full justify-center">
                    {idx > 0 && (
                      <div
                        className={cn(
                          "absolute right-1/2 h-0.5 w-full",
                          idx <= stepIndex ? "bg-brand-600" : "bg-gray-200"
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "relative z-10 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                        isComplete
                          ? "bg-brand-600 border-brand-600"
                          : "bg-white border-gray-300"
                      )}
                    >
                      {isComplete && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] mt-1.5 text-center",
                      isCurrent
                        ? "font-semibold text-brand-700"
                        : isComplete
                        ? "text-gray-600"
                        : "text-gray-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Last Location */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <MapPin className="h-4 w-4 text-gray-400" />
          <p className="text-sm text-gray-600">{shipment.lastLocation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
