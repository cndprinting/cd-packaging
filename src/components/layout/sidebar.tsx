"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, ClipboardList, Calendar, Warehouse,
  FileCheck, Factory, ShieldCheck, Truck, Users, FileBarChart,
  Settings, ChevronDown, ChevronRight, Box, Shield, Calculator, Timer,
  LayoutGrid, HelpCircle,
} from "lucide-react";

const internalNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Quote Requests", href: "/dashboard/quote-requests", icon: FileCheck },
  { label: "Quotes", href: "/dashboard/quotes", icon: Calculator },
  { label: "Jobs", href: "/dashboard/jobs", icon: Package },
  { label: "Job Board", href: "/dashboard/job-board", icon: LayoutGrid },
  { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
  { label: "Invoices", href: "/dashboard/invoices", icon: FileBarChart },
  { label: "Schedule", href: "/dashboard/schedule", icon: Calendar },
  { label: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
  // { label: "Proofing", href: "/dashboard/proofing", icon: FileCheck }, // Archived — team doesn't need it (Apr 2026)
  { label: "Pre-Press", href: "/dashboard/prepress", icon: FileCheck },
  { label: "Production", href: "/dashboard/production", icon: Factory },
  // { label: "QA", href: "/dashboard/qa", icon: ShieldCheck }, // Archived — no QA process currently
  { label: "Shipping", href: "/dashboard/shipping", icon: Truck },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Vendors", href: "/dashboard/vendors", icon: Warehouse },
  { label: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { label: "Plant Floor", href: "/dashboard/plant-floor", icon: Timer },
  { label: "Help Desk", href: "/dashboard/help-desk", icon: HelpCircle },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Admin", href: "/dashboard/admin", icon: Shield },
];

const customerNav = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "Quotes", href: "/portal/quotes", icon: Calculator },
  { label: "Orders", href: "/portal/orders", icon: ClipboardList },
  { label: "Proofs", href: "/portal/proofs", icon: FileCheck },
  { label: "Payments", href: "/portal/payments", icon: ClipboardList },
  { label: "Shipments", href: "/portal/shipments", icon: Truck },
  { label: "Documents", href: "/portal/documents", icon: FileBarChart },
  { label: "Account", href: "/portal/account", icon: Settings },
];

interface SidebarProps {
  isCustomer?: boolean;
  userRole?: string;
}

export function Sidebar({ isCustomer = false, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  // Filter nav items by role
  const filteredNav = React.useMemo(() => {
    if (isCustomer) return customerNav;
    if (!userRole) return internalNav;

    const role = userRole as import("@/lib/permissions").AppRole;

    // Full access roles see everything — check first
    const fullAccessRoles = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ACCOUNTING"];
    if (fullAccessRoles.includes(role)) return internalNav;

    // Estimator sees everything except dashboard and invoices
    if (role === "ESTIMATOR") {
      return internalNav.filter(item => item.href !== "/dashboard" && item.href !== "/dashboard/invoices");
    }

    // Operator only sees Plant Floor
    if (role === "OPERATOR") return internalNav.filter(item => item.href === "/dashboard/plant-floor");

    // Shipping only sees Shipping + Settings
    if (role === "SHIPPING") return internalNav.filter(item => item.href === "/dashboard/shipping" || item.href === "/dashboard/settings");

    // CSRs and Sales Reps — limited view, no estimating data
    if (role === "CSR" || role === "SALES_REP" || role === "SALES_MANAGER") {
      return [
        { label: "Quote Requests", href: "/dashboard/quote-requests", icon: FileCheck },
        { label: "My Quotes", href: "/dashboard/my-quotes", icon: Calculator },
        { label: "Jobs", href: "/dashboard/jobs", icon: Package },
        { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
        { label: "Customers", href: "/dashboard/customers", icon: Users },
        { label: "Shipping", href: "/dashboard/shipping", icon: Truck },
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
      ];
    }

    // Default: show everything (safety fallback)
    return internalNav;
  }, [isCustomer, userRole]);

  const nav = filteredNav;

  return (
    <aside className={cn("flex flex-col bg-white border-r border-gray-200 transition-all duration-200 h-full", collapsed ? "w-16" : "w-60")}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 shrink-0">
        <img src="/logo-icon.svg" alt="C&D" className="h-9 w-9 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">C&D Packaging</p>
            <p className="text-xs text-gray-500 truncate">{isCustomer ? "Customer Portal" : "Godzilla"}</p>
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
