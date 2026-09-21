"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { toDate } from "@/lib/utils";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

/* -------------------------------------------------------- academic years */
export async function saveAcademicYearAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "classes");
    const d = parse(z.object({ name: z.string().regex(/^\d{4}-\d{4}$/, "Use the format 2026-2027"), startDate: dateStr, endDate: dateStr, isCurrent: z.string().optional() }), fd);
    if (d.endDate <= d.startDate) throw new UserError("The end date must be after the start date.");
    const makeCurrent = d.isCurrent === "on";
    const created = await db.academicYear.create({ data: { schoolId: user.schoolId, name: d.name, startDate: toDate(d.startDate), endDate: toDate(d.endDate), isCurrent: false } });
    if (makeCurrent) {
      await db.academicYear.updateMany({ data: { isCurrent: false } });
      await db.academicYear.update({ where: { id: created.id }, data: { isCurrent: true } });
    }
    revalidatePath("/classes");
    return ok("Academic year created.");
  });
}

export async function setCurrentYearAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "classes");
    const y = await db.academicYear.findUnique({ where: { id } });
    if (!y) throw new UserError("Academic year not found.");
    await db.academicYear.updateMany({ data: { isCurrent: false } });
    await db.academicYear.update({ where: { id }, data: { isCurrent: true } });
    revalidatePath("/", "layout");
    return ok(`${y.name} is now the current academic year.`);
  });
}

export async function deleteAcademicYearAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "classes");
    const y = await db.academicYear.findUnique({ where: { id }, include: { _count: { select: { classes: true, students: true, exams: true } } } });
    if (!y) throw new UserError("Academic year not found.");
    if (y.isCurrent) throw new UserError("You can't delete the current academic year.");
    if (y._count.classes || y._count.students || y._count.exams) throw new UserError("This year still has classes, students or exams.");
    await db.academicYear.delete({ where: { id } });
    revalidatePath("/classes");
    return ok("Academic year deleted.");
  });
}

/* --------------------------------------------------------------- classes */
/** Create a class (e.g. "Class 10") with several sections at once ("A, B, C"). */
export async function createClassAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "classes");
    const d = parse(z.object({ academicYearId: z.string().min(1, "Choose an academic year"), grade: z.string().min(1, "Enter the class name").max(20), sections: z.string().min(1, "Enter at least one section") }), fd);
    if (!(await db.academicYear.findUnique({ where: { id: d.academicYearId } }))) throw new UserError("Academic year not found.");
    const sections = [...new Set(d.sections.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (!sections.length || sections.some((s) => s.length > 3)) throw new UserError("Sections must be short names like A, B, C.");
    const existing = await db.classRoom.findMany({ where: { academicYearId: d.academicYearId, grade: d.grade, section: { in: sections } } });
    if (existing.length) throw new UserError(`${d.grade} section ${existing.map((e) => e.section).join(", ")} already exists in this year.`);
    await db.classRoom.createMany({ data: sections.map((section) => ({ schoolId: user.schoolId, academicYearId: d.academicYearId, grade: d.grade, section })) });
    revalidatePath("/classes");
    return ok(`Created ${d.grade} — section${sections.length > 1 ? "s" : ""} ${sections.join(", ")}.`);
  });
}

export async function saveClassAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "classes");
    const d = parse(z.object({ grade: z.string().min(1).max(20), section: z.string().min(1).max(3), classTeacherId: z.string().optional() }), fd);
    await db.classRoom.update({ where: { id }, data: { grade: d.grade, section: d.section.toUpperCase(), classTeacherId: d.classTeacherId || null } });
    revalidatePath("/classes");
    return ok("Class updated.");
  });
}

export async function deleteClassAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "classes");
    const n = await db.student.count({ where: { classId: id } });
    if (n) throw new UserError(`This section still has ${n} student(s). Move or remove them first.`);
    await db.classRoom.delete({ where: { id } });
    revalidatePath("/classes");
    return ok("Class section deleted.");
  });
}

/* -------------------------------------------------------------- subjects */
const subjectSchema = z.object({
  name: z.string().min(2, "Enter the subject name"),
  code: z.string().min(2, "Enter a short code").max(8).transform((s) => s.toUpperCase()),
});

export async function saveSubjectAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "subjects");
    const d = parse(subjectSchema, fd);
    if (id) await db.subject.update({ where: { id }, data: d });
    else await db.subject.create({ data: { ...d, schoolId: user.schoolId } });
    revalidatePath("/subjects");
    return ok(id ? "Subject updated." : "Subject added.");
  });
}

export async function deleteSubjectAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "subjects");
    await db.subject.delete({ where: { id } });
    revalidatePath("/subjects");
    return ok("Subject deleted.");
  });
}

