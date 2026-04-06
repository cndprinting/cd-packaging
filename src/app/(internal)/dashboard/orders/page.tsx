"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, FileText, ExternalLink } from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusColor, getStatusLabel, getPriorityColor, formatDate } from "@/lib/utils";

interface Order {
  orderId: string;
  orderNumber: string;
  companyName: string;
  jobs: typeof demoJobs;
  status: string;
  priority: string;
  dueDate: string;
}

function getOrders(): Order[] {
  const map = new Map<string, Order>();
  for (const job of demoJobs) {
    if (!map.has(job.orderId)) {
      map.set(job.orderId, {
        orderId: job.orderId,
        orderNumber: job.orderNumber,
        companyName: job.companyName,
        jobs: [],
        status: job.status,
        priority: job.priority,
        dueDate: job.dueDate,
      });
    }
    const order = map.get(job.orderId)!;
    order.jobs.push(job);
    // Use earliest due date
    if (new Date(job.dueDate) < new Date(order.dueDate)) {
      order.dueDate = job.dueDate;
    }
    // Escalate priority
    const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    if (priorities.indexOf(job.priority) > priorities.indexOf(order.priority)) {
      order.priority = job.priority;
    }
  }
  return Array.from(map.values());
}

const STATUSES = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

export default function OrdersPage() {
  const orders = useMemo(() => getOrders(), []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const matchSearch =
        !search ||
        order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        order.companyName.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        !statusFilter || order.jobs.some((j) => j.status === statusFilter);
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} orders
          </p>
        </div>
        <Button>+ New Order</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order number or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                ...STATUSES.map((s) => ({ value: s, label: getStatusLabel(s) })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow key={order.orderId}>
                <TableCell>
                  <span className="font-mono font-medium text-gray-900">
                    {order.orderNumber}
                  </span>
                </TableCell>
                <TableCell>{order.companyName}</TableCell>
                <TableCell>
                  <span className="text-gray-700">
                    {order.jobs.length} job{order.jobs.length !== 1 ? "s" : ""}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(order.jobs.map((j) => j.status))).map(
                      (status) => (
                        <Badge key={status} className={getStatusColor(status)}>
                          {getStatusLabel(status)}
                        </Badge>
                      )
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getPriorityColor(order.priority)}>
                    {order.priority}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(order.dueDate)}</TableCell>
                <TableCell>
                  <Link href={`/dashboard/orders/${order.orderId}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No orders match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
