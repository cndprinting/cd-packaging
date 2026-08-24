import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import seeds from "@/data/quote-templates.json";

// "Start from a past quote" (Benjy 8/24). Two sources, one search:
//   1. EVERY saved classic quote -- each stores its complete form in
//      specs.classicForm, so the library grows itself with every save.
//   2. The 49 hand-keyed validated E&M quotes as permanent seeds.
// ?q= searches customer / job / quote number; blank returns the most
// recent quotes so the picker is useful with zero typing.
const CAN_USE = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING", "DIGITAL_PRESS", "CSR",
]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!prisma) return NextResponse.json({ templates: [] });

  // Saved quotes first -- most recent match wins the top of the list.
  const rows = await prisma.quote.findMany({
    where: {
      specs: { contains: '"classicForm"' },
      ...(q ? { OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { productName: { contains: q, mode: "insensitive" } },
        { quoteNumber: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { quoteNumber: true, customerName: true, productName: true, totalPrice: true, specs: true, createdAt: true },
  });
  const saved = rows.flatMap((r) => {
    try {
      const form = JSON.parse(r.specs || "{}").classicForm;
      if (!form) return [];
      return [{
        source: "saved",
        label: `${r.quoteNumber} — ${r.customerName} — ${r.productName} — qty ${(form.quantity || 0).toLocaleString()} — $${Math.round(r.totalPrice || 0).toLocaleString()}`,
        form,
      }];
    } catch { return []; }
  });

  const ql = q.toLowerCase();
  const seedMatches = (seeds as any[])
    .filter((s) => !q || s.label.toLowerCase().includes(ql) || (s.desc || "").toLowerCase().includes(ql) || String((s.form || {}).customerName || "").toLowerCase().includes(ql))
    .slice(0, q ? 15 : 5)
    .map((s) => ({ source: "validated", label: s.label + " (E&M validated)", form: s.form }));

  return NextResponse.json({ templates: [...saved, ...seedMatches] });
}