/* ------------------------------------------------- teacher allocation */
export async function saveAllocationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "allocation");
    const d = parse(z.object({ classId: z.string().min(1, "Choose a class"), subjectId: z.string().min(1, "Choose a subject"), teacherId: z.string().min(1, "Choose a teacher") }), fd);
    const [cls, subj, teacher] = await Promise.all([
      db.classRoom.findUnique({ where: { id: d.classId } }),
      db.subject.findUnique({ where: { id: d.subjectId } }),
      db.staff.findUnique({ where: { id: d.teacherId } }),
    ]);
    if (!cls || !subj || !teacher) throw new UserError("Class, subject or teacher not found.");
    if (teacher.staffType !== "TEACHING") throw new UserError("Only teaching staff can be allocated to subjects.");
    const existed = await db.allocation.findUnique({ where: { classId_subjectId: { classId: d.classId, subjectId: d.subjectId } } });
    await db.allocation.upsert({
      where: { classId_subjectId: { classId: d.classId, subjectId: d.subjectId } },
      update: { teacherId: d.teacherId },
      create: { ...d, schoolId: user.schoolId },
    });
    await db.timetableSlot.updateMany({ where: { classId: d.classId, subjectId: d.subjectId }, data: { teacherId: d.teacherId } });
    if (!existed) {
      const students = await db.student.findMany({ where: { classId: d.classId }, select: { id: true } });
      await db.studentSubject.createMany({ data: students.map((s) => ({ schoolId: user.schoolId, studentId: s.id, subjectId: d.subjectId })), skipDuplicates: true });
    }
    revalidatePath("/allocations");
    revalidatePath("/timetable");
    return ok("Allocation saved.");
  });
}

export async function deleteAllocationAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "allocation");
    const a = await db.allocation.findUnique({ where: { id } });
    if (!a) throw new UserError("Allocation not found.");
    await db.timetableSlot.deleteMany({ where: { classId: a.classId, subjectId: a.subjectId } });
    await db.studentSubject.deleteMany({ where: { subjectId: a.subjectId, student: { classId: a.classId } } });
    await db.allocation.delete({ where: { id } });
    revalidatePath("/allocations");
    revalidatePath("/timetable");
    return ok("Allocation removed.");
  });
}

/** Admin can exclude/include a single subject for one student (elective handling). */
export async function toggleStudentSubjectAction(studentId: string, subjectId: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "students");
    const s = await db.student.findUnique({ where: { id: studentId } });
    if (!s) throw new UserError("Student not found.");
    const alloc = await db.allocation.findUnique({ where: { classId_subjectId: { classId: s.classId, subjectId } } });
    if (!alloc) throw new UserError("That subject is not offered in the student's class.");
    const has = await db.studentSubject.findUnique({ where: { studentId_subjectId: { studentId, subjectId } } });
    if (has) await db.studentSubject.delete({ where: { id: has.id } });
    else await db.studentSubject.create({ data: { schoolId: user.schoolId, studentId, subjectId } });
    revalidatePath(`/students/${studentId}`);
    return ok(has ? "Subject removed from student." : "Subject assigned to student.");
  });
}

/* ----------------------------------------------------------------- exams */
export async function saveExamAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "marks");
    const d = parse(
      z.object({
        name: z.string().min(2, "Enter the exam name"),
        startDate: dateStr,
        academicYearId: z.string().min(1, "Choose an academic year"),
        maxInternal: z.coerce.number().int().min(0).max(500),
        maxTheory: z.coerce.number().int().min(1, "Theory maximum must be at least 1").max(500),
      }),
      fd,
    );
    if (!(await db.academicYear.findUnique({ where: { id: d.academicYearId } }))) throw new UserError("Academic year not found.");
    const data = { name: d.name, startDate: toDate(d.startDate), academicYearId: d.academicYearId, maxInternal: d.maxInternal, maxTheory: d.maxTheory };
    if (id) {
      const hasMarks = await db.mark.count({ where: { examId: id } });
      const cur = await db.exam.findUnique({ where: { id } });
      if (hasMarks && cur && (cur.maxInternal !== d.maxInternal || cur.maxTheory !== d.maxTheory))
        throw new UserError("Marks are already entered — the maximum marks can't be changed now.");
      await db.exam.update({ where: { id }, data });
    } else await db.exam.create({ data: { ...data, schoolId: user.schoolId } });
    revalidatePath("/marks");
    revalidatePath("/results");
    return ok(id ? "Exam updated." : "Exam created.");
  });
}

export async function deleteExamAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "marks");
    await db.exam.delete({ where: { id } });
    revalidatePath("/marks");
    revalidatePath("/results");
    return ok("Exam and its marks deleted.");
  });
}
