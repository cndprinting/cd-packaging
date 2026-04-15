import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Estimating is Mary's domain — CSRs and sales reps shouldn't see raw cost
// calculations, markup, or press/paper pricing. They submit specs via
// /dashboard/quote-requests and Mary converts them into quotes. This guard
// blocks direct-URL navigation; the sidebar already hides the link for
// non-estimating roles.
const ALLOWED_ROLES = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ACCOUNTING",
]);

export default async function QuotesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!ALLOWED_ROLES.has(session.role)) {
    redirect("/dashboard/quote-requests");
  }
  return <>{children}</>;
}
