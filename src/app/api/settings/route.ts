import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, email, currentPassword, newPassword } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const user = await prisma.user.findUnique({ where: { id: session.id }, include: { company: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      updateData.email = email;
    }

    // Password change
    if (currentPassword && newPassword) {
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      if (newPassword.length < 6) return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      updateData.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: "No changes provided" }, { status: 400 });

    const updated = await prisma.user.update({ where: { id: session.id }, data: updateData, include: { company: true } });

    // Refresh session with new data
    await createSession({
      id: updated.id, email: updated.email, name: updated.name,
      role: updated.role as "ADMIN" | "PRODUCTION_MANAGER" | "CSR" | "SALES_REP" | "CUSTOMER",
      companyId: updated.companyId, companyName: updated.company?.name || null,
    });

    return NextResponse.json({ user: { id: updated.id, name: updated.name, email: updated.email } });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
