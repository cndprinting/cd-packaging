import { NextResponse } from "next/server";
import { currentRepScope } from "@/lib/rep-scope";
import { getSession } from "@/lib/session";
import { JOBS_LIVE_SINCE } from "@/lib/press-gate";
import { ROUTE_ROLES } from "@/lib/routing";

// Darrin's "To route" list (11/18/26): live jobs he hasn't reviewed yet, oldest first.
export async function GET() {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ jobs: [] });
  const jobs = await prisma.job.findMany({
    where: { routedAt: null, createdAt: { gte: JOBS_LIVE_SINCE }, status: { notIn: ["SHIPPED", "DELIVERED", "INVOICED"] }, ...((sc => sc ? { id: { in: sc.jobIds } } : {})(await currentRepScope())) },
    select: { id: true, jobNumber: true, name: true, quantity: true, dueDate: true, createdAt: true, productType: true, order: { select: { company: { select: { name: true } } } }, csr: { select: { name: true } } },
    orderBy: { createdAt: "asc" }, take: 200,
  });
  return NextResponse.json({
    jobs: jobs.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, quantity: j.quantity, dueDate: j.dueDate, enteredAt: j.createdAt, productType: j.productType, customer: j.order?.company?.name || "", csr: j.csr?.name || null })),
    canRoute: ROUTE_ROLES.includes(session.role),
  });
}
