import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Security lock-down (11/22/26). Until now about 17 read routes (customers and their contacts,
 * quotes with prices, orders, jobs, dies, plant cost rates, search) answered anyone on the
 * internet with no login. Every one of those now starts with one of these checks.
 *
 * Staff = any signed-in user who is not a customer and not a vendor.
 */
export async function staffSession() {
  const s = await getSession();
  return s && s.role !== "CUSTOMER" && s.role !== "VENDOR" ? s : null;
}

/** The standard "you are not signed in (or not allowed)" answer. */
export function denied() {
  return NextResponse.json({ error: "Sign in required" }, { status: 401 });
}
