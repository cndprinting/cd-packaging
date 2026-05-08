"use client";

import { useState, useEffect } from "react";
import { Shield, Smartphone, Loader2, Check, AlertTriangle, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "status" | "setup" | "confirm" | "enabled";

export default function SecurityPage() {
  const [step, setStep] = useState<Step>("status");
  const [enabled, setEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState<string | null>(null);
  const [unusedBackupCodes, setUnusedBackupCodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Setup state
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [code, setCode] = useState("");

  // Backup codes (shown after enroll or regenerate)
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable flow
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      const d = await res.json();
      if (res.ok) {
        setEnabled(!!d.enabled);
        setEnabledAt(d.enabledAt || null);
        setUnusedBackupCodes(d.unusedBackupCodes || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function startSetup() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Setup failed"); return; }
      setQrDataUrl(d.qrDataUrl);
      setManualSecret(d.manualEntry);
      setStep("setup");
    } catch { setError("Setup failed — try again"); }
    setBusy(false);
  }

  async function confirmCode() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Code didn't match"); setBusy(false); return; }
      setBackupCodes(d.backupCodes || []);
      setStep("enabled");
      setEnabled(true);
      setCode("");
    } catch { setError("Verification failed"); }
    setBusy(false);
  }

  async function disable2FA() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", password: disablePassword, code: disableCode }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Disable failed"); setBusy(false); return; }
      setEnabled(false);
      setShowDisable(false);
      setDisablePassword(""); setDisableCode("");
      setStep("status");
      await loadStatus();
    } catch { setError("Disable failed"); }
    setBusy(false);
  }

  async function regenerateBackup() {
    const c = prompt("Enter your current 6-digit code to regenerate backup codes:");
    if (!c) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate-backup-codes", code: c }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Regenerate failed"); setBusy(false); return; }
      setBackupCodes(d.backupCodes || []);
      setUnusedBackupCodes(d.backupCodes?.length || 0);
    } catch { setError("Regenerate failed"); }
    setBusy(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security</h1>
          <p className="text-sm text-gray-500">Two-factor authentication and account safety</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Two-Factor Authentication (TOTP)</CardTitle>
          <CardDescription>
            Adds a 6-digit code from an authenticator app (Microsoft Authenticator, Google Authenticator, Authy, 1Password) on every password login.
            Microsoft SSO logins inherit MFA from your M365 account separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ─── Status: enabled ─── */}
          {enabled && step !== "enabled" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800 font-medium">
                <Check className="h-5 w-5" /> 2FA is enabled
              </div>
              <p className="text-sm text-emerald-700 mt-1">
                Enabled {enabledAt ? new Date(enabledAt).toLocaleString() : ""} · {unusedBackupCodes} backup code{unusedBackupCodes !== 1 ? "s" : ""} remaining
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={regenerateBackup} disabled={busy}>Regenerate backup codes</Button>
                <Button variant="outline" size="sm" className="text-red-600" onClick={() => setShowDisable(!showDisable)}>Disable 2FA</Button>
              </div>
              {showDisable && (
                <div className="mt-4 space-y-2 border-t border-emerald-200 pt-4">
                  <p className="text-xs text-gray-600">Confirm your password and a current 2FA code to disable:</p>
                  <Input type="password" placeholder="Password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
                  <Input type="text" inputMode="numeric" placeholder="6-digit code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
                  <Button variant="outline" size="sm" className="text-red-600" onClick={disable2FA} disabled={busy || !disablePassword || !disableCode}>Confirm disable</Button>
                </div>
              )}
            </div>
          )}

          {/* ─── Status: not enabled ─── */}
          {!enabled && step === "status" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <AlertTriangle className="h-5 w-5" /> 2FA is NOT enabled
              </div>
              <p className="text-sm text-amber-800 mt-1">Strongly recommended after recent C&amp;D security incidents.</p>
              <Button onClick={startSetup} disabled={busy} className="mt-3">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting…</> : "Enable 2FA"}
              </Button>
            </div>
          )}

          {/* ─── Setup: scan QR + enter first code ─── */}
          {step === "setup" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">1. Scan this QR code with your authenticator app</p>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="2FA QR code" className="border border-gray-200 rounded-lg" style={{ width: 220, height: 220 }} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Or enter this secret manually:</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-gray-100 px-3 py-2 rounded font-mono select-all">{manualSecret}</code>
                  <button onClick={() => navigator.clipboard?.writeText(manualSecret.replace(/\s/g, ""))} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">2. Enter the 6-digit code from your app:</p>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="123 456"
                  className="max-w-[200px] text-lg tracking-widest text-center"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={confirmCode} disabled={busy || !code}>{busy ? "Verifying…" : "Verify and enable"}</Button>
                <Button variant="outline" onClick={() => { setStep("status"); setCode(""); setError(""); }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ─── Just enabled — show backup codes ─── */}
          {step === "enabled" && backupCodes.length > 0 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-emerald-800">
                <Check className="h-5 w-5" /> <span className="font-medium">2FA enabled successfully.</span>
              </div>
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900 mb-2">⚠ Save these backup codes NOW</p>
                <p className="text-xs text-amber-800 mb-3">
                  Each can be used once if you lose access to your authenticator app. Store them somewhere safe (password manager / secure notes).
                  This list won&apos;t be shown again — though you can regenerate from this page.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white border border-amber-200 rounded p-3">
                  {backupCodes.map((bc, i) => (
                    <div key={i} className="select-all">{bc.match(/.{1,4}/g)?.join("-")}</div>
                  ))}
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(backupCodes.join("\n"))}
                  className="text-xs text-brand-600 hover:underline mt-3 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy all to clipboard
                </button>
              </div>
              <Button onClick={() => { setBackupCodes([]); setStep("status"); }}>I&apos;ve saved my codes</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Microsoft 365 SSO</CardTitle>
          <CardDescription>If you sign in via the &quot;Sign in with Microsoft&quot; button, MFA is enforced by C&amp;D&apos;s M365 admin (Conditional Access). The TOTP step above is only required for password-based logins.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
