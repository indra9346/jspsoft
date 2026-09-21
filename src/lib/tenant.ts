import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@prisma/client";

export const COOKIE = "swan_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");

export interface SessionClaims {
  uid: string;
  sid: string; // school id
  role: Role;
}

export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ role: c.role, sid: c.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.uid)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function readSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.sid !== "string") return null;
    return { uid: payload.sub, sid: payload.sid, role: payload.role as Role };
  } catch {
    return null;
  }
}

/** The school the current request belongs to. Fails closed when there is no session. */
export async function getTenantId(): Promise<string> {
  const s = await readSession();
  if (!s) throw new Error("No school context: please sign in again.");
  return s.sid;
}
