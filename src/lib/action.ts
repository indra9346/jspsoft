import "server-only";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { z } from "zod";
import { FeatureLockedError } from "@/lib/features-server";

export type ActionState = { ok: boolean; message: string } | null;

export const ok = (message = "Saved successfully."): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

/** Wraps an action body so thrown errors become friendly form messages. */
export async function run(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof UserError || e instanceof FeatureLockedError) return fail((e as Error).message);
    if ((e as { name?: string }).name === "ZodError") return fail("Some of the submitted values are invalid. Please check and try again.");
    const err = e as { code?: string; message?: string; meta?: { target?: string[] | string } };
    if (err.code === "P2002") {
      const t = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : (err.meta?.target ?? "value");
      return fail(`That ${t} is already in use.`);
    }
    if (err.code === "P2025") return fail("That record was not found.");
    if (err.code === "P2003") return fail("This record is still in use elsewhere and can't be removed.");
    if (err.message?.includes("session has expired") || err.message?.includes("not allowed")) return fail(err.message);
    console.error(e);
    return fail("Something went wrong. Please try again.");
  }
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Parse a FormData with a zod schema; throws a UserError with the first problem. */
export function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    const all = fd.getAll(key).map((v) => (typeof v === "string" ? v.trim() : v));
    raw[key] = all.length > 1 ? all : all[0];
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new UserError(r.error.issues[0]?.message ?? "Please check the form.");
  return r.data;
}
