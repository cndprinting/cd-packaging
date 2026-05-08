"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  not_approved: "This Microsoft account is not on the approved list. Contact an administrator to request access.",
  not_registered: "This Microsoft account is not registered. Contact an administrator.",
  sso_denied: "Microsoft sign-in was cancelled or denied.",
  sso_failed: "Microsoft sign-in failed. Please try again or contact support.",
  account_disabled: "This account has been disabled. Contact an administrator.",
  no_email: "Microsoft did not return an email address for this account.",
  db_error: "Database error during sign-in. Please try again.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md"><div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-gray-400">Loading...</div></div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 2FA second-step state — when login returns twoFactorRequired, swap
  // the form to a code-entry view.
  const [twoFactorPendingUserId, setTwoFactorPendingUserId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Surface SSO errors from ?error= query param
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(SSO_ERROR_MESSAGES[err] || "Sign-in failed. Please try again.");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        return;
      }

      // 2FA gate — server says we need a second factor before issuing
      // the session. Switch UI to code entry.
      if (data.twoFactorRequired && data.pendingUserId) {
        setTwoFactorPendingUserId(data.pendingUserId);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-login",
          pendingUserId: twoFactorPendingUserId,
          code: twoFactorCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code — try again");
        return;
      }
      if (data.backupUsed) {
        // Soft warning before dashboard — backup code burned
        alert("Backup code accepted. That code is now used and won't work again. Consider regenerating your backup codes from Settings.");
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        {twoFactorPendingUserId ? (
          <form onSubmit={handle2FA} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              <p className="font-medium">Two-factor authentication required</p>
              <p className="text-xs mt-1">Enter the 6-digit code from your authenticator app, or one of your backup codes.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="2fa" className="block text-sm font-medium text-gray-700">Authenticator code</label>
              <Input
                id="2fa"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="text-center tracking-[0.4em] text-lg"
                autoFocus
                required
              />
              <p className="text-[11px] text-gray-500">Or enter an 8-digit backup code (no spaces).</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !twoFactorCode}>
              {loading ? "Verifying…" : "Verify and sign in"}
            </Button>
            <button
              type="button"
              onClick={() => { setTwoFactorPendingUserId(null); setTwoFactorCode(""); setError(""); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to email + password
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me + Forgot password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
        )}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">or</span></div>
        </div>

        <a
          href="/api/auth/microsoft"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft
        </a>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
