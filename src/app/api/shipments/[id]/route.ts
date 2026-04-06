import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.carrier) updateData.carrier = body.carrier;
    if (body.trackingNumber) updateData.trackingNumber = body.trackingNumber;
    if (body.shipDate) updateData.shipDate = new Date(body.shipDate);
    if (body.estimatedDelivery) updateData.estimatedDelivery = new Date(body.estimatedDelivery);
    if (body.actualDelivery) updateData.actualDelivery = new Date(body.actualDelivery);

    const updated = await prisma.shipment.update({ where: { id }, data: updateData, include: { order: { include: { company: true } } } });
    return NextResponse.json({ shipment: updated });
  } catch (error) {
    console.error("Shipment PUT error:", error);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
