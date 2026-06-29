// Known bad actors (Benjy 6/28). If an inbound lead matches, the agent refuses
// to engage — no customer email, no Mary handoff — and the owners get alerted.
// Matching is case-insensitive substring; add identifiers as you catch them.
// Email / domain / phone are far more reliable than name (scammers change names).

export const BLOCKLIST = {
  emails: [] as string[],     // full or partial email, e.g. "chris.taunt@gmail.com"
  domains: [] as string[],    // email domain, e.g. "scam-broker.com"
  names: ["chris taunt"],     // contact-name substring
  phones: [] as string[],     // any digits substring, e.g. "2125551234"
  companies: [] as string[],  // company-name substring
};

// Test traffic from our own agency (Habib) — silently ignored at intake: no
// lead created, no agent contact, no owner alert. NOT scammers, just tests.
export const TEST_SUBMISSIONS = {
  emails: ["sampleemail@hotmail.com", "habib@slashpie.com"],
  domains: ["slashpie.com"],
};

export function isTestSubmission(email?: string | null): boolean {
  const e = (email || "").toLowerCase();
  if (!e) return false;
  const domain = e.includes("@") ? e.split("@")[1] : "";
  if (TEST_SUBMISSIONS.emails.some((x) => x && e.includes(x.toLowerCase()))) return true;
  if (domain && TEST_SUBMISSIONS.domains.some((d) => d && domain.includes(d.toLowerCase()))) return true;
  return false;
}

// Returns a human-readable reason if blocked, else null.
export function checkBlocked(opts: { name?: string | null; email?: string | null; phone?: string | null; company?: string | null }): string | null {
  const name = (opts.name || "").toLowerCase();
  const email = (opts.email || "").toLowerCase();
  const phone = (opts.phone || "").replace(/\D/g, "");
  const company = (opts.company || "").toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : "";

  if (email && BLOCKLIST.emails.some((e) => e && email.includes(e.toLowerCase()))) return `blocked email (${opts.email})`;
  if (domain && BLOCKLIST.domains.some((d) => d && domain.includes(d.toLowerCase()))) return `blocked domain (${domain})`;
  if (name && BLOCKLIST.names.some((n) => n && name.includes(n.toLowerCase()))) return `blocked name (${opts.name})`;
  if (phone && BLOCKLIST.phones.some((p) => p && phone.includes(p.replace(/\D/g, "")))) return `blocked phone (${opts.phone})`;
  if (company && BLOCKLIST.companies.some((c) => c && company.includes(c.toLowerCase()))) return `blocked company (${opts.company})`;
  return null;
}
