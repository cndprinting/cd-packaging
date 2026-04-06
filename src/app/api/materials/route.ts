import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      const { demoMaterials } = await import("@/lib/demo-data");
      return NextResponse.json({ materials: demoMaterials, source: "demo" });
    }
    const materials = await prisma.material.findMany({
      include: { lots: true },
      orderBy: { name: "asc" },
    });
    const formatted = materials.map(m => {
      const onHand = m.lots.reduce((s, l) => s + l.quantityOnHand, 0);
      const allocated = m.lots.reduce((s, l) => s + l.quantityAllocated, 0);
      return { id: m.id, name: m.name, sku: m.sku, category: m.category, unit: m.unit, onHand, allocated, available: onHand - allocated, reorderPoint: m.reorderPoint, isShort: onHand < allocated, isLow: onHand < m.reorderPoint };
    });
    return NextResponse.json({ materials: formatted, source: "database" });
  } catch (error) {
    console.error("Materials GET error:", error);
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER" || session.role === "SALES_REP") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { name, sku, category, unit, reorderPoint, vendor } = body;
    if (!name) return NextResponse.json({ error: "Material name is required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const material = await prisma.material.create({
      data: { name, sku, category, unit: unit || "sheets", reorderPoint: reorderPoint ? parseInt(reorderPoint) : 0, vendor },
    });
    return NextResponse.json({ material });
  } catch (error) {
    console.error("Material POST error:", error);
    return NextResponse.json({ error: "Failed to create material" }, { status: 500 });
  }
}
