import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token || !name || !password) {
      return NextResponse.json(
        { error: "Token, name, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate the invite token
    const { inviteTokens } = await import("@/app/api/auth/invite/route");
    const invite = inviteTokens.get(token);

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    }

    if (invite.used) {
      return NextResponse.json({ error: "Invite has already been used" }, { status: 410 });
    }

    // Check expiration (7 days)
    const expiresAt = new Date(invite.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    let sessionUser: SessionUser;

    // Try database first
    try {
      const { prisma } = await import("@/lib/prisma");
      const passwordHash = await hashPassword(password);

      const user = await (prisma as any).user.create({
        data: {
          email: invite.email,
          name,
          passwordHash,
          role: invite.role,
        },
      });

      sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId || null,
        companyName: user.companyName || null,
      };
    } catch {
      // Demo mode fallback
      sessionUser = {
        id: `u-invite-${Date.now()}`,
        email: invite.email,
        name,
        role: invite.role as SessionUser["role"],
        companyId: null,
        companyName: null,
      };
    }

    // Mark token as used
    invite.used = true;

    // Create session
    await createSession(sessionUser);

    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
