import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/session";

// In-memory store for demo; in production use DB
const inviteTokens = new Map<
  string,
  { email: string; role: string; invitedBy: string; createdAt: Date; used: boolean }
>();

export { inviteTokens };

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN, PRODUCTION_MANAGER, or CSR can invite
    const allowedRoles = ["ADMIN", "PRODUCTION_MANAGER", "CSR"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role = "CUSTOMER" } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString("hex");

    inviteTokens.set(token, {
      email,
      role,
      invitedBy: session.id,
      createdAt: new Date(),
      used: false,
    });

    const baseUrl = request.nextUrl.origin;
    const inviteUrl = `${baseUrl}/invite/${token}`;

    return NextResponse.json({ inviteUrl, token });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

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

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      valid: true,
    });
  } catch (error) {
    console.error("Invite validation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
