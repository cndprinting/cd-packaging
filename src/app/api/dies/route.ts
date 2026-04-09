import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customer = searchParams.get("customer");
    const search = searchParams.get("search");

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ dies: [] });

    const where: any = { isActive: true };
    if (customer) where.customerName = { contains: customer, mode: "insensitive" };
    if (search) {
      where.OR = [
        { dieNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { item: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const dies = await prisma.cuttingDie.findMany({
      where,
      orderBy: { dieNumber: "asc" },
      take: 100,
    });

    return NextResponse.json({ dies, total: await prisma.cuttingDie.count({ where }) });
  } catch (error) {
    console.error("Dies GET error:", error);
    return NextResponse.json({ dies: [], total: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { dieNumber, customerName, item, description, length, width, height, notes } = body;
    if (!dieNumber) return NextResponse.json({ error: "Die number required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const die = await prisma.cuttingDie.create({
      data: {
        dieNumber,
        customerName: customerName || null,
        item: item || null,
        description: description || null,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ die });
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ error: "Die number already exists" }, { status: 400 });
    console.error("Dies POST error:", error);
    return NextResponse.json({ error: "Failed to create die" }, { status: 500 });
  }
}
