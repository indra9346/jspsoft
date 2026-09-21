"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rawDb } from "@/lib/db";
import { requireActionUser } from "@/lib/auth";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { luminance } from "@/lib/utils";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid colour");
const MAX_IMG = 400 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

async function readImage(file: FormDataEntryValue | null, label: string): Promise<string | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (!TYPES.includes(file.type)) throw new UserError(`${label} must be a PNG, JPG, WebP or SVG image.`);
  if (file.size > MAX_IMG) throw new UserError(`${label} must be smaller than 400 KB.`);
  return `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
}

export async function saveBrandingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "branding");
    const d = parse(
      z.object({
        name: z.string().min(2, "Enter the school name").max(60),
        tagline: z.string().max(120).default(""),
        primaryColor: hex,
        secondaryColor: hex,
        address: z.string().max(200).default(""),
        phone: z.string().max(30).default(""),
        email: z.string().max(80).default(""),
        website: z.string().max(120).default(""),
        principalName: z.string().max(80).default(""),
      }),
      fd,
    );
    for (const c of [d.primaryColor, d.secondaryColor]) {
      if (luminance(c) < 0.06) throw new UserError("That colour is too dark. Please pick a brighter, more colourful shade.");
    }
    const data: Record<string, unknown> = { ...d };
    const logo = await readImage(fd.get("logo"), "Logo");
    const sign = await readImage(fd.get("signature"), "Signature");
    if (logo) data.logoData = logo;
    else if (fd.get("resetLogo") === "1") data.logoData = null;
    if (sign) data.signatureData = sign;
    else if (fd.get("resetSignature") === "1") data.signatureData = null;

    await rawDb.school.update({ where: { id: user.schoolId }, data });
    revalidatePath("/", "layout");
    return ok("Branding saved. Your school's new look is live.");
  });
}
