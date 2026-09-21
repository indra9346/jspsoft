import "server-only";
import { db } from "@/lib/db";

/** Enrol a student in every subject allocated to their class (and drop subjects no longer allocated). */
export async function syncStudentSubjects(studentId: string, classId: string, schoolId: string) {
  const [allocs, current] = await Promise.all([
    db.allocation.findMany({ where: { classId }, select: { subjectId: true } }),
    db.studentSubject.findMany({ where: { studentId }, select: { subjectId: true } }),
  ]);
  const want = new Set(allocs.map((a) => a.subjectId));
  const have = new Set(current.map((c) => c.subjectId));
  const add = [...want].filter((s) => !have.has(s));
  const drop = [...have].filter((s) => !want.has(s));
  if (add.length) await db.studentSubject.createMany({ data: add.map((subjectId) => ({ schoolId, studentId, subjectId })), skipDuplicates: true });
  if (drop.length) await db.studentSubject.deleteMany({ where: { studentId, subjectId: { in: drop } } });
}
