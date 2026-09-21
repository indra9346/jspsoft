import Link from "next/link";
import { GetForm } from "@/components/get-form";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { buildReport, REPORT_TYPES, type Filters, type ReportType } from "@/lib/reports";
import { Empty, PageHeader } from "@/components/ui";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { className, fmtDate, monthStr, todayISO } from "@/lib/utils";

export const metadata = { title: "Reports" };

type SP = Filters & { type?: string };
const NEEDS: Record<ReportType, (keyof Filters)[]> = {
  students: ["classId", "status"], staff: ["month"], attendance: ["month", "classId", "studentId"], marks: ["exam", "classId", "subjectId", "studentId"],
  results: ["exam", "classId"], classes: ["month", "exam"], sections: ["month", "exam"], transport: [], leave: ["year", "status"],
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser(["ADMIN"], "reports");
  const sp = await searchParams;
  const type = (REPORT_TYPES.find((t) => t.key === sp.type)?.key ?? "students") as ReportType;
  const filters: Filters = { month: sp.month || monthStr(todayISO()), exam: sp.exam || undefined, classId: sp.classId || undefined, subjectId: sp.subjectId || undefined, studentId: sp.studentId || undefined, status: sp.status || undefined, year: sp.year || undefined };
  const need = NEEDS[type];

  const [school, report, classes, exams, subjects, students] = await Promise.all([
    getSchool(),
    buildReport(type, filters),
    db.classRoom.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    db.exam.findMany({ orderBy: { startDate: "desc" } }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    filters.classId ? db.student.findMany({ where: { classId: filters.classId }, include: { user: true }, orderBy: { rollNo: "asc" } }) : Promise.resolve([]),
  ]);
  const qs = new URLSearchParams(Object.entries({ type, ...filters }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Reports" subtitle="Student, staff, attendance, marks, results, class, section, transport and leave reports — CSV or print/PDF" icon="reports" color="linear-gradient(135deg,#ec4899,#8b5cf6)"
          actions={<><a className="btn btn-primary" href={`/reports/export?${qs}`}><Download size={16} /> Download CSV</a><a className="btn btn-soft" href={`/reports/export?${qs}&format=pdf`}><Download size={16} /> Download PDF</a><PrintButton label="Print" /></>} />
        <div className="mb-4 flex flex-wrap gap-2">
          {REPORT_TYPES.map((t) => <Link key={t.key} href={`/reports?type=${t.key}`} className={`btn btn-sm ${t.key === type ? "btn-primary" : "btn-ghost"}`}>{t.label}</Link>)}
        </div>
        {need.length > 0 && (
          <GetForm className="card card-pad mb-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="type" value={type} />
            {need.includes("month") && <div><label className="label" htmlFor="month">Month</label><input id="month" type="month" name="month" defaultValue={filters.month} className="input" /></div>}
            {need.includes("year") && <div><label className="label" htmlFor="year">Year</label><input id="year" name="year" defaultValue={filters.year ?? todayISO().slice(0, 4)} className="input !w-28" /></div>}
            {need.includes("exam") && <div><label className="label" htmlFor="exam">Exam</label><select id="exam" name="exam" defaultValue={filters.exam ?? ""} className="select !w-48"><option value="">Latest</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
            {need.includes("classId") && <div><label className="label" htmlFor="classId">Class & section</label><select id="classId" name="classId" defaultValue={filters.classId ?? ""} className="select !w-40"><option value="">All</option>{classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}</select></div>}
            {need.includes("subjectId") && <div><label className="label" htmlFor="subjectId">Subject</label><select id="subjectId" name="subjectId" defaultValue={filters.subjectId ?? ""} className="select !w-44"><option value="">All</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
            {need.includes("studentId") && <div><label className="label" htmlFor="studentId">Student {filters.classId ? "" : "(choose a class first)"}</label><select id="studentId" name="studentId" defaultValue={filters.studentId ?? ""} className="select !w-52"><option value="">All students</option>{students.map((s) => <option key={s.id} value={s.id}>{s.rollNo}. {s.user.name}</option>)}</select></div>}
            {need.includes("status") && <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={filters.status ?? ""} className="select !w-40"><option value="">All</option>{type === "leave" ? <><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></> : <><option value="active">Active</option><option value="inactive">Inactive</option></>}</select></div>}
            <button className="btn btn-soft">Apply</button>
          </GetForm>
        )}
      </div>

      {/* branded header – appears on paper / PDF */}
      <div className="mb-4 hidden items-center gap-4 border-b-2 pb-3 print:flex" style={{ borderColor: "var(--brand)" }}>
        <Logo src={school.logoData} size={56} />
        <div className="flex-1"><div className="text-xl font-extrabold">{school.name}</div><div className="text-xs">{[school.address, school.phone, school.email, school.website].filter(Boolean).join(" · ")}</div></div>
        <div className="text-right text-xs"><div className="text-base font-extrabold">{report.title}</div>Generated {fmtDate(todayISO())}</div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="section-title flex-1 no-print">{report.title}</h2>
        {report.summary.map((s) => <span key={s.label} className="badge bg-white text-[color:var(--ink-strong)] ring-1 ring-[color:var(--line)]">{s.label}: <b>{s.value}</b></span>)}
      </div>
      {report.rows.length === 0 ? <Empty title="No records for these filters" /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr>{report.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{report.rows.map((r, i) => <tr key={i} className={String(r[0]).startsWith("SCHOOL TOTAL") ? "font-extrabold" : ""}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
