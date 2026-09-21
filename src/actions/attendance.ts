"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { teacherClassIds } from "@/lib/access";
import { ok, run, UserError, type ActionState } from "@/lib/action";
import { toDate, todayISO } from "@/lib/utils";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const studentEntries = z.array(z.object({ id: z.string(), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]) })).min(1, "Nothing to save.");
const staffEntries = z.array(z.object({ id: z.string(), status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]) })).min(1, "Nothing to save.");

export async function markStudentAttendanceAction(classId: string, date: string, list: { id: string; status: string }[]): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "attendance");
    const d = dateSchema.parse(date);
    const rows = studentEntries.parse(list);
    if (d > todayISO()) throw new UserError("You can't mark attendance for a future date.");
    if (user.role === "TEACHER" && !(await teacherClassIds(user.staff!.id)).includes(classId))
      throw new UserError("You can only mark attendance for your own classes.");
    const cls = await db.classRoom.findUnique({ where: { id: classId } });
    if (!cls) throw new UserError("Class not found.");

    const valid = new Set((await db.student.findMany({ where: { classId }, select: { id: true } })).map((s) => s.id));
    const day = toDate(d);
    await db.$transaction(
      rows.filter((r) => valid.has(r.id)).map((r) =>
        db.studentAttendance.upsert({
          where: { studentId_date: { studentId: r.id, date: day } },
          update: { status: r.status, classId, academicYearId: cls.academicYearId, markedById: user.id },
          create: { schoolId: user.schoolId, studentId: r.id, classId, academicYearId: cls.academicYearId, date: day, status: r.status, markedById: user.id },
        }),
      ),
    );
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return ok(`Attendance saved for ${rows.length} students.`);
  });
}

export async function markStaffAttendanceAction(date: string, list: { id: string; status: string }[]): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "teacher_attendance");
    const d = dateSchema.parse(date);
    const rows = staffEntries.parse(list);
    if (d > todayISO()) throw new UserError("You can't mark attendance for a future date.");
    const valid = new Set((await db.staff.findMany({ select: { id: true } })).map((s) => s.id));
    const day = toDate(d);
    await db.$transaction(
      rows.filter((r) => valid.has(r.id)).map((r) =>
        db.staffAttendance.upsert({
          where: { staffId_date: { staffId: r.id, date: day } },
          update: { status: r.status },
          create: { schoolId: user.schoolId, staffId: r.id, date: day, status: r.status },
        }),
      ),
    );
    revalidatePath("/attendance");
    return ok(`Staff attendance saved for ${rows.length} members.`);
  });
}
