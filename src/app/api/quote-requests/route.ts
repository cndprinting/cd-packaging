import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ requests: [] });

    const requests = await prisma.quoteRequest.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Quote requests GET error:", error);
    return NextResponse.json({ requests: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const count = await prisma.quoteRequest.count();
    const requestNumber = `QR-${String(count + 1000).padStart(5, "0")}`;

    const qr = await prisma.quoteRequest.create({
      data: {
        requestNumber,
        customerName: body.customerName || "",
        companyId: body.companyId || null,
        dateNeeded: body.dateNeeded ? new Date(body.dateNeeded) : null,
        jobType: body.jobType || null,
        pickupJobNumber: body.pickupJobNumber || null,
        productType: body.productType || null,
        descriptionType: body.descriptionType || null,
        jobTitle: body.jobTitle || null,
        quantity1: body.quantity1 ? parseInt(body.quantity1) : null,
        quantity2: body.quantity2 ? parseInt(body.quantity2) : null,
        quantity3: body.quantity3 ? parseInt(body.quantity3) : null,
        quantity4: body.quantity4 ? parseInt(body.quantity4) : null,
        quantity5: body.quantity5 ? parseInt(body.quantity5) : null,
        pages: body.pages ? parseInt(body.pages) : null,
        coverType: body.coverType || null,
        colorsSide1: body.colorsSide1 || null,
        colorsSide2: body.colorsSide2 || null,
        coatingSide1: body.coatingSide1 || null,
        coatingSide2: body.coatingSide2 || null,
        flatWidth: body.flatWidth ? parseFloat(body.flatWidth) : null,
        flatHeight: body.flatHeight ? parseFloat(body.flatHeight) : null,
        finishedWidth: body.finishedWidth ? parseFloat(body.finishedWidth) : null,
        finishedHeight: body.finishedHeight ? parseFloat(body.finishedHeight) : null,
        finishedDepth: body.finishedDepth ? parseFloat(body.finishedDepth) : null,
        paperWeight: body.paperWeight || null,
        paperDescription: body.paperDescription || null,
        paperType: body.paperType || null,
        finishing: body.finishing || null,
        specialInstructions: body.specialInstructions || null,
        customColorCoatingNotes: body.customColorCoatingNotes || null,
        vendorName: body.vendorName || null,
        deliveryInstructions: body.deliveryInstructions || null,
        submittedBy: session.id,
        submittedByName: session.name,
      },
    });

    return NextResponse.json({ request: qr });
  } catch (error) {
    console.error("Quote request POST error:", error);
    return NextResponse.json({ error: "Failed to create quote request" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const data: any = { status };
    if (status === "estimating") data.estimatedBy = session.name;
    if (body.convertedQuoteId) data.convertedQuoteId = body.convertedQuoteId;

    const qr = await prisma.quoteRequest.update({ where: { id }, data });
    return NextResponse.json({ request: qr });
  } catch (error) {
    console.error("Quote request PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
