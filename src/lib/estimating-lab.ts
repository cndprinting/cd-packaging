// Estimating lab switch (Benjy 11/17/26). Mary keeps quoting in E&M, and it is
// not certain she will move to Godzilla. Until estimating is ready, quoting is a
// separate project that only Benjy (owners) and estimating can see; CSRs,
// prepress, shipping and the rest of the plant never land in it.
// Set NEXT_PUBLIC_ESTIMATING_LAB=0 to open estimating to everyone again.
export const ESTIMATING_LAB = process.env.NEXT_PUBLIC_ESTIMATING_LAB !== "0";

// Who can still see and use estimating while the lab switch is on.
export const ESTIMATING_LAB_ROLES = ["OWNER", "ESTIMATOR"];

// Every page that belongs to estimating and quoting. FlexPack is an estimator.
export const ESTIMATING_PATHS = ["/dashboard/quote-requests", "/dashboard/quotes", "/dashboard/my-quotes", "/dashboard/flexpack"];

export function isEstimatingPath(pathname: string): boolean {
  return ESTIMATING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function canSeeEstimating(role?: string | null): boolean {
  if (!ESTIMATING_LAB) return true;
  return !!role && ESTIMATING_LAB_ROLES.includes(role);
}
