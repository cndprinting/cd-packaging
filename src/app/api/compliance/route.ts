import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Compliance checklist state (SQF library, /dashboard/compliance).
// Any logged-in internal user; customer/vendor portal sessions are rejected.

async function gate() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  if (session.role === "CUSTOMER" || session.role === "VENDOR") {
    return { error: "Forbidden", status: 403 as const };
  }
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  return { session, prisma };
}

// GET — list all checked item keys.
export async function GET() {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const checks = await g.prisma.complianceCheck.findMany();
  return NextResponse.json({ checks });
}

// POST — toggle one item: { key: string, checked: boolean }
export async function POST(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.slice(0, 200) : "";
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const checked = Boolean(body?.checked);

  if (checked) {
    await g.prisma.complianceCheck.upsert({
      where: { key },
      update: { checkedAt: new Date(), checkedBy: g.session.name || g.session.email },
      create: { key, checkedBy: g.session.name || g.session.email },
    });
  } else {
    await g.prisma.complianceCheck.deleteMany({ where: { key } });
  }
  return NextResponse.json({ ok: true, key, checked });
}
