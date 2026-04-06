import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysFromNow(date: Date | string): number {
  const d = new Date(date);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    QUOTE: "bg-gray-100 text-gray-700",
    ARTWORK_RECEIVED: "bg-blue-100 text-blue-700",
    STRUCTURAL_DESIGN: "bg-blue-100 text-blue-700",
    PROOFING: "bg-purple-100 text-purple-700",
    CUSTOMER_APPROVAL: "bg-amber-100 text-amber-700",
    PREPRESS: "bg-indigo-100 text-indigo-700",
    PLATING: "bg-indigo-100 text-indigo-700",
    MATERIALS_ORDERED: "bg-orange-100 text-orange-700",
    MATERIALS_RECEIVED: "bg-teal-100 text-teal-700",
    SCHEDULED: "bg-cyan-100 text-cyan-700",
    PRINTING: "bg-blue-100 text-blue-700",
    COATING_FINISHING: "bg-violet-100 text-violet-700",
    DIE_CUTTING: "bg-pink-100 text-pink-700",
    GLUING_FOLDING: "bg-rose-100 text-rose-700",
    QA: "bg-yellow-100 text-yellow-700",
    PACKED: "bg-lime-100 text-lime-700",
    SHIPPED: "bg-emerald-100 text-emerald-700",
    DELIVERED: "bg-green-100 text-green-700",
    INVOICED: "bg-gray-100 text-gray-600",
    // Stage statuses
    NOT_STARTED: "bg-gray-100 text-gray-500",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    BLOCKED: "bg-red-100 text-red-700",
    COMPLETE: "bg-emerald-100 text-emerald-700",
  };
  return colors[status] || "bg-gray-100 text-gray-600";
}

export function getStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    NORMAL: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };
  return colors[priority] || "bg-gray-100 text-gray-600";
}
