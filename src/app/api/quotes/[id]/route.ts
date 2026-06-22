import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    return NextResponse.json({
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        companyId: quote.companyId,
        customerName: quote.customerName,
        contactName: quote.contactName,
        contactEmail: quote.contactEmail,
        productType: quote.productType,
        productName: quote.productName,
        description: quote.description,
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
        totalPrice: quote.totalPrice,
        status: quote.status.toLowerCase(),
        validUntil: quote.validUntil?.toISOString().split("T")[0] || "",
        notes: quote.notes,
        customerNotes: quote.customerNotes,
        specs: quote.specs,
        createdBy: quote.createdBy,
        convertedJobId: quote.convertedJobId,
        // Outsourced sourcing (Benjy 6/16)
        sourcingVendor: quote.sourcingVendor,
        sourcingStatus: quote.sourcingStatus,
        sourcingArtworkUrl: quote.sourcingArtworkUrl,
        sourcingArtworkName: quote.sourcingArtworkName,
        sourcingMarkupPct: quote.sourcingMarkupPct,
        sourcingItems: quote.sourcingItems,
        sourcingFulfillment: quote.sourcingFulfillment,
        vendorLandedCost: quote.vendorLandedCost,
        vendorQuoteFileUrl: quote.vendorQuoteFileUrl,
        vendorQuoteFileName: quote.vendorQuoteFileName,
        vendorQuoteNotes: quote.vendorQuoteNotes,
        vendorQuoteUploadedAt: quote.vendorQuoteUploadedAt?.toISOString() || null,
        createdAt: quote.createdAt.toISOString().split("T")[0],
        updatedAt: quote.updatedAt.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Quote GET error:", error);
    return NextResponse.json({ error: "Failed to load quote" }, { status: 500 });
  }
}
