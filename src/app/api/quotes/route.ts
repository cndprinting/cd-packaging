import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const demoQuotes = [
  { id: "q-1", quoteNumber: "QT-2026-001", customerName: "Fresh Foods Co.", contactName: "Tom Richards", productType: "FOLDING_CARTON", productName: "Cereal Box - 12oz", description: "Full color SBS folding carton", quantity: 25000, unitPrice: 0.18, totalPrice: 4500, status: "approved", specs: { dimensions: "8x6x2.5in", paperStock: "18pt C1S", colors: "4/1 CMYK", coating: "Aqueous Gloss", finishing: "Die Cut + Glue" }, validUntil: "2026-04-30", createdAt: "2026-03-15" },
  { id: "q-2", quoteNumber: "QT-2026-002", customerName: "Luxe Cosmetics", contactName: "Nina Patel", productType: "FOLDING_CARTON", productName: "Foundation Box - Premium", description: "Rigid box with magnetic closure, foil stamping", quantity: 10000, unitPrice: 0.45, totalPrice: 4500, status: "sent", specs: { dimensions: "4x4x1.5in", paperStock: "24pt SBS", colors: "4/4 CMYK + PMS", coating: "Soft Touch Matte", finishing: "Foil Stamp + Die Cut" }, validUntil: "2026-04-20", createdAt: "2026-03-20" },
  { id: "q-3", quoteNumber: "QT-2026-003", customerName: "GreenLeaf Supplements", contactName: "Amy Liu", productType: "COMMERCIAL_PRINT", productName: "Supplement Label - 60ct", description: "Pressure-sensitive label", quantity: 100000, unitPrice: 0.03, totalPrice: 3000, status: "approved", specs: { dimensions: "3x5in", paperStock: "Semi-Gloss Label", colors: "4/0 CMYK", coating: "UV Varnish", finishing: "Die Cut" }, validUntil: "2026-05-01", createdAt: "2026-03-18" },
  { id: "q-4", quoteNumber: "QT-2026-004", customerName: "TechGear Electronics", contactName: "James Park", productType: "COMMERCIAL_PRINT", productName: "Product Manual", description: "Saddle-stitch booklet, 24 pages", quantity: 20000, unitPrice: 0.12, totalPrice: 2400, status: "draft", specs: { dimensions: "5.5x8.5in", paperStock: "80# Gloss Text", colors: "4/4 CMYK", coating: "None", finishing: "Saddle Stitch" }, validUntil: "2026-04-25", createdAt: "2026-04-01" },
  { id: "q-5", quoteNumber: "QT-2026-005", customerName: "Artisan Spirits", contactName: "Mark Davis", productType: "COMMERCIAL_PRINT", productName: "Bottle Neck Tag", description: "Die-cut hang tag with string", quantity: 50000, unitPrice: 0.05, totalPrice: 2500, status: "sent", specs: { dimensions: "2x3in", paperStock: "14pt C2S", colors: "4/1 CMYK + Foil", coating: "Spot UV", finishing: "Die Cut + String" }, validUntil: "2026-04-15", createdAt: "2026-03-25" },
  { id: "q-6", quoteNumber: "QT-2026-006", customerName: "Fresh Foods Co.", contactName: "Tom Richards", productType: "FOLDING_CARTON", productName: "Snack Box - Party Size", description: "Large format corrugated display", quantity: 5000, unitPrice: 0.85, totalPrice: 4250, status: "rejected", specs: { dimensions: "14x10x4in", paperStock: "E-Flute Corrugated", colors: "4/0 CMYK", coating: "Aqueous Gloss", finishing: "Die Cut + Glue" }, validUntil: "2026-04-10", createdAt: "2026-03-10" },
  { id: "q-7", quoteNumber: "QT-2026-007", customerName: "Luxe Cosmetics", contactName: "Nina Patel", productType: "FOLDING_CARTON", productName: "Holiday Gift Set Box", description: "Two-piece rigid with ribbon", quantity: 8000, unitPrice: 0.65, totalPrice: 5200, status: "converted", specs: { dimensions: "12x8x3in", paperStock: "24pt SBS", colors: "4/4 + PMS Metallic", coating: "Soft Touch + Spot UV", finishing: "Die Cut + Assembly" }, validUntil: "2026-03-30", createdAt: "2026-03-05" },
  { id: "q-8", quoteNumber: "QT-2026-008", customerName: "GreenLeaf Supplements", contactName: "Amy Liu", productType: "COMMERCIAL_PRINT", productName: "Protein Bar Wrapper", description: "Flexo-printed flow wrap film", quantity: 200000, unitPrice: 0.02, totalPrice: 4000, status: "draft", specs: { dimensions: "6x4in", paperStock: "OPP Film", colors: "8-color Flexo", coating: "Matte Lamination", finishing: "Slit + Rewind" }, validUntil: "2026-05-15", createdAt: "2026-04-03" },
];

export async function GET() {
  return NextResponse.json({ quotes: demoQuotes });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const quoteCount = demoQuotes.length;
    const quote = {
      id: `q-${Date.now()}`,
      quoteNumber: `QT-2026-${String(quoteCount + 10).padStart(3, "0")}`,
      ...body,
      unitPrice: parseFloat(body.unitPrice) || 0,
      totalPrice: (parseFloat(body.unitPrice) || 0) * (parseInt(body.quantity) || 0),
      status: "draft",
      createdAt: new Date().toISOString().split("T")[0],
    };

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("Quote POST error:", error);
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
  }
}
