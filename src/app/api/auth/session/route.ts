import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Sales pipeline access is a per-user DB flag (not in the JWT) so it
    // takes effect without re-login (Benjy 6/26).
    let pipelineAccess = false;
    try {
      const prismaModule = await import("@/lib/prisma");
      const prisma = prismaModule.default;
      if (prisma) {
        const u = await prisma.user.findUnique({ where: { id: user.id }, select: { pipelineAccess: true } });
        pipelineAccess = !!u?.pipelineAccess;
      }
    } catch { /* default false */ }

    return NextResponse.json({ user: { ...user, pipelineAccess } });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
