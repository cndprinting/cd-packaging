// Field validation for lead entry (Shimmie 8/6, approved by Benjy).
//
// The point isn't format pedantry — it's that a phone number typed into the
// email field means the outbound agent silently never emails that lead, and
// nobody finds out. So the checks are deliberately narrow: catch the wrong
// KIND of value, and obvious typos, and otherwise get out of the rep's way.
//
// Shared by the client (inline red message) and the API (hard block on save),
// so the two can never disagree about what's acceptable.

export type FieldName = "contactEmail" | "contactEmail2" | "contactPhone" | "website";

const EMAIL_RE = /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i;
// 10 digits US, or 11 starting with 1. Extensions are common on B2B lines.
const DIGITS_ONLY = /^\+?1?\d{10}$/;

export function validateField(field: FieldName, raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null; // empty is always allowed — this is a prospect list, not a form

  if (field === "contactEmail" || field === "contactEmail2") {
    if (/^[\d\s()+.-]+$/.test(v)) return "That looks like a phone number — put it in the phone field.";
    if (!v.includes("@")) return "An email address needs an @.";
    if (!EMAIL_RE.test(v)) return "That doesn't look like a valid email address.";
    if (/\s/.test(v)) return "Email addresses can't contain spaces — one address per field.";
    return null;
  }

  if (field === "contactPhone") {
    if (v.includes("@")) return "That looks like an email — put it in the email field.";
    // Strip an extension before counting digits: "727-555-0100 x214" is fine.
    const core = v.split(/\s*(?:x|ext\.?|#)\s*/i)[0];
    const digits = core.replace(/\D/g, "");
    if (!digits) return "A phone number needs digits.";
    if (!DIGITS_ONLY.test(digits)) {
      return digits.length < 10 ? "That's too short for a phone number." : "That doesn't look like a valid phone number.";
    }
    return null;
  }

  if (field === "website") {
    if (v.includes("@") && !v.startsWith("http")) return "That looks like an email — the website field wants a domain.";
    if (/\s/.test(v)) return "A web address can't contain spaces.";
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withProto);
      // A real host needs a dot and a plausible TLD — "acme" isn't a site.
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return "That doesn't look like a real web address.";
    } catch { return "That doesn't look like a valid web address."; }
    return null;
  }

  return null;
}

// Typed straight from a business card, a website is almost always missing its
// scheme. Fix it on the way in rather than rejecting it.
export function normalizeField(field: FieldName, raw: string): string {
  const v = (raw || "").trim();
  if (!v) return v;
  if (field === "website" && !/^https?:\/\//i.test(v)) return `https://${v}`;
  if (field === "contactEmail" || field === "contactEmail2") return v.toLowerCase();
  return v;
}

export const VALIDATED_FIELDS: FieldName[] = ["contactEmail", "contactEmail2", "contactPhone", "website"];
