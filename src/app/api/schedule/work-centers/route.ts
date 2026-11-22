import { NextResponse } from "next/server";
import { staffSession, denied } from "@/lib/api-guard";

export async function GET() {
  if (!(await staffSession())) return denied(); // 11/22/26 lock-down: staff login required
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
