import { NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || ""}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || "",
  },
};

export async function GET(request: Request) {
  try {
    if (!msalConfig.auth.clientId || !msalConfig.auth.clientSecret) {
      return NextResponse.json({ error: "Microsoft SSO not configured" }, { status: 500 });
    }

    const cca = new ConfidentialClientApplication(msalConfig);
    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/auth/microsoft/callback`;

    const authUrl = await cca.getAuthCodeUrl({
      scopes: ["openid", "profile", "email", "User.Read"],
      redirectUri,
      prompt: "select_account",
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Microsoft SSO error:", error);
    return NextResponse.redirect(new URL("/login?error=sso_failed", request.url));
  }
}
