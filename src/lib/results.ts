import "server-only";
import { db } from "@/lib/db";
import { examMax, gradeFor, PASS_PERCENT } from "@/lib/utils";

export interface SubjectMark {
  internal: number;
  theory: number;
  total: number;
}

export interface ResultRow {
  studentId: string;
  name: string;
  rollNo: number;
  admissionNo: string;
  marks: Record<string, SubjectMark | undefined>;
  total: number;
  outOf: number;
  percent: number;
  grade: string;
  gradeColor: string;
  pass: boolean;
  rank: number | null;
}

/**
 * Subject-wise results for one exam and one class-section, with total, percentage,
 * grade, pass/fail and rank. Only subjects the student is enrolled in are counted.
 */
export async function examResults(examId: string, classId: string) {
  const [exam, students, allocations] = await Promise.all([
    db.exam.findUnique({ where: { id: examId } }),
    db.student.findMany({ where: { classId }, include: { user: true, subjects: true }, orderBy: { rollNo: "asc" } }),
    db.allocation.findMany({ where: { classId }, include: { subject: true }, orderBy: { subject: { name: "asc" } } }),
  ]);
  if (!exam) return null;
  const subjects = allocations.map((a) => a.subject);
  const marks = await db.mark.findMany({
    where: { examId, studentId: { in: students.map((s) => s.id) }, subjectId: { in: subjects.map((s) => s.id) } },
  });
  const perSubject = examMax(exam);

  const rows: ResultRow[] = students.map((s) => {
    const own: Record<string, SubjectMark | undefined> = {};
    for (const m of marks) if (m.studentId === s.id) own[m.subjectId] = { internal: m.internal, theory: m.theory, total: m.internal + m.theory };
    const entered = Object.values(own).filter((v): v is SubjectMark => v !== undefined);
    const total = entered.reduce((a, b) => a + b.total, 0);
    const outOf = entered.length * perSubject;
    const percent = outOf ? Math.round((total / outOf) * 1000) / 10 : 0;
    const g = gradeFor(percent);
    const pass = entered.length > 0 && entered.every((v) => (v.total / perSubject) * 100 >= PASS_PERCENT);
    return {
      studentId: s.id, name: s.user.name, rollNo: s.rollNo, admissionNo: s.admissionNo,
      marks: own, total, outOf, percent, grade: g.grade, gradeColor: g.color, pass, rank: null,
    };
  });

  const ranked = rows.filter((r) => r.outOf > 0).sort((a, b) => b.percent - a.percent);
  ranked.forEach((r, i) => {
    r.rank = i > 0 && ranked[i - 1].percent === r.percent ? (ranked[i - 1].rank as number) : i + 1;
  });

  return { exam, subjects, rows, perSubject };
}
