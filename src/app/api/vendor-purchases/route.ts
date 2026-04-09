import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const vendor = searchParams.get("vendor");

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ records: [], total: 0, vendors: [] });

    const where: any = {};
    if (vendor) where.vendor = { contains: vendor, mode: "insensitive" };
    if (search) {
      where.OR = [
        { vendor: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { jobNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.vendorPurchase.findMany({ where, orderBy: { date: "desc" }, take: 100 }),
      prisma.vendorPurchase.count({ where }),
    ]);

    // Get unique vendor names for filter
    const allVendors = await prisma.vendorPurchase.findMany({
      select: { vendor: true },
      distinct: ["vendor"],
      where: { vendor: { not: null } },
    });

    return NextResponse.json({
      records,
      total,
      vendors: allVendors.map(v => v.vendor).filter(Boolean).sort(),
    });
  } catch (error) {
    console.error("Vendor purchases GET error:", error);
    return NextResponse.json({ records: [], total: 0, vendors: [] });
  }
}
