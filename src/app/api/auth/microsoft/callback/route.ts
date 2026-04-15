import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { createSession } from "@/lib/session";

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || ""}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || "",
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      return NextResponse.redirect(new URL("/login?error=sso_denied", request.url));
    }

    const cca = new ConfidentialClientApplication(msalConfig);
    const redirectUri = `${origin}/api/auth/microsoft/callback`;

    const tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes: ["openid", "profile", "email", "User.Read"],
      redirectUri,
    });

    const email = (tokenResponse.account?.username || "").toLowerCase();
    const name = tokenResponse.account?.name || email.split("@")[0];

    if (!email) {
      return NextResponse.redirect(new URL("/login?error=no_email", request.url));
    }

    // Look up user in database
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    if (!prisma) {
      return NextResponse.redirect(new URL("/login?error=db_error", request.url));
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Strict allowlist: user must already exist in our DB, regardless of domain.
    // Admins pre-add users with the correct role; SSO just authenticates them.
    // This prevents any @cndprinting.com mailbox from auto-gaining CSR access.
    if (!user) {
      return NextResponse.redirect(new URL("/login?error=not_approved", request.url));
    }

    if (!user.isActive) {
      return NextResponse.redirect(new URL("/login?error=account_disabled", request.url));
    }

    // Create session
    const isCustomer = user.role === "CUSTOMER";
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      companyId: user.companyId,
      companyName: null,
    });

    // Redirect to appropriate dashboard
    const destination = isCustomer ? "/portal" : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (error) {
    console.error("Microsoft SSO callback error:", error);
    return NextResponse.redirect(new URL("/login?error=sso_failed", request.url));
  }
}
