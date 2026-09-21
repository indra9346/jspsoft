"use server";

import { requireActionUser } from "@/lib/auth";
import { fail, run, UserError, type ActionState } from "@/lib/action";
import { isLockedKey } from "@/lib/features";
import { assertFeature } from "@/lib/features-server";

/**
 * Backend entry points for add-on modules. While a feature is locked every one of them is refused by
 * assertFeature() (FeatureLockedError → "not active under your current plan"). When Swan Digital Solutions
 * unlocks a school they answer "not configured" until the real module is implemented for that school.
 */
export async function lockedFeatureAction(feature: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"]);
    if (!isLockedKey(feature)) throw new UserError("Unknown feature.");
    await assertFeature(feature);
    return fail("This module is unlocked but not configured yet. Contact Swan Digital Solutions.");
  });
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function saveNonTeachingStaffAction(_id: string | null, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "non_teaching_staff");
    return fail("Non-teaching staff is unlocked but not configured yet. Contact Swan Digital Solutions.");
  });
}

export async function deleteNonTeachingStaffAction(_id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "non_teaching_staff");
    return fail("Non-teaching staff is unlocked but not configured yet. Contact Swan Digital Solutions.");
  });
}
