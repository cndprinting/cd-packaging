import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const demoQuotes = [
  { id: "q-1", quoteNumber: "QT-2026-001", customerName: "Fresh Foods Co.", contactName: "Tom Richards", contactEmail: "tom@freshfoods.com", productType: "FOLDING_CARTON", productName: "Cereal Box - 12oz", description: "Full color SBS folding carton", quantity: 25000, unitPrice: 0.18, totalPrice: 4500, status: "approved", validUntil: "2026-04-30", createdAt: "2026-03-15" },
  { id: "q-2", quoteNumber: "QT-2026-002", customerName: "Luxe Cosmetics", contactName: "Nina Patel", contactEmail: "nina@luxecosmetics.com", productType: "FOLDING_CARTON", productName: "Foundation Box - Premium", description: "Rigid box with magnetic closure", quantity: 10000, unitPrice: 0.45, totalPrice: 4500, status: "sent", validUntil: "2026-04-20", createdAt: "2026-03-20" },
  { id: "q-3", quoteNumber: "QT-2026-003", customerName: "GreenLeaf Supplements", contactName: "Amy Liu", contactEmail: "", productType: "COMMERCIAL_PRINT", productName: "Supplement Label - 60ct", description: "Pressure-sensitive label", quantity: 100000, unitPrice: 0.03, totalPrice: 3000, status: "approved", validUntil: "2026-05-01", createdAt: "2026-03-18" },
  { id: "q-4", quoteNumber: "QT-2026-004", customerName: "TechGear Electronics", contactName: "James Park", contactEmail: "", productType: "COMMERCIAL_PRINT", productName: "Product Manual", description: "24-page saddle-stitch booklet", quantity: 20000, unitPrice: 0.12, totalPrice: 2400, status: "draft", validUntil: "2026-04-25", createdAt: "2026-04-01" },
  { id: "q-5", quoteNumber: "QT-2026-005", customerName: "Artisan Spirits", contactName: "Mark Davis", contactEmail: "", productType: "COMMERCIAL_PRINT", productName: "Bottle Neck Tag", description: "Die-cut hang tag", quantity: 50000, unitPrice: 0.05, totalPrice: 2500, status: "sent", validUntil: "2026-04-15", createdAt: "2026-03-25" },
];

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (prisma) {
      const quotes = await prisma.quote.findMany({ orderBy: { createdAt: "desc" } });
      if (quotes.length > 0) {
        return NextResponse.json({ quotes: quotes.map(q => ({
          id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerName,
          contactName: q.contactName, contactEmail: q.contactEmail,
          productType: q.productType, productName: q.productName, description: q.description,
          quantity: q.quantity, unitPrice: q.unitPrice, totalPrice: q.totalPrice,
          status: q.status.toLowerCase(), validUntil: q.validUntil?.toISOString().split("T")[0] || "",
          createdAt: q.createdAt.toISOString().split("T")[0],
        })), source: "database" });
      }
    }
  } catch { /* fallback */ }
  return NextResponse.json({ quotes: demoQuotes, source: "demo" });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { customerName, productType, productName, description, quantity, unitPrice, validUntil, contactName, contactEmail, notes } = body;
    if (!customerName || !productName || !quantity) return NextResponse.json({ error: "Customer, product name, and quantity required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      // Demo fallback
      return NextResponse.json({ quote: { id: `q-${Date.now()}`, quoteNumber: `QT-2026-${Date.now() % 1000}`, ...body, totalPrice: (parseFloat(unitPrice) || 0) * (parseInt(quantity) || 0), status: "draft", createdAt: new Date().toISOString().split("T")[0] } });
    }

    const quoteCount = await prisma.quote.count();
    const quoteNumber = `QT-2026-${String(quoteCount + 10).padStart(3, "0")}`;
    const qty = parseInt(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber, customerName, contactName, contactEmail,
        productType: productType === "COMMERCIAL_PRINT" ? "COMMERCIAL_PRINT" : "FOLDING_CARTON",
        productName, description, quantity: qty,
        unitPrice: price, totalPrice: price * qty,
        status: "DRAFT",
        validUntil: validUntil ? new Date(validUntil) : null,
        notes, createdBy: session.id,
      },
    });

    return NextResponse.json({ quote: { ...quote, status: "draft", validUntil: quote.validUntil?.toISOString().split("T")[0] || "", createdAt: quote.createdAt.toISOString().split("T")[0] } });
  } catch (error) {
    console.error("Quote POST error:", error);
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: "ID and status required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ ok: true, status });

    const statusMap: Record<string, string> = { draft: "DRAFT", sent: "SENT", approved: "APPROVED", rejected: "REJECTED", converted: "CONVERTED" };
    const dbStatus = statusMap[status] || status;

    await prisma.quote.update({ where: { id }, data: { status: dbStatus as "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED" } });

    // If converting to job, create the job
    if (status === "converted") {
      const quote = await prisma.quote.findUnique({ where: { id } });
      if (quote) {
        const jobCount = await prisma.job.count();
        const jobNumber = `PKG-2026-${String(jobCount + 100).padStart(3, "0")}`;
        const orderCount = await prisma.order.count();
        const orderNumber = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;

        // Find or create company
        let companyId = quote.companyId;
        if (!companyId) {
          const slug = quote.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
          let company = await prisma.company.findUnique({ where: { slug } });
          if (!company) company = await prisma.company.create({ data: { name: quote.customerName, slug } });
          companyId = company.id;
        }

        const order = await prisma.order.create({ data: { orderNumber, companyId, status: "QUOTE", priority: "NORMAL", dueDate: quote.validUntil } });
        const job = await prisma.job.create({ data: { jobNumber, orderId: order.id, name: quote.productName, description: quote.description, status: "QUOTE", priority: "NORMAL", quantity: quote.quantity, productType: quote.productType } });
        await prisma.quote.update({ where: { id }, data: { convertedJobId: job.id } });
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Quote PUT error:", error);
    return NextResponse.json({ error: "Failed to update quote" }, { status: 500 });
  }
}
