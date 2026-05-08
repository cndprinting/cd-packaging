import { generateSecret, generateURI, NobleCryptoPlugin } from "otplib";
import { verifySync } from "@otplib/totp";

const crypto = new NobleCryptoPlugin();
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const ISSUER = "C&D Packaging Godzilla";

// otplib v13 exports functional helpers — generateSecret/verifySync/generateURI.
// Default 30s step, 6 digits, SHA1 — matches the standard TOTP spec used by
// Microsoft Authenticator / Google Authenticator / Authy / 1Password.
const STEP = 30;
const DIGITS = 6;
const ALGO = "sha1" as const;
// Allow ±1 step (30s drift either side) for clock skew

export function generateTotpSecret(): string {
  // Returns a base32 secret encoded for authenticator apps
  return generateSecret({ length: 20 });
}

export async function generateQrCodeDataUrl(secret: string, userEmail: string): Promise<string> {
  const otpauth = generateURI({
    label: userEmail,
    issuer: ISSUER,
    secret,
    algorithm: ALGO,
    digits: DIGITS,
    period: STEP,
  });
  return QRCode.toDataURL(otpauth, { errorCorrectionLevel: "M", margin: 2, scale: 6 });
}

/** Build the manual-entry secret display (groups of 4 chars). */
export function formatSecretForManualEntry(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function verifyTotpCode(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  try {
    const res = verifySync({
      token: normalized,
      secret,
      algorithm: ALGO,
      digits: DIGITS,
      period: STEP,
      epochTolerance: STEP, // ±30s = ±1 step for clock drift
      crypto,
    });
    return res.valid === true;
  } catch {
    return false;
  }
}

/** Generate 10 single-use 8-digit backup codes (returned plaintext + hashed). */
export async function generateBackupCodes(): Promise<{ plaintext: string[]; hashed: string[] }> {
  const plaintext: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < 10; i++) {
    // 8-digit random — easy to type, ~10^8 entropy good enough for one-shot use
    const code = String(parseInt(randomBytes(4).toString("hex"), 16) % 100000000).padStart(8, "0");
    plaintext.push(code);
    hashed.push(await bcrypt.hash(code, 8));
  }
  return { plaintext, hashed };
}

/** Verify a backup code; returns the index of the matched code (so caller can mark it used) or -1. */
export async function verifyBackupCode(code: string, hashedJson: string | null): Promise<number> {
  if (!hashedJson || !code) return -1;
  const normalized = code.replace(/[\s-]/g, "");
  if (!/^\d{8}$/.test(normalized)) return -1;
  let hashes: string[];
  try { hashes = JSON.parse(hashedJson); } catch { return -1; }
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i] && await bcrypt.compare(normalized, hashes[i])) return i;
  }
  return -1;
}
