import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";
import {
  generateTotpSecret,
  generateQrCodeDataUrl,
  formatSecretForManualEntry,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from "@/lib/totp";

/**
 * TOTP 2FA endpoints
 *
 * Actions:
 *  - "setup"          : authed user starts enrollment. Returns secret + QR.
 *                       Secret stored on user but totpEnabledAt left null
 *                       until they verify their first code via "confirm".
 *  - "confirm"        : authed user enters first 6-digit code from app.
 *                       Verifies, sets totpEnabledAt, returns plaintext
 *                       backup codes (only shown once).
 *  - "verify-login"   : called during login flow with the pending session
 *                       cookie + 6-digit code (or backup code). Issues
 *                       full session on success.
 *  - "disable"        : authed user disables 2FA. Requires current password
 *                       and current 6-digit code.
 *  - "regenerate-backup-codes" : authed user generates new backup codes
 *                       (requires current 6-digit code). Returns plaintext.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    // ─── Login-time verify (uses pending session cookie) ─────────────
    if (action === "verify-login") {
      const { code, pendingUserId } = body;
      if (!pendingUserId || !code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: pendingUserId } });
      if (!user || !user.totpSecret || !user.totpEnabledAt) {
        return NextResponse.json({ error: "2FA not enrolled for this account" }, { status: 400 });
      }
      if (!user.isActive) {
        return NextResponse.json({ error: "Account disabled" }, { status: 403 });
      }

      // Try TOTP first, then fall back to backup code
      const totpOk = verifyTotpCode(user.totpSecret, code);
      let backupOk = false;
      if (!totpOk) {
        const idx = await verifyBackupCode(code, user.totpBackupCodes);
        if (idx >= 0) {
          // Burn the used code
          const codes = JSON.parse(user.totpBackupCodes!);
          codes[idx] = ""; // empty string = used
          await prisma.user.update({
            where: { id: user.id },
            data: { totpBackupCodes: JSON.stringify(codes) },
          });
          backupOk = true;
        }
      }
      if (!totpOk && !backupOk) {
        return NextResponse.json({ error: "Invalid code" }, { status: 401 });
      }

      await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as any,
        companyId: user.companyId || null,
        companyName: null,
      });
      return NextResponse.json({
        ok: true,
        backupUsed: backupOk,
      });
    }

    // ─── All other actions require an active session ────────────────
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (action === "setup") {
      const secret = generateTotpSecret();
      const qrDataUrl = await generateQrCodeDataUrl(secret, session.email);
      // Store secret on user but DON'T set totpEnabledAt yet — that
      // happens after they confirm the first code.
      await prisma.user.update({
        where: { id: session.id },
        data: { totpSecret: secret, totpEnabledAt: null },
      });
      return NextResponse.json({
        ok: true,
        qrDataUrl,
        manualEntry: formatSecretForManualEntry(secret),
        // Don't return raw secret — it's already in the QR; client can
        // copy from the manualEntry string if user can't scan.
      });
    }

    if (action === "confirm") {
      const { code } = body;
      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (!user?.totpSecret) {
        return NextResponse.json({ error: "Run setup first" }, { status: 400 });
      }
      if (!verifyTotpCode(user.totpSecret, code)) {
        return NextResponse.json({ error: "Invalid code — try again" }, { status: 401 });
      }
      const { plaintext, hashed } = await generateBackupCodes();
      await prisma.user.update({
        where: { id: session.id },
        data: {
          totpEnabledAt: new Date(),
          totpBackupCodes: JSON.stringify(hashed),
        },
      });
      return NextResponse.json({
        ok: true,
        backupCodes: plaintext,
        message: "2FA enabled. Save these backup codes somewhere safe — each can be used once if you lose access to your authenticator app.",
      });
    }

    if (action === "disable") {
      const { password, code } = body;
      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!user.totpEnabledAt) {
        return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
      }
      // Require both password and code to disable — defends against
      // session-hijack attacks turning off 2FA silently.
      const pwOk = await verifyPassword(password || "", user.passwordHash);
      if (!pwOk) return NextResponse.json({ error: "Password incorrect" }, { status: 401 });
      if (!verifyTotpCode(user.totpSecret || "", code)) {
        return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
      }
      await prisma.user.update({
        where: { id: session.id },
        data: { totpSecret: null, totpEnabledAt: null, totpBackupCodes: null },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "regenerate-backup-codes") {
      const { code } = body;
      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (!user?.totpSecret || !user.totpEnabledAt) {
        return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
      }
      if (!verifyTotpCode(user.totpSecret, code)) {
        return NextResponse.json({ error: "Invalid code" }, { status: 401 });
      }
      const { plaintext, hashed } = await generateBackupCodes();
      await prisma.user.update({
        where: { id: session.id },
        data: { totpBackupCodes: JSON.stringify(hashed) },
      });
      return NextResponse.json({ ok: true, backupCodes: plaintext });
    }

    if (action === "status") {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { totpEnabledAt: true, totpBackupCodes: true },
      });
      const codes = user?.totpBackupCodes ? JSON.parse(user.totpBackupCodes) as string[] : [];
      return NextResponse.json({
        enabled: !!user?.totpEnabledAt,
        enabledAt: user?.totpEnabledAt,
        unusedBackupCodes: codes.filter(c => c).length,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error("TOTP error:", e);
    return NextResponse.json({ error: "TOTP failed", message: e?.message }, { status: 500 });
  }
}
