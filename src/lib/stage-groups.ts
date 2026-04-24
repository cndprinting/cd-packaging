// Stage groups — maps the 19 detailed JobStatus values into 5 high-level
// phases of the production lifecycle. Pre-press is its own phase (NOT
// production) per workflow review: it's all the technical prep work that
// happens before the physical press starts.
//
// QUOTING:    estimating + customer approval of price
// PRE_PRESS:  artwork → proofs → customer sign-off → plates
// READY:      materials/scheduling — handoff zone to Darrin
// PRODUCTION: physical printing + finishing (the press / die / glue floor)
// FULFILLMENT: post-production — packing, shipping, billing

export type StageGroup = "QUOTING" | "PRE_PRESS" | "READY" | "PRODUCTION" | "FULFILLMENT";

export const STAGE_GROUP_MAP: Record<string, StageGroup> = {
  QUOTE: "QUOTING",
  ARTWORK_RECEIVED: "PRE_PRESS",
  STRUCTURAL_DESIGN: "PRE_PRESS",
  PROOFING: "PRE_PRESS",
  CUSTOMER_APPROVAL: "PRE_PRESS",
  PREPRESS: "PRE_PRESS",
  PLATING: "PRE_PRESS",
  MATERIALS_ORDERED: "READY",
  MATERIALS_RECEIVED: "READY",
  SCHEDULED: "READY",
  PRINTING: "PRODUCTION",
  COATING_FINISHING: "PRODUCTION",
  DIE_CUTTING: "PRODUCTION",
  GLUING_FOLDING: "PRODUCTION",
  QA: "PRODUCTION",
  PACKED: "FULFILLMENT",
  SHIPPED: "FULFILLMENT",
  DELIVERED: "FULFILLMENT",
  INVOICED: "FULFILLMENT",
};

export function getStageGroup(status: string): StageGroup {
  return STAGE_GROUP_MAP[status] || "QUOTING";
}

export interface StageGroupMeta {
  group: StageGroup;
  label: string;
  shortLabel: string;
  color: string;        // tailwind text class
  bg: string;           // tailwind bg class
  border: string;       // tailwind border class
  printColor: string;   // hex for print view
  printBg: string;      // hex for print view
  helpText: string;
}

export function getStageGroupMeta(status: string): StageGroupMeta {
  const group = getStageGroup(status);
  switch (group) {
    case "QUOTING":
      return {
        group, label: "Quoting", shortLabel: "QUOTE",
        color: "text-gray-700", bg: "bg-gray-100", border: "border-gray-300",
        printColor: "#374151", printBg: "#f3f4f6",
        helpText: "Estimate not yet approved by customer.",
      };
    case "PRE_PRESS":
      return {
        group, label: "Pre-Press", shortLabel: "PRE-PRESS",
        color: "text-purple-800", bg: "bg-purple-100", border: "border-purple-400",
        printColor: "#581c87", printBg: "#f3e8ff",
        helpText: status === "CUSTOMER_APPROVAL"
          ? "Awaiting final customer proof approval — release to production once approved."
          : "Artwork, proofs, and plates being prepared. Production cannot begin yet.",
      };
    case "READY":
      return {
        group, label: "Ready for Production", shortLabel: "READY",
        color: "text-emerald-800", bg: "bg-emerald-100", border: "border-emerald-500",
        printColor: "#065f46", printBg: "#d1fae5",
        helpText: "Pre-press complete. Materials and scheduling in progress — Darrin owns from here.",
      };
    case "PRODUCTION":
      return {
        group, label: "In Production", shortLabel: "IN PRODUCTION",
        color: "text-blue-800", bg: "bg-blue-100", border: "border-blue-500",
        printColor: "#1e40af", printBg: "#dbeafe",
        helpText: "Physical printing and finishing in progress.",
      };
    case "FULFILLMENT":
      return {
        group, label: "Fulfillment", shortLabel: "FULFILLMENT",
        color: "text-teal-800", bg: "bg-teal-100", border: "border-teal-500",
        printColor: "#115e59", printBg: "#ccfbf1",
        helpText: "Packed, shipped, or invoiced.",
      };
  }
}
