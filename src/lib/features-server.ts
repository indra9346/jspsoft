import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { isDefaultFeature, LOCKED, type FeatureKey, type LockedFeature } from "@/lib/features";

/** Add-ons unlocked for the current school (school_features table). */
export const getUnlockedAddons = cache(async (): Promise<Set<string>> => {
  const rows = await db.schoolFeature.findMany({ where: { enabled: true } });
  return new Set(rows.map((r) => r.featureKey));
});

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  if (isDefaultFeature(key)) return true;
  return (await getUnlockedAddons()).has(key);
}

export class FeatureLockedError extends Error {
  constructor(public feature: LockedFeature) {
    super(`${LOCKED[feature].title} is not active under your current plan. Contact Swan Digital Solutions to unlock it.`);
  }
}

/** Server-side gate for actions / route handlers. Throws for locked features. */
export async function assertFeature(key: FeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(key))) throw new FeatureLockedError(key as LockedFeature);
}
