import { NextRequest, NextResponse } from "next/server";
import { staffSession, denied } from "@/lib/api-guard";

export async function GET(request: NextRequest) {
  if (!(await staffSession())) return denied(); // 11/22/26 lock-down: staff login required
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const job = searchParams.get("job");

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ records: [], total: 0 });

    const where: any = {};
    if (job) where.jobNumber = { contains: job, mode: "insensitive" };
    if (search) {
      where.OR = [
        { jobNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { itemNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.paperUsage.findMany({ where, orderBy: { date: "desc" }, take: 100 }),
      prisma.paperUsage.count({ where }),
    ]);

    return NextResponse.json({ records, total });
  } catch (error) {
    console.error("Paper usage GET error:", error);
    return NextResponse.json({ records: [], total: 0 });
  }
}
