"use client";

import { useMemo } from "react";
import { AlertTriangle, Package, ArrowDown } from "lucide-react";
import { demoMaterials } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";

function getStockStatus(mat: (typeof demoMaterials)[0]) {
  if (mat.onHand < mat.allocated) return "shortage";
  if (mat.onHand < mat.reorderPoint) return "low";
  return "in-stock";
}

export default function InventoryPage() {
  const summary = useMemo(() => {
    const shortages = demoMaterials.filter(
      (m) => getStockStatus(m) === "shortage"
    ).length;
    const low = demoMaterials.filter(
      (m) => getStockStatus(m) === "low"
    ).length;
    return { total: demoMaterials.length, shortages, low };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Inventory &amp; Materials
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Track material stock levels and allocations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Materials</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2.5">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Shortages</p>
                <p className="text-2xl font-bold text-red-600">
                  {summary.shortages}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5">
                <ArrowDown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Low Stock</p>
                <p className="text-2xl font-bold text-amber-600">
                  {summary.low}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Materials Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reorder Point</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demoMaterials.map((mat) => {
              const status = getStockStatus(mat);
              const available = mat.onHand - mat.allocated;
              return (
                <TableRow
                  key={mat.id}
                  className={
                    status === "shortage"
                      ? "bg-red-50/50"
                      : status === "low"
                      ? "bg-amber-50/50"
                      : ""
                  }
                >
                  <TableCell className="font-medium">{mat.name}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    {mat.sku}
                  </TableCell>
                  <TableCell className="capitalize">{mat.category}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(mat.onHand)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(mat.allocated)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      available < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatNumber(available)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(mat.reorderPoint)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        status === "shortage"
                          ? "bg-red-100 text-red-700"
                          : status === "low"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }
                    >
                      {status === "shortage"
                        ? "Shortage"
                        : status === "low"
                        ? "Low"
                        : "In Stock"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
