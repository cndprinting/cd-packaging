import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ tickets: [] });

    // Owners see all tickets, others see their own
    const isAdmin = ["OWNER", "GM", "ADMIN"].includes(session.role);
    const where = isAdmin ? {} : { submittedBy: session.id };

    const tickets = await prisma.helpTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Help desk GET error:", error);
    return NextResponse.json({ tickets: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only admins, managers, and estimators can submit
    const allowed = ["OWNER", "GM", "ADMIN", "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING", "ESTIMATOR"];
    if (!allowed.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { title, description, category, priority, page } = body;

    if (!title || !description) return NextResponse.json({ error: "Title and description required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const ticket = await prisma.helpTicket.create({
      data: {
        title,
        description,
        category: category || "bug",
        priority: priority || "normal",
        page: page || null,
        submittedBy: session.id,
        submittedByName: session.name,
        submittedByRole: session.role,
      },
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Help desk POST error:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = ["OWNER", "GM", "ADMIN"].includes(session.role);
    if (!isAdmin) return NextResponse.json({ error: "Only admins can update tickets" }, { status: 403 });

    const body = await request.json();
    const { id, status, resolution } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const data: any = { status };
    if (status === "resolved" || status === "closed") {
      data.resolvedAt = new Date();
      data.resolvedBy = session.name;
      if (resolution) data.resolution = resolution;
    }

    const ticket = await prisma.helpTicket.update({ where: { id }, data });
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Help desk PUT error:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
