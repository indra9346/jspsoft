import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, rawDb } from "@/lib/db";
import { COOKIE, readSession, signSession } from "@/lib/tenant";
import { assertFeature, isFeatureEnabled } from "@/lib/features-server";
import type { FeatureKey } from "@/lib/features";
import type { Role } from "@prisma/client";

export { COOKIE };

export async function createSession(userId: string, schoolId: string, role: Role) {
  const token = await signSession({ uid: userId, sid: schoolId, role });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Current signed-in user (with role profile), or null. The user must belong to the school in the token. */
export const getUser = cache(async () => {
  const s = await readSession();
  if (!s) return null;
  const user = await rawDb.user.findUnique({
    where: { id: s.uid },
    include: { staff: true, student: { include: { classRoom: true } } },
  });
  if (!user || !user.active || user.schoolId !== s.sid) return null;
  return user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

/** For pages: redirect to login if signed out, to the dashboard if the role / plan doesn't allow it. */
export async function requireUser(roles?: Role[], feature?: FeatureKey): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  if (feature && !(await isFeatureEnabled(feature))) redirect("/dashboard");
  return user;
}

/** For server actions: throws instead of redirecting. Also enforces the plan. */
export async function requireActionUser(roles?: Role[], feature?: FeatureKey): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new Error("Your session has expired. Please sign in again.");
  if (roles && !roles.includes(user.role)) throw new Error("You are not allowed to do this.");
  if (feature) await assertFeature(feature);
  return user;
}

export { db };
