import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ shipments: [], source: "demo" });
    }
    const shipments = await prisma.shipment.findMany({
      include: { order: { include: { company: true } }, items: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ shipments, source: "database" });
  } catch (error) {
    console.error("Shipments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch shipments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { orderId, carrier, trackingNumber, destination, cartons, pallets, weight, notes, items } = body;

    if (!orderId) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const shipmentCount = await prisma.shipment.count();
    const shipmentNumber = `SHP-${String(shipmentCount + 1000).padStart(4, "0")}`;

    const shipment = await prisma.shipment.create({
      data: {
        orderId, shipmentNumber, carrier, trackingNumber, destination,
        cartons: cartons ? parseInt(cartons) : null,
        pallets: pallets ? parseInt(pallets) : null,
        weight: weight ? parseFloat(weight) : null,
        notes, status: "PREPARING",
        items: items?.length ? { create: items.map((i: { description: string; quantity: number }) => ({ description: i.description, quantity: i.quantity })) } : undefined,
      },
      include: { order: { include: { company: true } }, items: true },
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    console.error("Shipment POST error:", error);
    return NextResponse.json({ error: "Failed to create shipment" }, { status: 500 });
  }
}
