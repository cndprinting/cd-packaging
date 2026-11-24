import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// "ASI account" on the customer (Benjy 11/24/26): promotional-products distributors
// that Denise quotes and handles. Shows as a badge on Customers and the Sales Funnel.
const ASI_SET_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING", "CSR", "SALES_MANAGER"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !ASI_SET_ROLES.includes(session.role)) return NextResponse.json({ error: "Only accounting, Customer Service or the owners can change this" }, { status: 403 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const co = await prisma.company.update({ where: { id }, data: { asiAccount: !!b.on }, select: { id: true, name: true, asiAccount: true } }).catch(() => null);
  if (!co) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  try {
    await prisma.activityLog.create({ data: { userId: session.id, action: "CUSTOMER", details: `${co.name}: ASI account ${co.asiAccount ? "on" : "off"} by ${session.name}` } });
  } catch { /* activity log needs an order on some setups; not critical */ }
  return NextResponse.json({ ok: true, company: co });
}
