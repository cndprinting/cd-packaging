import { NextRequest, NextResponse } from "next/server";
import { createSession, destroySession } from "@/lib/session";
import { verifyPassword, hashPassword } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

const demoUser: SessionUser = {
  id: "u-1",
  email: "admin@cndpackaging.com",
  name: "Sarah Johnson",
  role: "ADMIN",
  companyId: null,
  companyName: null,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "login") {
      return handleLogin(body);
    }

    if (action === "signup") {
      return handleSignup(body);
    }

    if (action === "logout") {
      return handleLogout();
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleLogin(body: { email: string; password: string }) {
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Try database first
  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await (prisma as any).user.findUnique({ where: { email } });

    if (user) {
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
      // Block disabled accounts (security parity with SSO callback).
      if (user.isActive === false) {
        return NextResponse.json({ error: "Account disabled — contact your administrator" }, { status: 403 });
      }

      // 2FA gate — if user has TOTP enrolled, return a "pending" response
      // and wait for the second-step verify call. Don't issue a session yet.
      if (user.totpEnabledAt) {
        return NextResponse.json({
          twoFactorRequired: true,
          pendingUserId: user.id,
        });
      }

      const sessionUser: SessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId || null,
        companyName: user.companyName || null,
      };

      await createSession(sessionUser);
      return NextResponse.json({ user: sessionUser });
    }
  } catch {
    // Database not available, fall through to demo mode
  }

  // Demo mode fallback
  const { demoUsers } = await import("@/lib/demo-data");
  const demoMatch = demoUsers.find((u) => u.email === email);

  if (demoMatch || email === demoUser.email) {
    const user = demoMatch
      ? { ...demoUser, id: demoMatch.id, email: demoMatch.email, name: demoMatch.name, role: demoMatch.role }
      : demoUser;
    await createSession(user);
    return NextResponse.json({ user });
  }

  // Accept any email/password in demo mode
  const fallbackUser: SessionUser = {
    ...demoUser,
    email,
    name: email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
  await createSession(fallbackUser);
  return NextResponse.json({ user: fallbackUser });
}

async function handleSignup(body: { name: string; company: string; email: string; password: string }) {
  const { name, company, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  // Try database first
  try {
    const { prisma } = await import("@/lib/prisma");
    const existing = await (prisma as any).user.findUnique({ where: { email } });

    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await (prisma as any).user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "CUSTOMER",
        companyName: company || null,
      },
    });

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId || null,
      companyName: user.companyName || company || null,
    };

    await createSession(sessionUser);
    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch {
    // Database not available, fall through to demo mode
  }

  // Demo mode fallback
  const sessionUser: SessionUser = {
    id: `u-demo-${Date.now()}`,
    email,
    name,
    role: "CUSTOMER",
    companyId: null,
    companyName: company || null,
  };

  await createSession(sessionUser);
  return NextResponse.json({ user: sessionUser }, { status: 201 });
}

async function handleLogout() {
  await destroySession();
  return NextResponse.json({ success: true });
}
