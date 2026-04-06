// Demo data for C&D Packaging - runs without a database

const STAGES = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
] as const;

export const demoCompanies = [
  { id: "co-1", name: "Fresh Foods Co.", slug: "fresh-foods", industry: "Food & Beverage" },
  { id: "co-2", name: "Luxe Cosmetics", slug: "luxe-cosmetics", industry: "Beauty & Personal Care" },
  { id: "co-3", name: "GreenLeaf Supplements", slug: "greenleaf", industry: "Health & Wellness" },
  { id: "co-4", name: "TechGear Electronics", slug: "techgear", industry: "Consumer Electronics" },
  { id: "co-5", name: "Artisan Spirits Distillery", slug: "artisan-spirits", industry: "Beverages / Spirits" },
];

export const demoUsers = [
  { id: "u-1", name: "Sarah Johnson", email: "admin@cndpackaging.com", role: "ADMIN" as const, companyId: null },
  { id: "u-2", name: "Mike Torres", email: "mike@cndpackaging.com", role: "PRODUCTION_MANAGER" as const, companyId: null },
  { id: "u-3", name: "Rachel Kim", email: "rachel@cndpackaging.com", role: "CSR" as const, companyId: null },
  { id: "u-4", name: "David Chen", email: "david@cndpackaging.com", role: "SALES_REP" as const, companyId: null },
  { id: "u-5", name: "Tom Richards", email: "tom@freshfoods.com", role: "CUSTOMER" as const, companyId: "co-1" },
  { id: "u-6", name: "Nina Patel", email: "nina@luxecosmetics.com", role: "CUSTOMER" as const, companyId: "co-2" },
];

export const demoWorkCenters = [
  { id: "wc-1", name: "Prepress", code: "PP", type: "prepress", capacity: 15 },
  { id: "wc-2", name: "Press Room", code: "PR", type: "press", capacity: 8 },
  { id: "wc-3", name: "Die Cutting", code: "DC", type: "die-cutting", capacity: 10 },
  { id: "wc-4", name: "Gluing & Folding", code: "GF", type: "gluing", capacity: 12 },
  { id: "wc-5", name: "Quality Assurance", code: "QA", type: "qa", capacity: 20 },
  { id: "wc-6", name: "Shipping Dock", code: "SH", type: "shipping", capacity: 25 },
];

export const demoMaterials = [
  { id: "mat-1", name: "18pt C1S Paperboard", sku: "PB-18-C1S", category: "substrate", unit: "sheets", onHand: 50000, allocated: 32000, reorderPoint: 10000 },
  { id: "mat-2", name: "24pt SBS Folding Board", sku: "FB-24-SBS", category: "substrate", unit: "sheets", onHand: 35000, allocated: 30000, reorderPoint: 8000 },
  { id: "mat-3", name: "E-Flute Corrugated", sku: "CF-E-FLT", category: "substrate", unit: "sheets", onHand: 8000, allocated: 12000, reorderPoint: 5000 },
  { id: "mat-4", name: "Aqueous Coating - Gloss", sku: "CT-AQ-GL", category: "coating", unit: "gallons", onHand: 120, allocated: 80, reorderPoint: 30 },
  { id: "mat-5", name: "UV Spot Varnish", sku: "CT-UV-SP", category: "coating", unit: "gallons", onHand: 15, allocated: 20, reorderPoint: 10 },
  { id: "mat-6", name: "CMYK Process Inks", sku: "INK-CMYK", category: "ink", unit: "lbs", onHand: 200, allocated: 150, reorderPoint: 50 },
  { id: "mat-7", name: "PMS 186 Red Ink", sku: "INK-PMS186", category: "ink", unit: "lbs", onHand: 12, allocated: 8, reorderPoint: 5 },
  { id: "mat-8", name: "Hot Melt Adhesive", sku: "ADH-HM-01", category: "adhesive", unit: "lbs", onHand: 300, allocated: 200, reorderPoint: 100 },
];

