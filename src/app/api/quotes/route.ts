import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// No more demo quotes — real data only

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
  return NextResponse.json({ quotes: [], source: "empty" });
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

    const statusMap: Record<string, string> = { draft: "DRAFT", sent: "SENT", approved: "APPROVED", rejected: "REJECTED", converted: "CONVERTED", archived: "ARCHIVED" };
    const dbStatus = statusMap[status] || status;

    await prisma.quote.update({ where: { id }, data: { status: dbStatus as "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED" | "ARCHIVED" } });

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

        const order = await prisma.order.create({ data: { orderNumber, companyId, status: "QUOTE", priority: "NORMAL", dueDate: quote.validUntil, poNumber: quote.contactEmail ? undefined : undefined } });

        // Parse specs JSON if available
        let specs: Record<string, string> = {};
        if (quote.specs) { try { specs = JSON.parse(quote.specs); } catch {} }

        const job = await prisma.job.create({
          data: {
            jobNumber, orderId: order.id,
            name: quote.productName,
            description: quote.description,
            status: "QUOTE",
            priority: "NORMAL",
            quantity: quote.quantity,
            quotedPrice: quote.totalPrice,
            productType: quote.productType,
            jobType: "NEW_ORDER",
            estimateNumber: quote.quoteNumber,
            contactName: quote.contactName,
            customerPO: "",
            // Populate from quote specs
            stockDescription: specs.paperStock || specs.paper || null,
            finishedWidth: specs.dimensions ? parseFloat(specs.dimensions.split("x")[0]) || null : null,
            finishedHeight: specs.dimensions ? parseFloat(specs.dimensions.split("x")[1]) || null : null,
            inkFront: specs.colors || null,
            varnish: specs.coating || null,
            coating: specs.finishing || null,
          },
        });
        await prisma.quote.update({ where: { id }, data: { convertedJobId: job.id } });

        // Auto-create purchase flags based on specs
        const purchaseFlags = [];
        if (specs.paperStock) purchaseFlags.push({ jobId: job.id, category: "paper", description: `${specs.paperStock} - ${quote.quantity} units`, status: "needed" });
        if (specs.colors?.includes("PMS")) purchaseFlags.push({ jobId: job.id, category: "ink", description: `Spot color ink: ${specs.colors}`, status: "needed" });
        if (specs.finishing?.includes("Die")) purchaseFlags.push({ jobId: job.id, category: "cutting_die", description: `Cutting die for ${quote.productName}`, status: "needed" });
        if (specs.finishing?.includes("Foil")) purchaseFlags.push({ jobId: job.id, category: "foil_die", description: `Foil die for ${quote.productName}`, status: "needed" });
        if (purchaseFlags.length > 0) await prisma.purchaseFlag.createMany({ data: purchaseFlags });
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Quote PUT error:", error);
    return NextResponse.json({ error: "Failed to update quote" }, { status: 500 });
  }
}
