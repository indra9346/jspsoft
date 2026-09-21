"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { teacherClassIds } from "@/lib/access";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { toDate, todayISO } from "@/lib/utils";
import type { RemarkCategory } from "@prisma/client";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format");

const remarkSchema = z.object({
  category: z.enum([
    "ACADEMIC",
    "BEHAVIOUR",
    "PARTICIPATION",
    "ATTENDANCE",
    "ACTIVITIES",
    "STRENGTHS",
    "IMPROVEMENT",
    "PTM",
    "GENERAL",
  ]),
  remark: z.string().trim().min(3, "Please enter at least 3 characters for the remark.").max(1000, "Remark is too long (max 1000 characters)."),
  date: dateSchema,
});

/**
 * Save or update a remark for a student.
 * Admin: school-wide access.
 * Teacher: only for students in their assigned class/section (as Class Teacher or allocated teacher).
 */
export async function saveRemarkAction(
  studentId: string,
  remarkId: string | null,
  _: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "students");
    const d = parse(remarkSchema, fd);
    if (d.date > todayISO()) throw new UserError("Remarks cannot be set for a future date.");

    const targetStudentId = (fd.get("studentId") as string) || studentId;
    const student = await db.student.findUnique({
      where: { id: targetStudentId },
      include: { classRoom: true },
    });
    if (!student) throw new UserError("Student not found.");

    if (user.role === "TEACHER" && user.staff) {
      const allowedIds = await teacherClassIds(user.staff.id);
      const isClassTeacher = student.classRoom.classTeacherId === user.staff.id;
      if (!isClassTeacher && !allowedIds.includes(student.classId)) {
        throw new UserError("You can only enter remarks for students in your assigned class/section.");
      }
    }

    const day = toDate(d.date);

    if (remarkId) {
      const existing = await db.studentRemark.findUnique({ where: { id: remarkId } });
      if (!existing || existing.studentId !== targetStudentId) {
        throw new UserError("Remark record not found.");
      }
      if (user.role === "TEACHER" && existing.authorId !== user.id) {
        throw new UserError("You can only edit remarks you authored.");
      }
      await db.studentRemark.update({
        where: { id: remarkId },
        data: {
          category: d.category as RemarkCategory,
          remark: d.remark,
          date: day,
        },
      });
    } else {
      await db.studentRemark.create({
        data: {
          schoolId: user.schoolId,
          studentId: targetStudentId,
          classId: student.classId,
          academicYearId: student.academicYearId,
          authorId: user.id,
          category: d.category as RemarkCategory,
          remark: d.remark,
          date: day,
        },
      });
    }

    revalidatePath("/remarks");
    revalidatePath("/students");
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/dashboard");
    return ok(remarkId ? "Remark updated." : "Remark saved successfully.");
  });
}

/**
 * Delete a student remark.
 * Allowed for Admin or the authoring teacher.
 */
export async function deleteRemarkAction(remarkId: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "students");
    const existing = await db.studentRemark.findUnique({ where: { id: remarkId } });
    if (!existing) return ok("Remark was already removed.");

    if (user.role === "TEACHER" && existing.authorId !== user.id) {
      throw new UserError("You can only remove remarks that you created.");
    }

    await db.studentRemark.delete({ where: { id: remarkId } });

    revalidatePath("/remarks");
    revalidatePath("/students");
    revalidatePath(`/students/${existing.studentId}`);
    revalidatePath("/dashboard");
    return ok("Remark deleted.");
  });
}
