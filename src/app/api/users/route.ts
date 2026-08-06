import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const session = await getSession();

    // ?pipeline=1 — the @mention roster for lead notes (Shimmie 8/6). Just the
    // names of people who can see the funnel, so a SALES_REP can populate the
    // autocomplete without being handed the full admin user list.
    if (new URL(request.url).searchParams.get("pipeline") === "1") {
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const pm = await import("@/lib/prisma");
      const db = pm.default;
      if (!db) return NextResponse.json({ users: [] });
      const me = await db.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
      if (!me?.pipelineAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const team = await db.user.findMany({
        where: { isActive: true, pipelineAccess: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ users: team });
    }

    const adminRoles = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"];
    if (!session || !adminRoles.includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ users: [], source: "demo" });
    }

    const users = await prisma.user.findMany({
      include: { company: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        company: u.company?.name || "—",
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString().split("T")[0],
      })),
      source: "database",
    });
  } catch (error) {
    console.error("Users GET error:", error);
    return NextResponse.json({ users: [], source: "demo" });
  }
}
