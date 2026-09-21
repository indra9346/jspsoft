import Link from "next/link";
import { GetForm } from "@/components/get-form";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canViewStudent, visibleClasses } from "@/lib/access";
import { Avatar, Badge, Empty, PageHeader, Tile } from "@/components/ui";
import { AttendanceSheet } from "@/components/attendance-sheet";
import { Legend, MonthCalendar, MonthMatrix, MonthNav } from "@/components/attendance-views";
import { BarsChart, DonutChart } from "@/components/charts";
import { markStaffAttendanceAction, markStudentAttendanceAction } from "@/actions/attendance";
import {
  ATT_STATUS, STAFF_STATUSES, addDays, attendanceCounts, attendancePercent, avatarColor, className, fmtDate, initials, monthLabel, monthRange, monthStr, todayISO, toDate, type AttStatus,
} from "@/lib/utils";

export const metadata = { title: "Attendance" };

interface SP { view?: string; class?: string; date?: string; month?: string; from?: string; to?: string; student?: string }

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "attendance");
  const sp = await searchParams;
  if (user.role === "STUDENT") return <StudentView user={user} sp={sp} />;
  return <StaffView user={user} sp={sp} />;
}

/* ------------------------------------------------------------ student */
async function StudentView({ user, sp }: { user: SessionUser; sp: SP }) {
  const st = user.student!; // a student only ever sees their own records — the id comes from the session, never from the URL
  const month = sp.month ?? monthStr(todayISO());
  const { from, to } = monthRange(month);
  const all = await db.studentAttendance.findMany({ where: { studentId: st.id }, orderBy: { date: "desc" } });
  const records = all.filter((a) => a.date >= toDate(from) && a.date <= toDate(to)).reverse();
  const c = attendanceCounts(all);
  const byMonth = new Map<string, { status: string }[]>();
  for (const a of all) { const m = a.date.toISOString().slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), a]); }
  const monthly = [...byMonth.entries()].sort().map(([m, rows]) => ({ month: monthLabel(m), Attendance: attendancePercent(rows) }));
  return (
    <div>
      <PageHeader title="My Attendance" subtitle={`Class ${className(st.classRoom)} · Roll no. ${st.rollNo}`} icon="attendance" color="linear-gradient(135deg,#3b82f6,#06b6d4)"
        actions={<><MonthNav month={month} base="/attendance" /><a className="btn btn-ghost" href="/reports/export?type=student_attendance"><Download size={16} /> CSV</a><a className="btn btn-ghost" href="/reports/export?type=student_attendance&format=pdf"><Download size={16} /> PDF</a></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Attendance" value={`${c.percent}%`} tone="blue" icon="attendance" sub={`${attendancePercent(records)}% in ${monthLabel(month)}`} />
        <Tile label="Present days" value={c.present} tone="green" icon="students" />
        <Tile label="Absent days" value={c.absent} tone="pink" icon="attendance" sub={`${c.excused} excused`} />
        <Tile label="Late days" value={c.late} tone="orange" icon="timetable" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="card card-pad"><h2 className="section-title mb-3">Monthly calendar · {monthLabel(month)}</h2><MonthCalendar month={month} records={records} /><div className="mt-4"><Legend /></div></div>
          <div className="card card-pad"><h2 className="section-title mb-2">Monthly attendance</h2><BarsChart data={monthly} xKey="month" max={100} unit="%" height={220} series={[{ key: "Attendance", label: "Attendance %", color: "#06b6d4" }]} /></div>
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-3">History</h2>
          {all.length === 0 ? <p className="text-sm text-[color:var(--ink-soft)]">No records yet.</p> : (
            <ul className="max-h-[36rem] space-y-1.5 overflow-y-auto pr-1">
              {all.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-[color:var(--line)]"><span className="font-semibold">{fmtDate(a.date, { weekday: "short" })}</span><Badge color={ATT_STATUS[a.status].color}>{ATT_STATUS[a.status].label}</Badge></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- admin & teacher */
async function StaffView({ user, sp }: { user: SessionUser; sp: SP }) {
  const isAdmin = user.role === "ADMIN";
  const today = todayISO();
  const view = sp.view ?? "daily";
  const classes = await visibleClasses(user);
  const staffId = user.staff?.id;
  const current = classes.find((c) => c.id === sp.class) ?? (staffId ? classes.find((c) => c.classTeacherId === staffId) : undefined) ?? classes[0];
  const date = sp.date && sp.date <= today ? sp.date : today;
  const month = sp.month ?? monthStr(today);
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, class: current?.id, ...extra })) if (v) p.set(k, v);
    return `/attendance?${p.toString()}`;
  };

  const tabs = [
    { key: "daily", label: "Mark / Daily" },
    { key: "monthly", label: "Monthly" },
    { key: "history", label: "History" },
    { key: "overall", label: "Overall" },
    { key: "student", label: "Student history" },
    { key: "staff", label: isAdmin ? "Staff attendance" : "My attendance" },
  ];
  const needsClass = ["daily", "monthly", "history", "student"].includes(view);

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Student & teacher attendance — daily, monthly, overall and historical records" icon="attendance" color="linear-gradient(135deg,#3b82f6,#06b6d4)" />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => <Link key={t.key} href={q({ view: t.key, student: undefined })} className={`btn ${view === t.key ? "btn-primary" : "btn-ghost"}`}>{t.label}</Link>)}
      </div>
      {needsClass && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {classes.map((c) => <Link key={c.id} href={q({ class: c.id, student: undefined })} className={`btn btn-sm ${c.id === current?.id ? "btn-soft !border-[color:var(--brand)]" : "btn-ghost"}`}>{className(c)}</Link>)}
        </div>
      )}

      {view === "daily" && (current ? <Daily classId={current.id} name={className(current)} date={date} today={today} q={q} /> : <NoClass />)}
      {view === "monthly" && (current ? <Monthly classId={current.id} month={month} name={className(current)} base={q({ month: undefined })} /> : <NoClass />)}
      {view === "history" && (current ? <History classId={current.id} from={sp.from ?? addDays(today, -14)} to={sp.to ?? today} q={q} /> : <NoClass />)}
      {view === "overall" && <Overall user={user} month={month} base={q({ month: undefined })} />}
      {view === "student" && (current ? <StudentHistory user={user} classId={current.id} studentId={sp.student} month={month} q={q} /> : <NoClass />)}
      {view === "staff" && (isAdmin ? <StaffAdmin date={date} today={today} month={month} q={q} /> : <MyStaffAttendance staffId={user.staff!.id} month={month} base={q({ month: undefined })} />)}
    </div>
  );
}

