import { NextRequest, NextResponse } from "next/server";

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
