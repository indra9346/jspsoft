"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { DAYS } from "@/lib/utils";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format HH:MM");

const TT_MSG = {
  teacherBusy: "Teacher is already teaching another class during this time.",
  classBusy: "This class already has period scheduled during this time.",
  badTime: "The end time must be later than the start time.",
  duplicate: "This timetable entry already exists.",
} as const;

/**
 * Create or update one timetable entry. ADMIN can schedule any allocated subject;
 * TEACHER can only schedule the subjects they teach in that class.
 */
export async function saveSlotAction(
  classId: string,
  day: number,
  period: number,
  prevOrSlotId: ActionState | string | null,
  fd: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "timetable");
    const d = parse(
      z.object({
        day: z.coerce.number().int().refine((n) => DAYS.some((x) => x.n === n), "Choose a day").optional(),
        period: z.coerce.number().int().min(1, "Choose a period").max(12, "Choose a period").optional(),
        subjectId: z.string().min(1, "Choose a subject"),
        teacherId: z.string().optional(),
        startTime: time,
        endTime: time,
        room: z.string().max(20).optional(),
      }),
      fd,
    );

    const slotDay = d.day ?? day;
    const slotPeriod = d.period ?? period;

    if (d.endTime <= d.startTime) throw new UserError(TT_MSG.badTime);

    const [cls, existing, alloc] = await Promise.all([
      db.classRoom.findUnique({ where: { id: classId } }),
      db.timetableSlot.findUnique({ where: { classId_day_period: { classId, day: slotDay, period: slotPeriod } } }),
      db.allocation.findUnique({ where: { classId_subjectId: { classId, subjectId: d.subjectId } }, include: { teacher: { include: { user: true } } } }),
    ]);

    if (!cls) throw new UserError("Class not found.");
    if (!alloc) throw new UserError("This subject is not allocated to the class yet. Allocate a teacher first.");

    const teacherId = d.teacherId || alloc.teacherId;
    if (user.role === "TEACHER") {
      if (alloc.teacherId !== user.staff!.id) {
        throw new UserError("You can only schedule subjects you teach.");
      }
    }

    const teacher = await db.staff.findUnique({ where: { id: teacherId }, include: { user: true } });
    if (!teacher || teacher.staffType !== "TEACHING" || !teacher.user.active) throw new UserError("Choose an active teacher.");

    const self = existing ? { NOT: { id: existing.id } } : {};

    // 1. class / section: same period taken, or any overlapping time on that day
    const classClash = await db.timetableSlot.findFirst({
      where: {
        classId,
        day: slotDay,
        ...self,
        OR: [{ period: slotPeriod }, { startTime: { lt: d.endTime }, endTime: { gt: d.startTime } }],
      },
    });
    if (classClash) throw new UserError(TT_MSG.classBusy);

    // 2. teacher: overlapping time in ANY class of the school
    const teacherClash = await db.timetableSlot.findFirst({
      where: { teacherId, day: slotDay, ...self, startTime: { lt: d.endTime }, endTime: { gt: d.startTime } },
    });
    if (teacherClash) throw new UserError(TT_MSG.teacherBusy);

    // 3. exact duplicate somewhere else in this class
    const dup = await db.timetableSlot.findFirst({
      where: { classId, day: slotDay, subjectId: d.subjectId, teacherId, startTime: d.startTime, endTime: d.endTime, ...self },
    });
    if (dup) throw new UserError(TT_MSG.duplicate);

    const data = {
      day: slotDay,
      period: slotPeriod,
      subjectId: d.subjectId,
      teacherId,
      startTime: d.startTime,
      endTime: d.endTime,
      room: d.room || null,
    };

    if (existing) {
      await db.timetableSlot.update({ where: { id: existing.id }, data });
    } else {
      await db.timetableSlot.create({ data: { schoolId: user.schoolId, classId, ...data } });
    }

    revalidatePath("/timetable");
    revalidatePath("/dashboard");
    return ok(existing ? "Timetable entry updated." : "Timetable entry saved.");
  });
}

/** Clear one period slot by classId, day and period. */
export async function clearSlotAction(classId: string, day: number, period: number): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "timetable");
    const slot = await db.timetableSlot.findUnique({ where: { classId_day_period: { classId, day, period } } });
    if (!slot) return ok("This period was already clear.");
    if (user.role === "TEACHER" && slot.teacherId !== user.staff?.id) {
      throw new UserError("You can only clear your own periods.");
    }
    await db.timetableSlot.delete({ where: { id: slot.id } });
    revalidatePath("/timetable");
    revalidatePath("/dashboard");
    return ok("Timetable entry deleted.");
  });
}

/** Delete one entry by slotId. */
export async function deleteSlotAction(slotId: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "timetable");
    const slot = await db.timetableSlot.findUnique({ where: { id: slotId } });
    if (!slot) return ok("This entry was already removed.");
    await db.timetableSlot.deleteMany({ where: { id: slotId } });
    revalidatePath("/timetable");
    revalidatePath("/dashboard");
    return ok("Timetable entry deleted.");
  });
}