const NoClass = () => <Empty title="No class selected" hint="You have no classes assigned yet." />;

async function Daily({ classId, name, date, today, q }: { classId: string; name: string; date: string; today: string; q: (e: Record<string, string | undefined>) => string }) {
  const [students, records] = await Promise.all([
    db.student.findMany({ where: { classId, user: { active: true } }, include: { user: true }, orderBy: { rollNo: "asc" } }),
    db.studentAttendance.findMany({ where: { classId, date: toDate(date) } }),
  ]);
  const by = new Map(records.map((r) => [r.studentId, r.status as AttStatus]));
  return (
    <div>
      <div className="card card-pad mb-4 flex flex-wrap items-center gap-3">
        <div className="font-extrabold text-[color:var(--ink-strong)]">Class {name} · {fmtDate(date, { weekday: "long" })}</div>
        {records.length > 0 ? <Badge color="#059669">Already marked</Badge> : <Badge color="#d97706">Not marked yet</Badge>}
        <div className="ml-auto flex items-center gap-2">
          <Link href={q({ date: addDays(date, -1) })} className="btn btn-ghost btn-sm">← Prev</Link>
          <GetForm action="/attendance" className="flex items-center gap-2">
            <input type="hidden" name="view" value="daily" /><input type="hidden" name="class" value={classId} />
            <input type="date" name="date" defaultValue={date} max={today} className="input !w-44" /><button className="btn btn-soft btn-sm">Go</button>
          </GetForm>
          {date < today && <Link href={q({ date: addDays(date, 1) })} className="btn btn-ghost btn-sm">Next →</Link>}
        </div>
      </div>
      {students.length === 0 ? <Empty title="No students in this section" /> : (
        <AttendanceSheet key={`${classId}-${date}`} items={students.map((s) => ({ id: s.id, name: s.user.name, sub: `Roll ${s.rollNo} · ${s.admissionNo}`, initials: initials(s.user.name), color: avatarColor(s.user.email), status: by.get(s.id) ?? null }))} save={markStudentAttendanceAction.bind(null, classId, date)} />
      )}
    </div>
  );
}

