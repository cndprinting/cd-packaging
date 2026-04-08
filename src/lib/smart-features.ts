// Smart features — zero-cost, logic-based intelligence for Godzilla

interface PressInfo {
  id: string;
  name: string;
  costPerHour: number;
  maxSheetWidth: number;
  maxSheetHeight: number;
  configurations: {
    id: string;
    name: string;
    numColors: number;
    speedUncoated: number;
    speedCoated: number;
    addToHourlyRate: number;
    coatingType: string | null;
  }[];
}

interface JobSpecs {
  sheetWidth: number;
  sheetHeight: number;
  colorsNeeded: number;
  quantity: number;
  needsAqueous: boolean;
  stockType: "coated" | "uncoated";
}

export interface PressRecommendation {
  pressId: string;
  configId: string;
  pressName: string;
  configName: string;
  effectiveRate: number;
  estimatedHours: number;
  estimatedCost: number;
  reason: string;
  score: number; // higher = better fit
}

// Recommend the best press for a job based on specs
export function recommendPress(presses: PressInfo[], specs: JobSpecs): PressRecommendation[] {
  const recommendations: PressRecommendation[] = [];

  for (const press of presses) {
    // Check if sheet fits on this press
    if (specs.sheetWidth > press.maxSheetWidth || specs.sheetHeight > press.maxSheetHeight) continue;

    for (const config of press.configurations) {
      // Check if enough colors
      if (specs.colorsNeeded > config.numColors) continue;

      // Check if aqueous is needed but not available
      if (specs.needsAqueous && config.coatingType !== "Aqueous") continue;

      const effectiveRate = press.costPerHour + config.addToHourlyRate;
      const speed = specs.stockType === "coated" ? config.speedCoated : config.speedUncoated;
      const estimatedHours = speed > 0 ? specs.quantity / speed : 0;
      const estimatedCost = estimatedHours * effectiveRate;

      // Score: lower cost = higher score, bonus for tighter fit
      const sizeEfficiency = (specs.sheetWidth * specs.sheetHeight) / (press.maxSheetWidth * press.maxSheetHeight);
      const colorEfficiency = specs.colorsNeeded / config.numColors;
      const costScore = 1000 / (estimatedCost + 1);
      const fitScore = sizeEfficiency * 50 + colorEfficiency * 30;
      const speedScore = speed / 1000;
      const score = costScore + fitScore + speedScore;

      const reasons: string[] = [];
      if (sizeEfficiency > 0.7) reasons.push("good sheet utilization");
      if (colorEfficiency === 1) reasons.push("exact color match");
      if (effectiveRate < 100) reasons.push("low hourly rate");
      if (speed >= 10000) reasons.push("high speed");
      if (config.coatingType === "Aqueous" && specs.needsAqueous) reasons.push("has aqueous");

      recommendations.push({
        pressId: press.id,
        configId: config.id,
        pressName: press.name,
        configName: config.name,
        effectiveRate,
        estimatedHours: Math.round(estimatedHours * 100) / 100,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        reason: reasons.join(", ") || "compatible",
        score,
      });
    }
  }

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 3);
}

// Customer reorder analysis
export interface ReorderAlert {
  customerId: string;
  customerName: string;
  avgDaysBetweenOrders: number;
  daysSinceLastOrder: number;
  isOverdue: boolean;
  daysOverdue: number;
  lastOrderDate: string;
  totalOrders: number;
}

