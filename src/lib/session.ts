import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionUser } from "./auth";

const SESSION_COOKIE = "cd-pkg-session";
const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production");

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id, email: user.email, name: user.name,
    role: user.role, companyId: user.companyId, companyName: user.companyName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id as string, email: payload.email as string,
      name: payload.name as string, role: payload.role as SessionUser["role"],
      companyId: (payload.companyId as string) || null,
      companyName: (payload.companyName as string) || null,
    };
  } catch { return null; }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
