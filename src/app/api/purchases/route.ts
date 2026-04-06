import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ purchases: [] });

    const where = jobId ? { jobId } : {};
    const purchases = await prisma.purchaseFlag.findMany({
      where,
      include: { job: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ purchases });
  } catch (error) {
    console.error("Purchases GET error:", error);
    return NextResponse.json({ purchases: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { jobId, category, description, vendor, estimatedCost, notes } = body;
    if (!jobId || !category || !description) return NextResponse.json({ error: "Job, category, and description required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ purchase: { id: `pf-${Date.now()}`, ...body, status: "needed" } });

    const purchase = await prisma.purchaseFlag.create({
      data: { jobId, category, description, vendor, estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null, notes, status: "needed" },
    });
    return NextResponse.json({ purchase });
  } catch (error) {
    console.error("Purchase POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id, status, poNumber } = await request.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ ok: true });

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (poNumber) data.poNumber = poNumber;
    if (status === "ordered") data.orderedDate = new Date();
    if (status === "received") data.receivedDate = new Date();

    await prisma.purchaseFlag.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Purchase PUT error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
