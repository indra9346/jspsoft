"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { ok, run, UserError, type ActionState } from "@/lib/action";

const entries = z.array(z.object({ id: z.string(), internal: z.number().nullable(), theory: z.number().nullable() }));

/**
 * Save internal + theory marks for one exam / class-section / subject.
 * Teachers may only save for a subject they are allocated to in that section.
 */
export async function saveMarksAction(
  examId: string,
  classId: string,
  subjectId: string,
  list: { id: string; internal: number | null; theory: number | null }[],
): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN", "TEACHER"], "marks");
    const rows = entries.parse(list);
    const [exam, alloc, cls] = await Promise.all([
      db.exam.findUnique({ where: { id: examId } }),
      db.allocation.findUnique({ where: { classId_subjectId: { classId, subjectId } } }),
      db.classRoom.findUnique({ where: { id: classId } }),
    ]);
    if (!exam) throw new UserError("Exam not found.");
    if (!alloc) throw new UserError("This subject is not allocated to the class.");
    if (!cls) throw new UserError("Class not found.");
    if (user.role === "TEACHER") {
      const isClassTeacher = cls.classTeacherId === user.staff?.id;
      const isAllocatedTeacher = alloc.teacherId === user.staff?.id;
      if (!isClassTeacher && !isAllocatedTeacher) {
        throw new UserError("You can only enter marks for the class, section and subject assigned to you.");
      }
    }

    for (const r of rows) {
      if ((r.internal === null) !== (r.theory === null)) throw new UserError("Enter both internal and theory marks for each student (or leave both blank).");
      if (r.internal !== null && (r.internal < 0 || r.internal > exam.maxInternal)) throw new UserError(`Internal marks must be between 0 and ${exam.maxInternal}.`);
      if (r.theory !== null && (r.theory < 0 || r.theory > exam.maxTheory)) throw new UserError(`Theory marks must be between 0 and ${exam.maxTheory}.`);
    }
    // only students of this section who are enrolled in this subject
    const enrolled = new Set(
      (await db.studentSubject.findMany({ where: { subjectId, student: { classId } }, select: { studentId: true } })).map((s) => s.studentId),
    );
    for (const r of rows) {
      if (!enrolled.has(r.id)) {
        throw new UserError("One or more students do not belong to this class section or are not enrolled in this subject.");
      }
    }
    const ops = rows.map((r) =>
      r.internal === null || r.theory === null
        ? db.mark.deleteMany({ where: { examId, studentId: r.id, subjectId } })
        : db.mark.upsert({
            where: { examId_studentId_subjectId: { examId, studentId: r.id, subjectId } },
            update: { internal: r.internal, theory: r.theory, enteredById: user.id },
            create: { schoolId: user.schoolId, examId, studentId: r.id, subjectId, internal: r.internal, theory: r.theory, enteredById: user.id },
          }),
    );
    await db.$transaction(ops);
    revalidatePath("/marks");
    revalidatePath("/results");
    revalidatePath("/dashboard");
    return ok("Marks saved. Students can see them in their portal now.");
  });
}