async function Monthly({ classId, month, name, base }: { classId: string; month: string; name: string; base: string }) {
  const { from, to } = monthRange(month);
  const [students, records] = await Promise.all([
    db.student.findMany({ where: { classId }, include: { user: true }, orderBy: { rollNo: "asc" } }),
    db.studentAttendance.findMany({ where: { classId, date: { gte: toDate(from), lte: toDate(to) } } }),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">Class {name} · monthly register</h2><MonthNav month={month} base={base} /></div>
      <MonthMatrix month={month} rows={students.map((s) => ({ id: s.id, name: s.user.name, sub: `Roll ${s.rollNo}`, records: records.filter((r) => r.studentId === s.id) }))} />
      <Legend />
    </div>
  );
}

async function History({ classId, from, to, q }: { classId: string; from: string; to: string; q: (e: Record<string, string | undefined>) => string }) {
  const [rows, total] = await Promise.all([
    db.studentAttendance.groupBy({ by: ["date", "status"], where: { classId, date: { gte: toDate(from), lte: toDate(to) } }, _count: true }),
    db.student.count({ where: { classId } }),
  ]);
  const dates = [...new Set(rows.map((r) => r.date.toISOString().slice(0, 10)))].sort().reverse();
  const get = (d: string, s: string) => rows.find((r) => r.date.toISOString().slice(0, 10) === d && r.status === s)?._count ?? 0;
  return (
    <div className="space-y-4">
      <GetForm action="/attendance" className="card card-pad flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value="history" /><input type="hidden" name="class" value={classId} />
        <div><label className="label" htmlFor="from">From</label><input id="from" type="date" name="from" defaultValue={from} className="input" /></div>
        <div><label className="label" htmlFor="to">To</label><input id="to" type="date" name="to" defaultValue={to} className="input" /></div>
        <button className="btn btn-soft">Show</button>
      </GetForm>
      {dates.length === 0 ? <Empty title="No records in this period" /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Attendance</th><th /></tr></thead>
            <tbody>
              {dates.map((d) => {
                const pct = attendancePercent([...Array(get(d, "PRESENT")).fill({ status: "PRESENT" }), ...Array(get(d, "LATE")).fill({ status: "LATE" }), ...Array(get(d, "ABSENT")).fill({ status: "ABSENT" })]);
                return (
                  <tr key={d}>
                    <td className="font-bold text-[color:var(--ink-strong)]">{fmtDate(d, { weekday: "short" })}</td>
                    <td className="font-bold text-emerald-600">{get(d, "PRESENT")}</td><td className="font-bold text-rose-600">{get(d, "ABSENT")}</td><td>{get(d, "LATE")}</td><td>{get(d, "EXCUSED")}</td>
                    <td><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-[color:var(--line)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "#10b981" : pct >= 75 ? "#f59e0b" : "#f43f5e" }} /></div><span className="text-xs font-bold">{pct}%</span><span className="text-xs text-[color:var(--ink-soft)]">of {total}</span></div></td>
                    <td className="text-right"><Link className="btn btn-ghost btn-sm" href={q({ view: "daily", date: d })}>Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Individual + overall: school, class (grade) and section attendance for a month, with monthly tracking. */
async function Overall({ user, month, base }: { user: SessionUser; month: string; base: string }) {
  const { from, to } = monthRange(month);
  const classes = await visibleClasses(user);
  const ids = classes.map((c) => c.id);
  const [recs, enrolled, all] = await Promise.all([
    db.studentAttendance.findMany({ where: { classId: { in: ids }, date: { gte: toDate(from), lte: toDate(to) } }, select: { status: true, classId: true } }),
    db.student.groupBy({ by: ["classId"], where: { classId: { in: ids }, user: { active: true } }, _count: true }),
    db.studentAttendance.findMany({ where: { classId: { in: ids } }, select: { status: true, date: true } }),
  ]);
  const sectionRows = classes.map((c) => ({ c, students: enrolled.find((e) => e.classId === c.id)?._count ?? 0, ...attendanceCounts(recs.filter((r) => r.classId === c.id)) }));
  const grades = [...new Set(classes.map((c) => c.grade))].map((g) => {
    const rows = sectionRows.filter((s) => s.c.grade === g);
    const cr = recs.filter((r) => classes.find((c) => c.id === r.classId)?.grade === g);
    return { grade: g, students: rows.reduce((a, r) => a + r.students, 0), ...attendanceCounts(cr) };
  });
  const school = attendanceCounts(recs);
  const totalStudents = sectionRows.reduce((a, r) => a + r.students, 0);
  const byMonth = new Map<string, { status: string }[]>();
  for (const a of all) { const m = a.date.toISOString().slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), a]); }
  const trend = [...byMonth.entries()].sort().map(([m, rows]) => ({ month: monthLabel(m), Attendance: attendancePercent(rows) }));
  const label = user.role === "ADMIN" ? "School" : "My classes";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Overall attendance · {monthLabel(month)}</h2>
        <div className="flex items-center gap-2"><MonthNav month={month} base={base} /><a className="btn btn-ghost btn-sm" href={`/reports/export?type=attendance&month=${month}`}><Download size={14} /> CSV</a></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={`${label} · students`} value={totalStudents} tone="blue" icon="students" sub={`${school.total} records this month`} />
        <Tile label="Present" value={school.present + school.late} tone="green" icon="attendance" sub={`${school.late} late`} />
        <Tile label="Absent" value={school.absent} tone="pink" icon="attendance" sub={`${school.excused} excused`} />
        <Tile label="Attendance" value={`${school.percent}%`} tone="purple" icon="reports" sub={monthLabel(month)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card card-pad"><h3 className="section-title mb-2">Monthly tracking</h3><BarsChart data={trend} xKey="month" max={100} unit="%" height={230} series={[{ key: "Attendance", label: "Attendance %", color: "#3b82f6" }]} /></div>
        <div className="card card-pad"><h3 className="section-title mb-2">Status split · {monthLabel(month)}</h3><DonutChart height={230} data={[{ name: "Present", value: school.present, color: "#10b981" }, { name: "Absent", value: school.absent, color: "#f43f5e" }, { name: "Late", value: school.late, color: "#f59e0b" }, { name: "Excused", value: school.excused, color: "#8b5cf6" }]} centerLabel={{ value: `${school.percent}%`, caption: "Attendance" }} /></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card table-wrap">
          <div className="p-4 pb-0"><h3 className="section-title">Class attendance</h3></div>
          <table className="table mt-3"><thead><tr><th>Class</th><th>Students</th><th>Present</th><th>Absent</th><th>%</th></tr></thead>
            <tbody>{grades.map((g) => <tr key={g.grade}><td className="font-bold">{g.grade}</td><td>{g.students}</td><td className="text-emerald-600 font-bold">{g.present + g.late}</td><td className="text-rose-600 font-bold">{g.absent}</td><td><Pct v={g.percent} /></td></tr>)}</tbody></table>
        </div>
        <div className="card table-wrap">
          <div className="p-4 pb-0"><h3 className="section-title">Section attendance</h3></div>
          <table className="table mt-3"><thead><tr><th>Section</th><th>Students</th><th>Present</th><th>Absent</th><th>%</th></tr></thead>
            <tbody>{sectionRows.map((r) => <tr key={r.c.id}><td className="font-bold">{className(r.c)}</td><td>{r.students}</td><td className="text-emerald-600 font-bold">{r.present + r.late}</td><td className="text-rose-600 font-bold">{r.absent}</td><td><Pct v={r.percent} /></td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

const Pct = ({ v }: { v: number }) => <Badge color={v >= 90 ? "#059669" : v >= 75 ? "#d97706" : "#e11d48"}>{v}%</Badge>;

/** One student's attendance history — pick a student of the selected section. Authorised per student. */
async function StudentHistory({ user, classId, studentId, month, q }: { user: SessionUser; classId: string; studentId?: string; month: string; q: (e: Record<string, string | undefined>) => string }) {
  const students = await db.student.findMany({ where: { classId }, include: { user: true }, orderBy: { rollNo: "asc" } });
  const sel = students.find((s) => s.id === studentId);
  if (sel && !(await canViewStudent(user, sel.id))) return <Empty title="You can't view this student" />;
  const { from, to } = monthRange(month);
  const all = sel ? await db.studentAttendance.findMany({ where: { studentId: sel.id }, orderBy: { date: "desc" } }) : [];
  const records = all.filter((a) => a.date >= toDate(from) && a.date <= toDate(to)).reverse();
  const c = attendanceCounts(all);
  const byMonth = new Map<string, { status: string }[]>();
  for (const a of all) { const m = a.date.toISOString().slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), a]); }
  const monthly = [...byMonth.entries()].sort().map(([m, rows]) => ({ month: monthLabel(m), Attendance: attendancePercent(rows) }));
  return (
    <div className="space-y-5">
      <div className="card card-pad flex flex-wrap gap-2">
        {students.map((s) => (
          <Link key={s.id} href={q({ student: s.id })} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold ring-1 ${s.id === sel?.id ? "bg-[color:var(--brand-soft)] ring-[color:var(--brand)]" : "bg-white ring-[color:var(--line)]"}`}>
            <Avatar name={s.user.name} seed={s.user.email} size={24} photo={s.photoData} /> {s.rollNo}. {s.user.name}
          </Link>
        ))}
      </div>
      {!sel ? <Empty title="Choose a student" hint="Select a student above to see their full attendance history." /> : (
        <>
          <div className="flex flex-wrap items-center gap-3"><h2 className="section-title flex-1">{sel.user.name} · {monthLabel(month)}</h2><MonthNav month={month} base={q({ month: undefined })} /><a className="btn btn-ghost btn-sm" href={`/reports/export?type=student_attendance&student=${sel.id}`}><Download size={14} /> Download</a></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Attendance" value={`${c.percent}%`} tone="blue" icon="attendance" /><Tile label="Present" value={c.present} tone="green" icon="students" />
            <Tile label="Absent" value={c.absent} tone="pink" icon="attendance" sub={`${c.excused} excused`} /><Tile label="Late" value={c.late} tone="orange" icon="timetable" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card card-pad"><MonthCalendar month={month} records={records} /><div className="mt-4"><Legend /></div></div>
            <div className="card card-pad"><h3 className="section-title mb-2">Monthly attendance</h3><BarsChart data={monthly} xKey="month" max={100} unit="%" height={220} series={[{ key: "Attendance", label: "Attendance %", color: "#06b6d4" }]} /></div>
          </div>
        </>
      )}
    </div>
  );
}

async function StaffAdmin({ date, today, month, q }: { date: string; today: string; month: string; q: (e: Record<string, string | undefined>) => string }) {
  const { from, to } = monthRange(month);
  const [staff, day, records] = await Promise.all([
    db.staff.findMany({ where: { staffType: "TEACHING" }, include: { user: true }, orderBy: { employeeId: "asc" } }),
    db.staffAttendance.findMany({ where: { date: toDate(date) } }),
    db.staffAttendance.findMany({ where: { date: { gte: toDate(from), lte: toDate(to) } } }),
  ]);
  const by = new Map(day.map((r) => [r.staffId, r.status as AttStatus]));
  return (
    <div className="space-y-8">
      <div>
        <div className="card card-pad mb-4 flex flex-wrap items-center gap-3">
          <div className="font-extrabold text-[color:var(--ink-strong)]">Teachers · {fmtDate(date, { weekday: "long" })}</div>
          {day.length > 0 ? <Badge color="#059669">Already marked</Badge> : <Badge color="#d97706">Not marked yet</Badge>}
          <GetForm action="/attendance" className="ml-auto flex items-center gap-2"><input type="hidden" name="view" value="staff" /><input type="date" name="date" defaultValue={date} max={today} className="input !w-44" /><button className="btn btn-soft btn-sm">Go</button></GetForm>
        </div>
        <AttendanceSheet key={date} statuses={STAFF_STATUSES} items={staff.map((s) => ({ id: s.id, name: s.user.name, sub: `${s.employeeId} · ${s.designation}`, initials: initials(s.user.name), color: avatarColor(s.user.email), status: by.get(s.id) ?? null }))} save={markStaffAttendanceAction.bind(null, date)} />
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">Teacher monthly register</h2><MonthNav month={month} base={q({ month: undefined })} /></div>
        <MonthMatrix month={month} rows={staff.map((s) => ({ id: s.id, name: s.user.name, sub: s.employeeId, records: records.filter((r) => r.staffId === s.id) }))} />
        <Legend staff />
      </div>
    </div>
  );
}

async function MyStaffAttendance({ staffId, month, base }: { staffId: string; month: string; base: string }) {
  const { from, to } = monthRange(month);
  const all = await db.staffAttendance.findMany({ where: { staffId }, orderBy: { date: "desc" } });
  const records = all.filter((a) => a.date >= toDate(from) && a.date <= toDate(to)).reverse();
  const c = attendanceCounts(records);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">My attendance</h2><MonthNav month={month} base={base} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Attendance" value={`${c.percent}%`} tone="blue" icon="attendance" /><Tile label="Present" value={c.present + c.late} tone="green" icon="staff" sub={`${c.late} late`} />
        <Tile label="Absent" value={c.absent} tone="pink" icon="attendance" /><Tile label="Leave" value={c.leave} tone="purple" icon="leave" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad"><MonthCalendar month={month} records={records} /><div className="mt-4"><Legend staff /></div></div>
        <div className="card card-pad"><h3 className="section-title mb-3">History</h3>
          <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">{all.slice(0, 60).map((a) => <li key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-[color:var(--line)]"><span className="font-semibold">{fmtDate(a.date, { weekday: "short" })}</span><Badge color={ATT_STATUS[a.status].color}>{ATT_STATUS[a.status].label}</Badge></li>)}</ul>
        </div>
      </div>
    </div>
  );
}

