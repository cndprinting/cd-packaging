import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// In-app notifications for the logged-in user. Today that's @mentions in lead
// notes (Shimmie 8/6) — someone tags you, you see a count in the header.

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ notifications: [], unread: 0 });
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return NextResponse.json({ notifications: [], unread: 0 });
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: session.id, isRead: false } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

// PUT { id } marks one read; PUT { all: true } clears the badge.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  if (body.all) {
    await prisma.notification.updateMany({ where: { userId: session.id, isRead: false }, data: { isRead: true } });
  } else if (body.id) {
    // Scoped to the caller so an id from elsewhere can't mark someone else's.
    await prisma.notification.updateMany({ where: { id: body.id, userId: session.id }, data: { isRead: true } });
  }
  return NextResponse.json({ ok: true });
}
