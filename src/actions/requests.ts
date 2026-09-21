"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { LOCKED } from "@/lib/features";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";

const schema = z.object({
  feature: z.string().refine((f) => f in LOCKED, "Choose the feature you want to unlock"),
  administratorName: z.string().min(2, "Enter the administrator's name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone number"),
  message: z.string().max(1000).default(""),
});

export async function requestUnlockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"]);
    const d = parse(schema, fd);
    const open = await db.featureUnlockRequest.count({ where: { requestedFeature: d.feature, status: { in: ["PENDING", "CONTACTED"] } } });
    if (open) throw new UserError("A request for this feature is already open. Swan Digital Solutions will contact you.");
    await db.featureUnlockRequest.create({
      data: {
        schoolId: user.schoolId, requestedFeature: d.feature, requestedBy: user.id, administratorName: d.administratorName,
        email: d.email, phone: d.phone, message: d.message,
      },
    });
    revalidatePath("/swan-digital");
    return ok("Your request has been submitted to Swan Digital Solutions. Please contact Swan Digital Solutions for activation and subscription details — https://swandigitalsolutions.com");
  });
}
