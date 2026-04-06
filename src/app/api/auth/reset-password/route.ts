import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, token, newPassword } = await request.json();

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    // Step 1: Request reset (email provided, no token)
    if (email && !token) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Don't reveal if email exists
        return NextResponse.json({ ok: true, message: "If this email exists, a reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.inviteToken.create({
        data: { email, token: resetToken, role: user.role, companyId: user.companyId, expiresAt, createdBy: "system" },
      });

      const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
      const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

      // Try sending email via Resend
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "C&D Packaging <noreply@cndprinting.com>",
            to: email,
            subject: "Reset your C&D Packaging password",
            html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p><p>— C&D Packaging</p>`,
          });
        } catch (e) {
          console.error("Failed to send reset email:", e);
        }
      }

      return NextResponse.json({ ok: true, message: "If this email exists, a reset link has been sent.", resetUrl: process.env.RESEND_API_KEY ? undefined : resetUrl });
    }

    // Step 2: Reset password (token + newPassword provided)
    if (token && newPassword) {
      if (newPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

      const invite = await prisma.inviteToken.findUnique({ where: { token } });
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
        return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
      }

      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({ where: { email: invite.email }, data: { passwordHash } });
      await prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });

      return NextResponse.json({ ok: true, message: "Password has been reset. You can now sign in." });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
