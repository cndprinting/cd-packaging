import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "PRODUCTION_MANAGER")) {
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
