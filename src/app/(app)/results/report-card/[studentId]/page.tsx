import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { getSchool } from "@/lib/school";
import { examResults } from "@/lib/results";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { attendancePercent, className, fmtDate, gradeFor, GRADE_SCALE, PASS_PERCENT } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element */
export const metadata = { title: "Report card" };

/** Printable report card (use Print → Save as PDF). Access is decided server-side per student. */
export default async function ReportCard({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ exam?: string }> }) {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "results");
  const { studentId } = await params;
  const { exam: examId } = await searchParams;
  if (!(await canViewStudent(user, studentId))) notFound();

  const [school, s, exams] = await Promise.all([
    getSchool(),
    db.student.findUnique({ where: { id: studentId }, include: { user: true, academicYear: true, classRoom: { include: { classTeacher: { include: { user: true } } } } } }),
    db.exam.findMany({ where: { published: true }, orderBy: { startDate: "desc" } }),
  ]);
  if (!s) notFound();
  const exam = exams.find((e) => e.id === examId) ?? exams.find((e) => e.startDate <= new Date()) ?? exams[0];
  if (!exam) notFound();
  const [res, att] = await Promise.all([examResults(exam.id, s.classId), db.studentAttendance.findMany({ where: { studentId } })]);
  const me = res?.rows.find((r) => r.studentId === studentId);
  if (!res || !me) notFound();
  const per = res.perSubject;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {user.role !== "STUDENT" && <Link href={`/students/${s.id}`} className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Student</Link>}
        <div className="flex flex-wrap gap-1.5">{exams.map((e) => <Link key={e.id} href={`/results/report-card/${s.id}?exam=${e.id}`} className={`btn btn-sm ${e.id === exam.id ? "btn-primary" : "btn-ghost"}`}>{e.name}</Link>)}</div>
        <span className="ml-auto flex gap-2"><a className="btn btn-primary" href={`/results/report-card/${s.id}/pdf?exam=${exam.id}`}><Download size={16} /> Download PDF</a><a className="btn btn-ghost" href={`/reports/export?type=report_card&student=${s.id}&exam=${exam.id}`}><Download size={16} /> CSV</a><PrintButton label="Print / Save as PDF" /></span>
      </div>

      <div className="card bg-white p-6 sm:p-10" style={{ borderTop: "6px solid var(--brand)" }}>
        <div className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: "var(--brand2)" }}>
          <Logo src={school.logoData} size={72} className="ring-1 ring-[color:var(--line)]" />
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold">{school.name}</div>
            <div className="text-xs text-[color:var(--ink-soft)]">{[school.address, school.phone, school.email, school.website].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right"><div className="rounded-xl px-3 py-1.5 text-sm font-extrabold text-white" style={{ background: "var(--grad)" }}>REPORT CARD</div><div className="mt-1 text-xs font-semibold text-[color:var(--ink-soft)]">{exam.name} · {s.academicYear.name}</div></div>
        </div>

        <div className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[["Student", s.user.name], ["Admission number", s.admissionNo], ["Class", s.classRoom.grade], ["Section", s.classRoom.section], ["Roll number", String(s.rollNo)], ["Date of birth", fmtDate(s.dob)], ["Parent / guardian", s.guardianName], ["Class teacher", s.classRoom.classTeacher?.user.name ?? "—"]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-[color:var(--line)] pb-1"><span className="font-semibold text-[color:var(--ink-soft)]">{k}</span><span className="font-bold text-[color:var(--ink-strong)]">{v}</span></div>
          ))}
        </div>

        <div className="table-wrap mt-6"><table className="table text-center">
          <thead><tr><th className="!text-left">Subject</th><th className="!text-center">Internal /{exam.maxInternal}</th><th className="!text-center">Theory /{exam.maxTheory}</th><th className="!text-center">Total /{per}</th><th className="!text-center">%</th><th className="!text-center">Grade</th><th className="!text-center">Result</th></tr></thead>
          <tbody>
            {res.subjects.map((sub) => {
              const m = me.marks[sub.id];
              const pct = m ? (m.total / per) * 100 : null;
              return (
                <tr key={sub.id}>
                  <td className="!text-left font-bold">{sub.name}</td><td>{m?.internal ?? "—"}</td><td>{m?.theory ?? "—"}</td><td className="font-extrabold">{m?.total ?? "—"}</td>
                  <td>{pct === null ? "—" : `${Math.round(pct * 10) / 10}%`}</td><td>{pct === null ? "—" : gradeFor(pct).grade}</td><td>{pct === null ? "—" : pct >= PASS_PERCENT ? "Pass" : "Fail"}</td>
                </tr>
              );
            })}
            <tr className="font-extrabold"><td className="!text-left">Total</td><td /><td /><td>{me.total}/{me.outOf}</td><td>{me.percent}%</td><td>{me.grade}</td><td>{me.pass ? "PASS" : "FAIL"}</td></tr>
          </tbody>
        </table></div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          {[["Percentage", `${me.percent}%`], ["Grade", `${me.grade} · ${gradeFor(me.percent).label}`], ["Class rank", me.rank ? `#${me.rank} of ${res.rows.length}` : "—"], ["Attendance", `${attendancePercent(att)}%`]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-[color:var(--brand2-soft)] p-3 text-center"><div className="text-[11px] font-bold uppercase text-[color:var(--ink-soft)]">{k}</div><div className="text-base font-extrabold text-[color:var(--ink-strong)]">{v}</div></div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-[color:var(--ink-soft)]">Grades: {GRADE_SCALE.map((g, i) => `${g.grade} ${g.min}${i === 0 ? "%+" : `–${GRADE_SCALE[i - 1].min - 1}%`}`).join(" · ")} · Pass mark {PASS_PERCENT}% in every subject.</div>

        <div className="mt-14 flex items-end justify-between">
          <div className="text-center"><div className="h-10 w-44 border-b border-[color:var(--ink-soft)]" /><div className="mt-1 text-xs font-semibold text-[color:var(--ink-soft)]">Class teacher</div></div>
          <div className="text-center">
            {school.signatureData ? <img src={school.signatureData} alt="Authorized signature" className="mx-auto h-12 object-contain" /> : <div className="h-10 w-44" />}
            <div className="border-t border-[color:var(--ink-soft)] px-6 pt-1 text-xs font-semibold text-[color:var(--ink-soft)]">Principal{school.principalName ? ` · ${school.principalName}` : ""}<br />Authorized Signature</div>
          </div>
        </div>
        <div className="mt-6 text-center text-[10px] text-[color:var(--ink-soft)]">Generated by SwanSchoolERP · Swan Digital Solutions</div>
      </div>
      <span className="hidden">{className(s.classRoom)}</span>
    </div>
  );
}
