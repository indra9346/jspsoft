"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { teacherClassIds } from "@/lib/access";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { todayISO, toDate } from "@/lib/utils";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const many = z.union([z.string(), z.array(z.string())]).optional();

const schema = z.object({
  title: z.string().min(3, "Enter a title").max(120),
  body: z.string().min(5, "Write the announcement").max(3000),
  audience: z.enum(["ALL", "STUDENTS", "TEACHERS", "STAFF", "CLASSES", "SECTIONS"]),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
  publishDate: dateStr,
  expiryDate: dateStr.optional().or(z.literal("")),
  grades: many, // SPECIFIC CLASS: every section of these classes
  classIds: many, // SPECIFIC SECTION
});
const arr = (v: string | string[] | undefined) => (v ? (Array.isArray(v) ? v : [v]) : []);

export async function createAnnouncementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "announcements");
    const d = parse(schema, fd);
    if (d.expiryDate && d.expiryDate < d.publishDate) throw new UserError("The expiry date can't be before the date of publishing.");
    if (user.role === "TEACHER" && d.audience !== "CLASSES" && d.audience !== "SECTIONS")
      throw new UserError("Teachers can send announcements to their own classes / sections only.");

    let targetIds: string[] = [];
    if (d.audience === "CLASSES" || d.audience === "SECTIONS") {
      const year = await db.academicYear.findFirst({ where: { isCurrent: true } });
      const all = await db.classRoom.findMany({ where: year ? { academicYearId: year.id } : {} });
      if (d.audience === "CLASSES") {
        const grades = new Set(arr(d.grades));
        targetIds = all.filter((c) => grades.has(c.grade)).map((c) => c.id);
        if (!grades.size) throw new UserError("Select at least one class.");
      } else {
        const chosen = new Set(arr(d.classIds));
        targetIds = all.filter((c) => chosen.has(c.id)).map((c) => c.id);
        if (!chosen.size) throw new UserError("Select at least one section.");
      }
      if (user.role === "TEACHER") {
        const mine = new Set(await teacherClassIds(user.staff!.id));
        targetIds = targetIds.filter((id) => mine.has(id));
      }
      if (!targetIds.length) throw new UserError("No matching classes / sections you are allowed to target.");
    }
    // A repeated identical submit (double click / retry) must not create a second announcement.
    const dup = await db.announcement.findFirst({ where: { authorId: user.id, title: d.title, body: d.body, audience: d.audience, createdAt: { gte: new Date(Date.now() - 15000) } } });
    if (dup) return ok("Announcement published.");
    await db.announcement.create({
      data: {
        schoolId: user.schoolId, title: d.title, body: d.body, audience: d.audience, priority: d.priority,
        publishDate: toDate(d.publishDate), expiryDate: d.expiryDate ? toDate(d.expiryDate) : null, authorId: user.id,
        targets: targetIds.length ? { create: targetIds.map((classId) => ({ schoolId: user.schoolId, classId })) } : undefined,
      },
    });
    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return ok(d.publishDate > todayISO() ? "Announcement scheduled." : "Announcement published.");
  });
}

export async function deleteAnnouncementAction(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "announcements");
    const a = await db.announcement.findUnique({ where: { id } });
    if (!a) throw new UserError("Announcement not found.");
    if (user.role === "TEACHER" && a.authorId !== user.id) throw new UserError("You can only delete your own announcements.");
    await db.announcement.delete({ where: { id } });
    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return ok("Announcement deleted.");
  });
}
