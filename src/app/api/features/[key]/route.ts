import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isLockedKey, LOCKED } from "@/lib/features";
import { isFeatureEnabled } from "@/lib/features-server";

/**
 * Backend gate for add-on features. Every method on a locked feature is refused with 403 —
 * the lock is enforced on the server, not only hidden in the UI. (Unlocked features are
 * implemented per school by Swan Digital Solutions; until then the module answers 501.)
 */
async function handle(_: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!(await getUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLockedKey(key)) return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  if (!(await isFeatureEnabled(key))) {
    return NextResponse.json(
      { error: "FEATURE_LOCKED", message: `${LOCKED[key].title} is not active under your current plan. Contact Swan Digital Solutions to unlock it.` },
      { status: 403 },
    );
  }
  return NextResponse.json({ error: "NOT_CONFIGURED", message: "This module is unlocked but not configured yet." }, { status: 501 });
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