interface DemoJob {
  id: string;
  jobNumber: string;
  orderId: string;
  orderNumber: string;
  name: string;
  description: string;
  companyId: string;
  companyName: string;
  status: typeof STAGES[number];
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  quantity: number;
  dueDate: string;
  csrName: string;
  salesRepName: string;
  productionOwnerName: string;
  isLate: boolean;
  isBlocked: boolean;
  blockerReason?: string;
  proofStatus?: string;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export const demoJobs: DemoJob[] = [
  // Fresh Foods Co. jobs
  { id: "j-1", jobNumber: "PKG-2026-001", orderId: "ord-1", orderNumber: "ORD-10001", name: "Organic Cereal Box - 12oz", description: "Full color printed folding carton with matte finish", companyId: "co-1", companyName: "Fresh Foods Co.", status: "PRINTING", priority: "HIGH", quantity: 25000, dueDate: addDays(3), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-2", jobNumber: "PKG-2026-002", orderId: "ord-1", orderNumber: "ORD-10001", name: "Granola Bar Sleeve - 6pk", description: "Sleeve wrap with window cutout", companyId: "co-1", companyName: "Fresh Foods Co.", status: "DIE_CUTTING", priority: "HIGH", quantity: 15000, dueDate: addDays(5), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-3", jobNumber: "PKG-2026-003", orderId: "ord-2", orderNumber: "ORD-10002", name: "Frozen Pizza Box - Family", description: "E-flute corrugated with full bleed print", companyId: "co-1", companyName: "Fresh Foods Co.", status: "MATERIALS_ORDERED", priority: "URGENT", quantity: 50000, dueDate: addDays(2), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: true, isBlocked: true, blockerReason: "E-Flute corrugated stock shortage" },
  { id: "j-4", jobNumber: "PKG-2026-004", orderId: "ord-3", orderNumber: "ORD-10003", name: "Juice Box Carrier - 4pk", description: "Handle-top carrier with die-cut windows", companyId: "co-1", companyName: "Fresh Foods Co.", status: "CUSTOMER_APPROVAL", priority: "NORMAL", quantity: 20000, dueDate: addDays(12), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false, proofStatus: "SENT" },

  // Luxe Cosmetics jobs
  { id: "j-5", jobNumber: "PKG-2026-005", orderId: "ord-4", orderNumber: "ORD-10004", name: "Foundation Box - Premium", description: "Rigid box with magnetic closure, foil stamping", companyId: "co-2", companyName: "Luxe Cosmetics", status: "QA", priority: "HIGH", quantity: 10000, dueDate: addDays(1), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-6", jobNumber: "PKG-2026-006", orderId: "ord-4", orderNumber: "ORD-10004", name: "Lipstick Tray Insert", description: "Custom vacuum-formed insert tray", companyId: "co-2", companyName: "Luxe Cosmetics", status: "GLUING_FOLDING", priority: "HIGH", quantity: 10000, dueDate: addDays(1), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: true, isBlocked: false },
  { id: "j-7", jobNumber: "PKG-2026-007", orderId: "ord-5", orderNumber: "ORD-10005", name: "Perfume Gift Set Box", description: "Two-piece box with embossed lid, UV spot varnish", companyId: "co-2", companyName: "Luxe Cosmetics", status: "PROOFING", priority: "NORMAL", quantity: 5000, dueDate: addDays(15), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: true, blockerReason: "UV Spot Varnish low stock", proofStatus: "REVISION_REQUESTED" },
  { id: "j-8", jobNumber: "PKG-2026-008", orderId: "ord-6", orderNumber: "ORD-10006", name: "Skincare Sample Box", description: "Small folding carton for trial sizes", companyId: "co-2", companyName: "Luxe Cosmetics", status: "SHIPPED", priority: "NORMAL", quantity: 30000, dueDate: addDays(-2), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },

  // GreenLeaf jobs
  { id: "j-9", jobNumber: "PKG-2026-009", orderId: "ord-7", orderNumber: "ORD-10007", name: "Vitamin Bottle Box - 60ct", description: "SBS folding carton with tamper-evident seal", companyId: "co-3", companyName: "GreenLeaf Supplements", status: "PREPRESS", priority: "NORMAL", quantity: 40000, dueDate: addDays(8), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-10", jobNumber: "PKG-2026-010", orderId: "ord-7", orderNumber: "ORD-10007", name: "Protein Powder Canister Wrap", description: "Shrink sleeve label for round canister", companyId: "co-3", companyName: "GreenLeaf Supplements", status: "QUOTE", priority: "LOW", quantity: 100000, dueDate: addDays(30), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-11", jobNumber: "PKG-2026-011", orderId: "ord-8", orderNumber: "ORD-10008", name: "Supplement Variety Pack Shipper", description: "Corrugated shipper with internal dividers", companyId: "co-3", companyName: "GreenLeaf Supplements", status: "SCHEDULED", priority: "HIGH", quantity: 8000, dueDate: addDays(4), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },

  // TechGear jobs
  { id: "j-12", jobNumber: "PKG-2026-012", orderId: "ord-9", orderNumber: "ORD-10009", name: "Wireless Earbuds Box", description: "Premium retail box with magnetic closure and EVA insert", companyId: "co-4", companyName: "TechGear Electronics", status: "COATING_FINISHING", priority: "URGENT", quantity: 20000, dueDate: addDays(2), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-13", jobNumber: "PKG-2026-013", orderId: "ord-9", orderNumber: "ORD-10009", name: "Phone Case Blister Pack", description: "Printed card with clear blister", companyId: "co-4", companyName: "TechGear Electronics", status: "ARTWORK_RECEIVED", priority: "NORMAL", quantity: 50000, dueDate: addDays(18), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-14", jobNumber: "PKG-2026-014", orderId: "ord-10", orderNumber: "ORD-10010", name: "Smartwatch Gift Box", description: "Two-piece rigid box with ribbon pull", companyId: "co-4", companyName: "TechGear Electronics", status: "PACKED", priority: "HIGH", quantity: 15000, dueDate: addDays(0), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: true, isBlocked: false },

  // Artisan Spirits jobs
  { id: "j-15", jobNumber: "PKG-2026-015", orderId: "ord-11", orderNumber: "ORD-10011", name: "Bourbon Gift Tube", description: "Printed kraft tube with metal cap", companyId: "co-5", companyName: "Artisan Spirits Distillery", status: "DELIVERED", priority: "NORMAL", quantity: 12000, dueDate: addDays(-5), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-16", jobNumber: "PKG-2026-016", orderId: "ord-12", orderNumber: "ORD-10012", name: "Whiskey 3-Bottle Gift Box", description: "Corrugated display box with die-cut bottle cradles", companyId: "co-5", companyName: "Artisan Spirits Distillery", status: "STRUCTURAL_DESIGN", priority: "NORMAL", quantity: 5000, dueDate: addDays(20), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-17", jobNumber: "PKG-2026-017", orderId: "ord-12", orderNumber: "ORD-10012", name: "Tasting Set Presentation Box", description: "Hinged lid box with velvet flocking", companyId: "co-5", companyName: "Artisan Spirits Distillery", status: "PLATING", priority: "HIGH", quantity: 3000, dueDate: addDays(6), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },

  // More jobs for volume
  { id: "j-18", jobNumber: "PKG-2026-018", orderId: "ord-13", orderNumber: "ORD-10013", name: "Energy Drink 12-Pack Carrier", description: "Die-cut carrier with handle", companyId: "co-1", companyName: "Fresh Foods Co.", status: "INVOICED", priority: "NORMAL", quantity: 40000, dueDate: addDays(-10), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-19", jobNumber: "PKG-2026-019", orderId: "ord-14", orderNumber: "ORD-10014", name: "Eye Shadow Palette Box", description: "Folding carton with mirror lamination", companyId: "co-2", companyName: "Luxe Cosmetics", status: "MATERIALS_RECEIVED", priority: "NORMAL", quantity: 20000, dueDate: addDays(7), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-20", jobNumber: "PKG-2026-020", orderId: "ord-15", orderNumber: "ORD-10015", name: "CBD Tincture Box", description: "Child-resistant folding carton", companyId: "co-3", companyName: "GreenLeaf Supplements", status: "QA", priority: "URGENT", quantity: 25000, dueDate: addDays(1), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: true, blockerReason: "QA hold - color variance issue" },

  // Additional jobs
  { id: "j-21", jobNumber: "PKG-2026-021", orderId: "ord-16", orderNumber: "ORD-10016", name: "Snack Bar Display Box", description: "Countertop display shipper", companyId: "co-1", companyName: "Fresh Foods Co.", status: "PRINTING", priority: "NORMAL", quantity: 3000, dueDate: addDays(5), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-22", jobNumber: "PKG-2026-022", orderId: "ord-17", orderNumber: "ORD-10017", name: "Mascara Box Sleeve", description: "Printed sleeve with holographic foil", companyId: "co-2", companyName: "Luxe Cosmetics", status: "CUSTOMER_APPROVAL", priority: "HIGH", quantity: 50000, dueDate: addDays(9), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false, proofStatus: "PENDING" },
  { id: "j-23", jobNumber: "PKG-2026-023", orderId: "ord-18", orderNumber: "ORD-10018", name: "Headphone Retail Box", description: "Printed litho-laminated box", companyId: "co-4", companyName: "TechGear Electronics", status: "QUOTE", priority: "LOW", quantity: 10000, dueDate: addDays(25), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-24", jobNumber: "PKG-2026-024", orderId: "ord-19", orderNumber: "ORD-10019", name: "Gin Bottle Gift Bag", description: "Printed paper bag with rope handles", companyId: "co-5", companyName: "Artisan Spirits Distillery", status: "SHIPPED", priority: "NORMAL", quantity: 8000, dueDate: addDays(-1), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
  { id: "j-25", jobNumber: "PKG-2026-025", orderId: "ord-20", orderNumber: "ORD-10020", name: "Protein Bar Wrapper", description: "Flexo-printed flow wrap film", companyId: "co-3", companyName: "GreenLeaf Supplements", status: "PREPRESS", priority: "HIGH", quantity: 200000, dueDate: addDays(10), csrName: "Rachel Kim", salesRepName: "David Chen", productionOwnerName: "Mike Torres", isLate: false, isBlocked: false },
];

export function getKPIs() {
  const jobs = demoJobs;
  const openStatuses = STAGES.slice(0, STAGES.indexOf("SHIPPED"));
  const productionStatuses = STAGES.slice(STAGES.indexOf("PRINTING"), STAGES.indexOf("PACKED") + 1);
  const today = new Date();
  const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 7);

  return {
    openJobs: jobs.filter(j => openStatuses.includes(j.status)).length,
    inProduction: jobs.filter(j => productionStatuses.includes(j.status)).length,
    dueThisWeek: jobs.filter(j => { const d = new Date(j.dueDate); return d >= today && d <= weekFromNow; }).length,
    lateJobs: jobs.filter(j => j.isLate).length,
    blockedJobs: jobs.filter(j => j.isBlocked).length,
    proofsPending: jobs.filter(j => j.proofStatus === "SENT" || j.proofStatus === "PENDING").length,
    materialShortages: demoMaterials.filter(m => m.onHand < m.allocated).length,
    readyToShip: jobs.filter(j => j.status === "PACKED").length,
    onTimeShipmentPct: 87.5,
    avgCycleTimeDays: 14.2,
  };
}

export function getJobsByStatus() {
  const counts: Record<string, number> = {};
  for (const j of demoJobs) {
    counts[j.status] = (counts[j.status] || 0) + 1;
  }
  return counts;
}

export const demoAlerts = [
  { id: "a-1", type: "JOB_PAST_DUE", severity: "CRITICAL", message: "PKG-2026-003 Frozen Pizza Box is past due - material shortage", jobId: "j-3", createdAt: addDays(0) },
  { id: "a-2", type: "MATERIAL_SHORTAGE", severity: "CRITICAL", message: "E-Flute Corrugated stock below reorder point (8,000 allocated vs 8,000 on hand)", jobId: "j-3", createdAt: addDays(0) },
  { id: "a-3", type: "QA_HOLD", severity: "WARNING", message: "PKG-2026-020 CBD Tincture Box on QA hold - color variance detected", jobId: "j-20", createdAt: addDays(0) },
  { id: "a-4", type: "STAGE_BLOCKED", severity: "WARNING", message: "PKG-2026-007 Perfume Gift Set blocked - UV Spot Varnish low stock", jobId: "j-7", createdAt: addDays(-1) },
  { id: "a-5", type: "PROOF_OVERDUE", severity: "INFO", message: "PKG-2026-022 Mascara Box Sleeve - proof approval pending 3 days", jobId: "j-22", createdAt: addDays(-3) },
  { id: "a-6", type: "JOB_PAST_DUE", severity: "WARNING", message: "PKG-2026-014 Smartwatch Gift Box due today - in Packed stage", jobId: "j-14", createdAt: addDays(0) },
  { id: "a-7", type: "SHIPMENT_DELAYED", severity: "INFO", message: "PKG-2026-006 Lipstick Tray Insert behind schedule in Gluing/Folding", jobId: "j-6", createdAt: addDays(-1) },
];
