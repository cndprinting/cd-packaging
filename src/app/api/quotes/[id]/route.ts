import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 11/22/26 lock-down: this used to answer anyone with no login.
    const viewer = await getSession();
    if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    // Staff see any quote; a vendor only its own sourcing requests; a customer only its own company's.
    if (viewer.role === "VENDOR" && quote.sourcingVendor !== (viewer as any).vendorName) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (viewer.role === "CUSTOMER" && (!viewer.companyId || quote.companyId !== viewer.companyId)) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

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
        sourcingInvoiceId: quote.sourcingInvoiceId,
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
