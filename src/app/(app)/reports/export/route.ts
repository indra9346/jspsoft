import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { isFeatureEnabled } from "@/lib/features-server";
import { buildReport, REPORT_TYPES, type Filters, type ReportType } from "@/lib/reports";
import { db } from "@/lib/db";
import { examResults } from "@/lib/results";
import { gradeFor, PASS_PERCENT } from "@/lib/utils";
import { getSchool } from "@/lib/school";
import { tablePdf } from "@/lib/pdf";

const csv = (cols: string[], rows: (string | number)[][]) =>
  [cols, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

const send = (name: string, cols: string[], rows: (string | number)[][]) =>
  new NextResponse("﻿" + csv(cols, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]+/g, "_")}.csv"` } });

const sendPdf = async (name: string, title: string, cols: string[], rows: (string | number)[][], summary: { label: string; value: string | number }[] = []) =>
  new NextResponse(Buffer.from(await tablePdf(await getSchool(), title, cols, rows, summary)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]+/g, "_")}.pdf"`, "Cache-Control": "private, no-store" } });

/** CSV (default) and PDF (&format=pdf) downloads. Admin: every report. Teacher/Student: only attendance/report-card of students they are allowed to see. */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const p = req.nextUrl.searchParams;
  const type = p.get("type") ?? "";

  // individual student downloads — authorised per student
  if (type === "student_attendance" || type === "report_card") {
    const studentId = p.get("student") ?? (user.role === "STUDENT" ? user.student?.id : null);
    if (!studentId || !(await canViewStudent(user, studentId))) return new NextResponse("Forbidden", { status: 403 });
    if (type === "student_attendance") {
      const r = await buildReport("attendance", { studentId });
      return p.get("format") === "pdf" ? sendPdf(r.filename, r.title, r.columns, r.rows, r.summary) : send(r.filename, r.columns, r.rows);
    }
    const s = await db.student.findUnique({ where: { id: studentId }, include: { user: true } });
    const exam = p.get("exam") ? await db.exam.findUnique({ where: { id: p.get("exam")! } }) : await db.exam.findFirst({ where: { startDate: { lte: new Date() } }, orderBy: { startDate: "desc" } });
    if (!s || !exam) return new NextResponse("Not found", { status: 404 });
    const res = await examResults(exam.id, s.classId);
    const me = res?.rows.find((r) => r.studentId === studentId);
    if (!res || !me) return new NextResponse("Not found", { status: 404 });
    const rows: (string | number)[][] = res.subjects.map((sub) => { const m = me.marks[sub.id]; return [sub.name, m?.internal ?? "", m?.theory ?? "", m?.total ?? "", res.perSubject, m ? Math.round((m.total / res.perSubject) * 1000) / 10 : "", m ? gradeFor((m.total / res.perSubject) * 100).grade : "", m ? (m.total / res.perSubject) * 100 >= PASS_PERCENT ? "Pass" : "Fail" : ""]; });
    rows.push(["TOTAL", "", "", me.total, me.outOf, me.percent, me.grade, me.pass ? "Pass" : "Fail"]);
    return send(`report-card-${s.admissionNo}-${exam.name}`, ["Subject", "Internal", "Theory", "Total", "Out of", "Percent", "Grade", "Result"], rows);
  }

  // school-wide reports — admin only, and only while the reports feature is on
  if (user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  if (!(await isFeatureEnabled("reports"))) return new NextResponse("Feature locked", { status: 403 });
  if (!REPORT_TYPES.some((t) => t.key === type)) return new NextResponse("Unknown report", { status: 400 });
  const f: Filters = { month: p.get("month") ?? undefined, exam: p.get("exam") ?? undefined, classId: p.get("classId") ?? p.get("class") ?? undefined, subjectId: p.get("subjectId") ?? undefined, studentId: p.get("studentId") ?? undefined, status: p.get("status") ?? undefined, year: p.get("year") ?? undefined };
  const r = await buildReport(type as ReportType, f);
  return p.get("format") === "pdf" ? sendPdf(r.filename, r.title, r.columns, r.rows, r.summary) : send(r.filename, r.columns, r.rows);
}
