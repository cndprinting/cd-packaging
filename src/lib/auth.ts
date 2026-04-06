import { compare, hash } from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "PRODUCTION_MANAGER" | "CSR" | "SALES_REP" | "CUSTOMER";
  companyId: string | null;
  companyName: string | null;
}
