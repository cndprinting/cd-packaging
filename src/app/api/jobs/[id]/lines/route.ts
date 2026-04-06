import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ lineItems: [], pressRuns: [] });

    const [lineItems, pressRuns] = await Promise.all([
      prisma.jobLineItem.findMany({ where: { jobId: id }, orderBy: { sortOrder: "asc" } }),
      prisma.pressRun.findMany({ where: { jobId: id }, orderBy: { sortOrder: "asc" } }),
    ]);
    return NextResponse.json({ lineItems, pressRuns });
  } catch (error) {
    console.error("Job lines GET error:", error);
    return NextResponse.json({ lineItems: [], pressRuns: [] });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { type, ...data } = body; // type: "lineItem" or "pressRun"

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    if (type === "lineItem") {
      const count = await prisma.jobLineItem.count({ where: { jobId: id } });
      const item = await prisma.jobLineItem.create({
        data: {
          jobId: id, quantity: parseInt(data.quantity) || 0, description: data.description || "",
          flatSize: data.flatSize, finishedWidth: data.finishedWidth ? parseFloat(data.finishedWidth) : null,
          finishedHeight: data.finishedHeight ? parseFloat(data.finishedHeight) : null,
          inkSpec: data.inkSpec, sortOrder: count,
        },
      });
      return NextResponse.json({ item });
    }

    if (type === "pressRun") {
      const count = await prisma.pressRun.count({ where: { jobId: id } });
      const run = await prisma.pressRun.create({
        data: {
          jobId: id, press: data.press || "", formNumber: data.formNumber,
          finishCount: data.finishCount ? parseInt(data.finishCount) : null,
          makeReady: data.makeReady ? parseInt(data.makeReady) : null,
          runningSize: data.runningSize, imposition: data.imposition,
          numberUp: data.numberUp ? parseInt(data.numberUp) : null,
          inkSpec: data.inkSpec, firstPassCount: data.firstPassCount ? parseInt(data.firstPassCount) : null,
          finalPressCount: data.finalPressCount ? parseInt(data.finalPressCount) : null,
          pressmanInitials: data.pressmanInitials, sortOrder: count,
        },
      });
      return NextResponse.json({ run });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Job lines POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
