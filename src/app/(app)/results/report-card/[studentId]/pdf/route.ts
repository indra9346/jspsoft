import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { getSchool } from "@/lib/school";
import { examResults } from "@/lib/results";
import { reportCardPdf } from "@/lib/pdf";
import { attendancePercent, fmtDate, gradeFor, PASS_PERCENT } from "@/lib/utils";

/** Downloadable report card PDF. Authorised per student (admin: school, teacher: assigned sections, student: self). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { studentId } = await ctx.params;
  if (!(await canViewStudent(user, studentId))) return new NextResponse("Not found", { status: 404 });

  const [school, s] = await Promise.all([
    getSchool(),
    db.student.findUnique({ where: { id: studentId }, include: { user: true, academicYear: true, classRoom: { include: { classTeacher: { include: { user: true } } } } } }),
  ]);
  if (!s) return new NextResponse("Not found", { status: 404 });
  const examId = req.nextUrl.searchParams.get("exam");
  const exam = examId ? await db.exam.findUnique({ where: { id: examId } }) : await db.exam.findFirst({ where: { published: true, startDate: { lte: new Date() } }, orderBy: { startDate: "desc" } });
  if (!exam) return new NextResponse("Not found", { status: 404 });
  const [res, att] = await Promise.all([examResults(exam.id, s.classId), db.studentAttendance.findMany({ where: { studentId } })]);
  const me = res?.rows.find((r) => r.studentId === studentId);
  if (!res || !me) return new NextResponse("Not found", { status: 404 });

  const bytes = await reportCardPdf({
    school,
    student: { name: s.user.name, admissionNo: s.admissionNo, grade: s.classRoom.grade, section: s.classRoom.section, roll: s.rollNo, dob: fmtDate(s.dob), guardian: s.guardianName, classTeacher: s.classRoom.classTeacher?.user.name ?? "-", year: s.academicYear.name },
    exam: { name: exam.name, maxInternal: exam.maxInternal, maxTheory: exam.maxTheory },
    subjects: res.subjects.map((sub) => {
      const m = me.marks[sub.id]; const pct = m ? Math.round((m.total / res.perSubject) * 1000) / 10 : null;
      return { name: sub.name, internal: m?.internal ?? null, theory: m?.theory ?? null, total: m?.total ?? null, percent: pct, grade: pct === null ? "-" : gradeFor(pct).grade, result: pct === null ? "-" : pct >= PASS_PERCENT ? "Pass" : "Fail" };
    }),
    totals: { total: me.total, outOf: me.outOf, percent: me.percent, grade: me.grade, result: me.pass ? "PASS" : "FAIL", rank: me.rank ? `#${me.rank} of ${res.rows.length}` : "-", attendance: `${attendancePercent(att)}%` },
  });
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="report-card-${s.admissionNo}-${exam.name.replace(/[^\w]+/g, "_")}.pdf"`, "Cache-Control": "private, no-store" } });
}
