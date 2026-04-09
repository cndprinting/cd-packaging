import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ standards: null, presses: [] });
    }

    const standards = await prisma.plantStandard.findFirst();
    const presses = await prisma.press.findMany({
      where: { isActive: true },
      include: {
        configurations: {
          where: { isActive: true },
          orderBy: { configNumber: "asc" },
        },
      },
      orderBy: { pressNumber: "asc" },
    });

    return NextResponse.json({ standards, presses });
  } catch (error) {
    console.error("Plant standards GET error:", error);
    return NextResponse.json({ standards: null, presses: [] });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    const adminRoles = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"];
    if (!session || !adminRoles.includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const body = await request.json();

    // Update plant standards (non-press fields)
    if (body.standards) {
      const existing = await prisma.plantStandard.findFirst();
      if (existing) {
        await prisma.plantStandard.update({
          where: { id: existing.id },
          data: body.standards,
        });
      }
    }

    // Update a specific press
    if (body.press) {
      const { id, ...pressData } = body.press;
      await prisma.press.update({ where: { id }, data: pressData });
    }

    // Update a specific press config
    if (body.pressConfig) {
      const { id, ...configData } = body.pressConfig;
      await prisma.pressConfig.update({ where: { id }, data: configData });
    }

    // Return updated data
    const standards = await prisma.plantStandard.findFirst();
    const presses = await prisma.press.findMany({
      where: { isActive: true },
      include: {
        configurations: {
          where: { isActive: true },
          orderBy: { configNumber: "asc" },
        },
      },
      orderBy: { pressNumber: "asc" },
    });

    return NextResponse.json({ standards, presses });
  } catch (error) {
    console.error("Plant standards PUT error:", error);
    return NextResponse.json({ error: "Failed to update plant standards" }, { status: 500 });
  }
}
