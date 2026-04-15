import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Helpers to coerce loose JSON input into our typed columns.
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const bool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";
const int = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ requests: [] });

    const requests = await prisma.quoteRequest.findMany({
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
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

    // Line items come as array of { version, quantity, ... }. Filter out empty rows.
    type LineItemInput = {
      version?: string;
      quantity?: unknown;
      flatWidth?: unknown;
      flatHeight?: unknown;
      finishedWidth?: unknown;
      finishedHeight?: unknown;
      finishedDepth?: unknown;
      dieNumber?: string;
      dieIsNew?: unknown;
      notes?: string;
    };
    const rawLineItems: LineItemInput[] = Array.isArray(body.lineItems) ? body.lineItems : [];
    const lineItems = rawLineItems
      .filter(li => (li.version && String(li.version).trim()) || int(li.quantity))
      .map((li, idx) => ({
        sortOrder: idx,
        version: String(li.version || `Version ${idx + 1}`).trim(),
        quantity: int(li.quantity) ?? 0,
        flatWidth: num(li.flatWidth),
        flatHeight: num(li.flatHeight),
        finishedWidth: num(li.finishedWidth),
        finishedHeight: num(li.finishedHeight),
        finishedDepth: num(li.finishedDepth),
        dieNumber: str(li.dieNumber),
        dieIsNew: bool(li.dieIsNew),
        notes: str(li.notes),
      }));

    const qr = await prisma.quoteRequest.create({
      data: {
        requestNumber,
        customerName: str(body.customerName) || "",
        companyId: str(body.companyId),
        dateNeeded: body.dateNeeded ? new Date(body.dateNeeded) : null,
        jobType: str(body.jobType),
        pickupJobNumber: str(body.pickupJobNumber),
        productType: str(body.productType),
        descriptionType: str(body.descriptionType),
        jobTitle: str(body.jobTitle),
        // Legacy quantity fields retained for backwards compat; new form uses lineItems.
        quantity1: int(body.quantity1),
        quantity2: int(body.quantity2),
        quantity3: int(body.quantity3),
        quantity4: int(body.quantity4),
        quantity5: int(body.quantity5),
        pages: int(body.pages),
        coverType: str(body.coverType),
        orientation: str(body.orientation),
        lowResProofs: int(body.lowResProofs),
        hiResProofs: int(body.hiResProofs),
        colorsSide1: str(body.colorsSide1),
        colorsSide2: str(body.colorsSide2),
        coatingSide1: str(body.coatingSide1),
        coatingSide2: str(body.coatingSide2),
        floodUv: bool(body.floodUv),
        spotUv: bool(body.spotUv),
        uvSides: str(body.uvSides),
        floodLedUv: bool(body.floodLedUv),
        spotLedUv: bool(body.spotLedUv),
        ledUvSides: str(body.ledUvSides),
        aqueous: bool(body.aqueous),
        drytrap: bool(body.drytrap),
        customColorCoatingNotes: str(body.customColorCoatingNotes),
        flatWidth: num(body.flatWidth),
        flatHeight: num(body.flatHeight),
        finishedWidth: num(body.finishedWidth),
        finishedHeight: num(body.finishedHeight),
        finishedDepth: num(body.finishedDepth),
        hasBleeds: bool(body.hasBleeds),
        paperWeight: str(body.paperWeight),
        paperDescription: str(body.paperDescription),
        paperType: str(body.paperType),
        foldType: str(body.foldType),
        score: bool(body.score),
        perf: bool(body.perf),
        dieCut: bool(body.dieCut),
        existingDieNumber: str(body.existingDieNumber),
        numPockets: int(body.numPockets),
        dieVHSize: str(body.dieVHSize),
        foil: str(body.foil),
        foilIsNew: bool(body.foilIsNew),
        emboss: str(body.emboss),
        embossIsNew: bool(body.embossIsNew),
        saddleStitch: bool(body.saddleStitch),
        cornerStitch: bool(body.cornerStitch),
        perfectBind: bool(body.perfectBind),
        plasticCoil: str(body.plasticCoil),
        wireO: str(body.wireO),
        gbc: str(body.gbc),
        caseBind: str(body.caseBind),
        lamination: str(body.lamination),
        drill: bool(body.drill),
        bandIn: str(body.bandIn),
        wrapIn: str(body.wrapIn),
        padIn: str(body.padIn),
        ncrPad: bool(body.ncrPad),
        numbering: str(body.numbering),
        punch: bool(body.punch),
        roundCorner: bool(body.roundCorner),
        mailingServices: str(body.mailingServices),
        waferSeal: bool(body.waferSeal),
        waferSealTabs: int(body.waferSealTabs),
        waferSealLocation: str(body.waferSealLocation),
        finishing: str(body.finishing),
        artworkUrl: str(body.artworkUrl),
        artworkFileName: str(body.artworkFileName),
        artworkIsNew: body.artworkIsNew !== undefined ? bool(body.artworkIsNew) : true,
        artworkNotes: str(body.artworkNotes),
        specialInstructions: str(body.specialInstructions),
        vendorName: str(body.vendorName),
        deliveryInstructions: str(body.deliveryInstructions),
        submittedBy: session.id,
        submittedByName: session.name,
        ...(lineItems.length > 0 ? { lineItems: { create: lineItems } } : {}),
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
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

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (status === "estimating") data.estimatedBy = session.name;
    if (body.convertedQuoteId) data.convertedQuoteId = body.convertedQuoteId;

    const qr = await prisma.quoteRequest.update({ where: { id }, data });
    return NextResponse.json({ request: qr });
  } catch (error) {
    console.error("Quote request PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
