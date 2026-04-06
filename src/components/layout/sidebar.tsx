"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, ClipboardList, Calendar, Warehouse,
  FileCheck, Factory, ShieldCheck, Truck, Users, FileBarChart,
  Settings, ChevronDown, ChevronRight, Box, Shield, Calculator, Timer,
  LayoutGrid,
} from "lucide-react";

const internalNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Quotes", href: "/dashboard/quotes", icon: Calculator },
  { label: "Jobs", href: "/dashboard/jobs", icon: Package },
  { label: "Job Board", href: "/dashboard/job-board", icon: LayoutGrid },
  { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
  { label: "Schedule", href: "/dashboard/schedule", icon: Calendar },
  { label: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
  { label: "Proofing", href: "/dashboard/proofing", icon: FileCheck },
  { label: "Production", href: "/dashboard/production", icon: Factory },
  // { label: "QA", href: "/dashboard/qa", icon: ShieldCheck }, // Archived — no QA process currently
  { label: "Shipping", href: "/dashboard/shipping", icon: Truck },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { label: "Plant Floor", href: "/dashboard/plant-floor", icon: Timer },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Admin", href: "/dashboard/admin", icon: Shield },
];

const customerNav = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "Orders", href: "/portal/orders", icon: ClipboardList },
  { label: "Proofs", href: "/portal/proofs", icon: FileCheck },
  { label: "Shipments", href: "/portal/shipments", icon: Truck },
  { label: "Documents", href: "/portal/documents", icon: FileBarChart },
  { label: "Account", href: "/portal/account", icon: Settings },
];

interface SidebarProps {
  isCustomer?: boolean;
}

export function Sidebar({ isCustomer = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const nav = isCustomer ? customerNav : internalNav;

  return (
    <aside className={cn("flex flex-col bg-white border-r border-gray-200 transition-all duration-200 h-full", collapsed ? "w-16" : "w-60")}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand-600 text-white font-bold text-sm shrink-0">
          <Box className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">C&D Packaging</p>
            <p className="text-xs text-gray-500 truncate">{isCustomer ? "Customer Portal" : "Production Tracking"}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {nav.map((item) => {
          const active = item.href === "/dashboard" || item.href === "/portal"
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-brand-600" : "text-gray-400")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 rotate-90" />}
      </button>
    </aside>
  );
}
