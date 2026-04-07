import { NextResponse } from "next/server";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ workCenters: [] });

    const workCenters = await prisma.workCenter.findMany({
      where: { isActive: true },
      include: {
        machines: {
          where: { isActive: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ workCenters });
  } catch (error) {
    console.error("Work centers GET error:", error);
    return NextResponse.json({ workCenters: [] });
  }
}
