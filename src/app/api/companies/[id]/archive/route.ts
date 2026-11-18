import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ARCHIVE_ROLES } from "@/lib/customer-archive";

// Archive an out-of-business customer, or restore one (Benjy 11/18).
// POST { action: "archive", reason } | { action: "restore" }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !ARCHIVE_ROLES.includes(session.role)) return NextResponse.json({ error: "Only accounting or the owners can archive a customer" }, { status: 403 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const co = await prisma.company.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!co) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (b.action === "archive") {
    const reason = String(b.reason || "").trim().slice(0, 200) || "Out of business";
    await prisma.company.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), archivedBy: session.name, archivedReason: reason } as any });
  } else if (b.action === "restore") {
    await prisma.company.update({ where: { id }, data: { isActive: true, archivedAt: null, archivedBy: null, archivedReason: null } as any });
  } else return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
