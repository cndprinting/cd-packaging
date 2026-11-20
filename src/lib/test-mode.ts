// December test mode (Benjy 11/20/26). Everyone tries job tickets during December
// for a January 1 switchover, while Denise, Jennifer (accounting) and Shayla,
// Caden (shipping) are already live. Anything a tester creates is a TEST job, and
// TEST jobs can never reach live invoicing, Stripe, shipping, customer records,
// customers' inboxes, or the live team's inboxes.
//
// Jan 1: set JOBS_TEST_MODE=0 and new jobs are real again.

export const TEST_MODE_ON = process.env.JOBS_TEST_MODE !== "0";

/** Already live on Godzilla: never testers, never see TEST jobs, never get TEST email. */
export const LIVE_ROLES = ["ACCOUNTING", "SHIPPING"];

type S = { role?: string | null } | null | undefined;
type J = { isTest?: boolean | null; jobNumber?: string | null } | null | undefined;

export const isLiveUser = (s: S) => !!s?.role && LIVE_ROLES.includes(s.role);
/** Jobs (and new customers) this person creates are TEST ones. */
export const isTester = (s: S) => TEST_MODE_ON && !!s?.role && !LIVE_ROLES.includes(s.role) && !["CUSTOMER", "VENDOR"].includes(s.role);
/** QA- numbers are Claude's own test runs; isTest marks everything testers made. */
export const isTestJob = (j: J) => !!j && (!!j.isTest || /^QA-/i.test(j.jobNumber || ""));
/** Subject line for an email about a job: TEST jobs say so, and sendEmail enforces where they can go. */
export const tSubj = (j: J, subject: string) => (isTestJob(j) ? `${TEST_TAG} ${subject}` : subject);
export const TEST_TAG = "[TEST]";
export const isTestSubject = (subject: string | null | undefined) => String(subject || "").trimStart().startsWith(TEST_TAG);
export const TEST_FROM = "bwaxman@cndprinting.com";
export const internalOnly = (emails: string[]) => emails.every((e) => /@cndprinting\.com$/i.test(String(e).trim()));

/** Live team's addresses (looked up once per server instance). */
let liveCache: { at: number; emails: Set<string> } | null = null;
export async function liveTeamEmails(): Promise<Set<string>> {
  if (liveCache && Date.now() - liveCache.at < 10 * 60e3) return liveCache.emails;
  try {
    const prisma: any = (await import("@/lib/prisma")).default;
    const users = prisma ? await prisma.user.findMany({ where: { role: { in: LIVE_ROLES } }, select: { email: true } }) : [];
    liveCache = { at: Date.now(), emails: new Set(users.map((u: any) => String(u.email || "").toLowerCase()).filter(Boolean)) };
  } catch { liveCache = { at: Date.now(), emails: liveCache?.emails || new Set() }; }
  return liveCache.emails;
}
