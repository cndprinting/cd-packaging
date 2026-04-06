import { NextRequest, NextResponse } from "next/server";
import { demoJobs, demoCompanies } from "@/lib/demo-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    if (prisma) {
      const [jobs, orders, companies] = await Promise.all([
        prisma.job.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { jobNumber: { contains: q, mode: "insensitive" } }] },
          include: { order: { include: { company: true } } },
          take: 10,
        }),
        prisma.order.findMany({
          where: { OR: [{ orderNumber: { contains: q, mode: "insensitive" } }] },
          include: { company: true },
          take: 5,
        }),
        prisma.company.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          take: 5,
        }),
      ]);

      const results = [
        ...jobs.map(j => ({ type: "job" as const, id: j.id, title: j.name, subtitle: `${j.jobNumber} · ${j.order.company.name}`, href: `/dashboard/jobs/${j.id}`, status: j.status })),
        ...orders.map(o => ({ type: "order" as const, id: o.id, title: o.orderNumber, subtitle: o.company.name, href: `/dashboard/orders/${o.id}`, status: o.status })),
        ...companies.map(c => ({ type: "company" as const, id: c.id, title: c.name, subtitle: c.industry || "", href: `/dashboard/customers`, status: null })),
      ];
      return NextResponse.json({ results, source: "database" });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ results: [] });

  return NextResponse.json({ results: [...jobResults, ...companyResults], source: "demo" });
}
