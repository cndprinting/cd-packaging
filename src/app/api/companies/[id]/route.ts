import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { name: "asc" } },
        orders: {
          include: { jobs: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Get quotes for this company
    const quotes = await prisma.quote.findMany({
      where: { customerName: company.name },
      orderBy: { createdAt: "desc" },
    });

    // Calculate summary stats
    const totalRevenue = company.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalJobs = company.orders.reduce((sum, o) => sum + o.jobs.length, 0);
    const activeJobs = company.orders.reduce((sum, o) => sum + o.jobs.filter(j => j.status !== "DELIVERED" && j.status !== "INVOICED").length, 0);

    return NextResponse.json({
      company: {
        ...company,
        totalRevenue,
        totalJobs,
        activeJobs,
        totalOrders: company.orders.length,
        totalQuotes: quotes.length,
      },
      quotes: quotes.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        productName: q.productName,
        quantity: q.quantity,
        totalPrice: q.totalPrice,
        status: q.status.toLowerCase(),
        createdAt: q.createdAt.toISOString().split("T")[0],
      })),
    });
  } catch (error) {
    console.error("Company detail error:", error);
    return NextResponse.json({ error: "Failed to load company" }, { status: 500 });
  }
}
