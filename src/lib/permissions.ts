// Role-based permissions for Godzilla
// Controls page visibility and action permissions per role

export type AppRole = "OWNER" | "GM" | "ADMIN" | "PRODUCTION_MANAGER" | "SENIOR_PLANT_MANAGER" | "ACCOUNTING" | "ESTIMATOR" | "PREPRESS_MANAGER" | "CSR" | "SALES_REP" | "SALES_MANAGER" | "SHIPPING" | "OPERATOR" | "CUSTOMER";

// Full access roles — can see and do everything
const FULL_ACCESS: AppRole[] = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ACCOUNTING"];

// Pages each role can access
export const PAGE_ACCESS: Record<string, AppRole[]> = {
  "/dashboard":           [...FULL_ACCESS, "CSR"],
  "/dashboard/quotes":    [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
  "/dashboard/jobs":      [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
  "/dashboard/job-board":  [...FULL_ACCESS, "CSR"],
  "/dashboard/orders":    [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
  "/dashboard/schedule":  [...FULL_ACCESS, "CSR"],
  "/dashboard/inventory": [...FULL_ACCESS, "CSR"],
  "/dashboard/production": [...FULL_ACCESS, "CSR"],
  "/dashboard/shipping":  [...FULL_ACCESS, "CSR", "SHIPPING"],
  "/dashboard/customers": [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
  "/dashboard/vendors":   [...FULL_ACCESS, "CSR"],
  "/dashboard/reports":   [...FULL_ACCESS],
  "/dashboard/plant-floor": [...FULL_ACCESS, "CSR", "OPERATOR"],
  "/dashboard/settings":  [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER", "SHIPPING", "OPERATOR"],
  "/dashboard/admin":     ["OWNER", "GM", "ADMIN"],
};

// Actions each role can perform
export const ACTION_ACCESS: Record<string, AppRole[]> = {
  "quote:create":     [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
  "quote:edit":       [...FULL_ACCESS, "CSR"],
  "quote:send":       [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
  "quote:approve":    [...FULL_ACCESS],
  "quote:convert":    [...FULL_ACCESS, "CSR"],
  "quote:delete":     ["OWNER", "GM", "ADMIN"],
  "job:create":       [...FULL_ACCESS, "CSR"],
  "job:edit":         [...FULL_ACCESS, "CSR"],
  "job:advance":      [...FULL_ACCESS, "CSR", "OPERATOR"],
  "job:delete":       ["OWNER", "GM", "ADMIN"],
  "order:create":     [...FULL_ACCESS, "CSR"],
  "order:edit":       [...FULL_ACCESS, "CSR"],
  "customer:create":  [...FULL_ACCESS, "CSR"],
  "customer:edit":    [...FULL_ACCESS, "CSR"],
  "customer:viewAll": [...FULL_ACCESS, "CSR"],  // Sales reps only see their own
  "inventory:edit":   [...FULL_ACCESS, "CSR"],
  "schedule:edit":    [...FULL_ACCESS],
  "shipping:create":  [...FULL_ACCESS, "CSR", "SHIPPING"],
  "shipping:edit":    [...FULL_ACCESS, "SHIPPING"],
  "settings:plant":   ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER"],
  "admin:users":      ["OWNER", "GM", "ADMIN"],
  "reports:view":     [...FULL_ACCESS],
  "email:send":       [...FULL_ACCESS, "CSR", "SALES_REP", "SALES_MANAGER"],
};

// Check if a role has access to a page
export function canAccessPage(role: AppRole, path: string): boolean {
  // Find the most specific matching path
  const keys = Object.keys(PAGE_ACCESS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (path.startsWith(key)) {
      return PAGE_ACCESS[key].includes(role);
    }
  }
  return false;
}

// Check if a role can perform an action
export function canPerformAction(role: AppRole, action: string): boolean {
  const allowed = ACTION_ACCESS[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

// Get sidebar items for a role
export function getSidebarItems(role: AppRole): { label: string; href: string }[] {
  const allItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Quotes", href: "/dashboard/quotes" },
    { label: "Jobs", href: "/dashboard/jobs" },
    { label: "Job Board", href: "/dashboard/job-board" },
    { label: "Orders", href: "/dashboard/orders" },
    { label: "Schedule", href: "/dashboard/schedule" },
    { label: "Inventory", href: "/dashboard/inventory" },
    { label: "Production", href: "/dashboard/production" },
    { label: "Shipping", href: "/dashboard/shipping" },
    { label: "Customers", href: "/dashboard/customers" },
    { label: "Vendors", href: "/dashboard/vendors" },
    { label: "Reports", href: "/dashboard/reports" },
    { label: "Plant Floor", href: "/dashboard/plant-floor" },
    { label: "Settings", href: "/dashboard/settings" },
    { label: "Admin", href: "/dashboard/admin" },
  ];

  return allItems.filter((item) => canAccessPage(role, item.href));
}

// Check if role is "full access"
export function isFullAccess(role: AppRole): boolean {
  return FULL_ACCESS.includes(role);
}

// Roles that can only see their own customer data
export function isRestrictedToOwnCustomers(role: AppRole): boolean {
  return role === "SALES_REP" || role === "SALES_MANAGER";
}