export function analyzeReorders(
  customers: { id: string; name: string }[],
  orders: { companyId: string; createdAt: string }[]
): ReorderAlert[] {
  const alerts: ReorderAlert[] = [];

  for (const customer of customers) {
    const customerOrders = orders
      .filter((o) => o.companyId === customer.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (customerOrders.length < 2) continue;

    // Calculate average days between orders
    const intervals: number[] = [];
    for (let i = 1; i < customerOrders.length; i++) {
      const days = Math.floor(
        (new Date(customerOrders[i].createdAt).getTime() - new Date(customerOrders[i - 1].createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    const avgDays = Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length);
    const lastOrder = customerOrders[customerOrders.length - 1];
    const daysSinceLast = Math.floor(
      (Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const isOverdue = daysSinceLast > avgDays * 1.2; // 20% buffer
    const daysOverdue = isOverdue ? daysSinceLast - avgDays : 0;

    if (isOverdue || daysSinceLast > avgDays * 0.8) {
      alerts.push({
        customerId: customer.id,
        customerName: customer.name,
        avgDaysBetweenOrders: avgDays,
        daysSinceLastOrder: daysSinceLast,
        isOverdue,
        daysOverdue,
        lastOrderDate: lastOrder.createdAt,
        totalOrders: customerOrders.length,
      });
    }
  }

  return alerts.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// Price comparison for estimates
export interface PriceComparison {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  percentDiff: number;
  status: "normal" | "high" | "low";
  sampleSize: number;
}

export function comparePricing(
  currentTotal: number,
  currentQty: number,
  pastQuotes: { totalPrice: number; quantity: number }[]
): PriceComparison | null {
  if (pastQuotes.length < 2) return null;

  // Normalize to per-unit pricing
  const perUnits = pastQuotes.map((q) => q.totalPrice / q.quantity);
  const currentPerUnit = currentTotal / currentQty;

  const avg = perUnits.reduce((s, p) => s + p, 0) / perUnits.length;
  const min = Math.min(...perUnits);
  const max = Math.max(...perUnits);
  const percentDiff = ((currentPerUnit - avg) / avg) * 100;

  let status: "normal" | "high" | "low" = "normal";
  if (percentDiff > 20) status = "high";
  if (percentDiff < -20) status = "low";

  return {
    avgPrice: Math.round(avg * 10000) / 10000,
    minPrice: Math.round(min * 10000) / 10000,
    maxPrice: Math.round(max * 10000) / 10000,
    currentPrice: Math.round(currentPerUnit * 10000) / 10000,
    percentDiff: Math.round(percentDiff * 10) / 10,
    status,
    sampleSize: pastQuotes.length,
  };
}

// Dashboard insights
export interface DashboardInsight {
  type: "warning" | "info" | "success";
  icon: string;
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}

export function generateInsights(data: {
  overdueJobs: number;
  blockedJobs: number;
  lowStockItems: number;
  pendingQuotes: number;
  reorderAlerts: number;
  inactiveCustomers90Days: number;
  jobsCompletedThisWeek: number;
  revenueThisMonth: number;
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  if (data.overdueJobs > 0) {
    insights.push({
      type: "warning",
      icon: "AlertTriangle",
      title: `${data.overdueJobs} overdue job${data.overdueJobs > 1 ? "s" : ""}`,
      description: "Jobs past their due date need immediate attention.",
      action: "View Jobs",
      actionHref: "/dashboard/jobs",
    });
  }

  if (data.blockedJobs > 0) {
    insights.push({
      type: "warning",
      icon: "Pause",
      title: `${data.blockedJobs} blocked job${data.blockedJobs > 1 ? "s" : ""}`,
      description: "Jobs waiting on materials, approvals, or other blockers.",
      action: "View Production",
      actionHref: "/dashboard/production",
    });
  }

  if (data.lowStockItems > 0) {
    insights.push({
      type: "warning",
      icon: "Package",
      title: `${data.lowStockItems} material${data.lowStockItems > 1 ? "s" : ""} low on stock`,
      description: "Materials below reorder point — may impact upcoming jobs.",
      action: "View Inventory",
      actionHref: "/dashboard/inventory",
    });
  }

  if (data.pendingQuotes > 0) {
    insights.push({
      type: "info",
      icon: "DollarSign",
      title: `${data.pendingQuotes} quote${data.pendingQuotes > 1 ? "s" : ""} awaiting response`,
      description: "Quotes sent to customers but not yet approved or rejected.",
      action: "View Quotes",
      actionHref: "/dashboard/quotes",
    });
  }

  if (data.reorderAlerts > 0) {
    insights.push({
      type: "info",
      icon: "RefreshCw",
      title: `${data.reorderAlerts} customer${data.reorderAlerts > 1 ? "s" : ""} may be ready to reorder`,
      description: "Based on past order patterns, these customers are due.",
      action: "View Customers",
      actionHref: "/dashboard/customers",
    });
  }

  if (data.inactiveCustomers90Days > 0) {
    insights.push({
      type: "info",
      icon: "Users",
      title: `${data.inactiveCustomers90Days} customer${data.inactiveCustomers90Days > 1 ? "s" : ""} inactive 90+ days`,
      description: "Haven't placed an order in over 3 months — consider reaching out.",
    });
  }

  if (data.jobsCompletedThisWeek > 0) {
    insights.push({
      type: "success",
      icon: "CheckCircle",
      title: `${data.jobsCompletedThisWeek} job${data.jobsCompletedThisWeek > 1 ? "s" : ""} completed this week`,
      description: "Great production throughput!",
    });
  }

  return insights;
}
