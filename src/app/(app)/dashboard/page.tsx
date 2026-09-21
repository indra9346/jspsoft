import Link from "next/link";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { getCurrentYear, getSchool } from "@/lib/school";
import { getAnnouncements } from "@/lib/announcements";
import { getUnlockedAddons } from "@/lib/features-server";
import { teacherClassIds } from "@/lib/access";
import { examResults } from "@/lib/results";
import { LOCKED_LIST } from "@/lib/features";
import { ICONS } from "@/components/icons";
import { Logo } from "@/components/logo";
import { Badge, Empty, Tile } from "@/components/ui";
import { AnnouncementCards } from "@/components/announcement-list";
import { BarsChart, DonutChart, TrendChart } from "@/components/charts";
import {
  DAYS, LEAVE_TYPES, attendanceCounts, attendancePercent, className, examMax, fmtDate, gradeFor, monthLabel, monthRange, monthStr, todayISO, toDate, weekday,
} from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [school, year] = await Promise.all([getSchool(), getCurrentYear()]);
  return (
    <div>
      <div className="card relative mb-6 overflow-hidden p-6 sm:p-8" style={{ background: "var(--grad)" }}>
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15" />
        <div className="absolute bottom-[-40px] right-40 h-32 w-32 rounded-full bg-amber-300/25" />
        <div className="relative flex flex-wrap items-center gap-4">
          <Logo src={school.logoData} size={64} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white/85">{fmtDate(todayISO(), { weekday: "long" })}</div>
            <h1 className="text-2xl font-extrabold !text-white sm:text-3xl">{greeting()}, {user.name.split(" ")[0]}! 👋</h1>
            <p className="mt-1 text-sm text-white/85">Welcome to {school.name} · Academic year {year?.name ?? "—"}</p>
          </div>
        </div>
      </div>
      {user.role === "ADMIN" ? <AdminDash /> : user.role === "TEACHER" ? <TeacherDash user={user} /> : <StudentDash user={user} />}
    </div>
  );
}

/* ------------------------------------------------------------------ admin */
async function AdminDash() {
  const user = await requireUser();
  const today = todayISO();
  const month = monthStr(today);
  const { from, to } = monthRange(month);
  const [students, teachers, admins, classes, pendingLeaves, classList, anns, recentDates, exams, buses, monthAtt, unlocked, recentRemarks] = await Promise.all([
    db.student.count({ where: { user: { active: true } } }),
    db.staff.count({ where: { staffType: "TEACHING", user: { active: true } } }),
    db.user.count({ where: { role: "ADMIN", active: true } }),
    db.classRoom.count(),
    db.leaveRequest.findMany({ where: { status: "PENDING" }, include: { staff: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.classRoom.findMany({ include: { _count: { select: { students: true } } }, orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    getAnnouncements(user, 3),
    db.studentAttendance.findMany({ distinct: ["date"], select: { date: true }, orderBy: { date: "desc" }, take: 7 }),
    db.exam.findMany({ where: { startDate: { gte: toDate(today) } }, orderBy: { startDate: "asc" }, take: 4 }),
    db.bus.findMany({ select: { status: true } }),
    db.studentAttendance.findMany({ where: { date: { gte: toDate(from), lte: toDate(to) } }, select: { status: true, classId: true } }),
    getUnlockedAddons(),
    db.studentRemark.findMany({ include: { student: { include: { user: true } }, author: true, classRoom: true }, orderBy: { date: "desc" }, take: 4 }),
  ]);

  const dates = recentDates.map((d) => d.date).reverse();
  const att = dates.length ? await db.studentAttendance.groupBy({ by: ["date", "status"], where: { date: { in: dates } }, _count: true }) : [];
  const trend = dates.map((d) => {
    const rows = att.filter((a) => a.date.getTime() === d.getTime());
    const get = (st: string) => rows.find((r) => r.status === st)?._count ?? 0;
    return { day: fmtDate(d, { day: "2-digit", month: "short", year: undefined }), Present: get("PRESENT") + get("LATE"), Absent: get("ABSENT"), total: rows.reduce((s, r) => s + r._count, 0), present: get("PRESENT") + get("LATE") };
  });
  const last = trend[trend.length - 1];
  const activeBuses = buses.filter((b) => b.status === "ACTIVE").length;
  const perClass = classList.map((c) => ({ name: className(c), Attendance: attendancePercent(monthAtt.filter((a) => a.classId === c.id)) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href="/students" label="Total Students" value={students} tone="blue" icon="students" sub={`${classes} class sections`} />
        <Tile href="/staff" label="Total Teachers" value={teachers} tone="orange" icon="staff" sub="Teaching staff" />
        <Tile href="/staff" label="Total Staff" value={teachers + admins} tone="teal" icon="staff" sub={`${teachers} teaching · ${admins} admin`} />
        <Tile href="/classes" label="Total Classes" value={classes} tone="green" icon="classes" sub="Classes × sections" />
        <Tile href="/attendance?view=overall" label={`Today's Attendance`} value={last ? `${last.present}/${last.total}` : "—"} tone="purple" icon="attendance" sub={last ? `${last.total ? Math.round((last.present / last.total) * 1000) / 10 : 0}% · ${last.day}` : "Not marked yet"} />
        <Tile href="/attendance?view=overall" label="Overall Attendance" value={`${attendancePercent(monthAtt)}%`} tone="blue" icon="attendance" sub={monthLabel(month)} />
        <Tile href="/leave" label="Pending Leave Requests" value={pendingLeaves.length} tone="pink" icon="leave" sub="Awaiting approval" />
        <Tile href="/transport" label="Active Buses" value={`${activeBuses}/${buses.length}`} tone="orange" icon="bus" sub="Basic transport" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card card-pad">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">Attendance Overview · last school days</h2>
            <Link href="/attendance?view=overall" className="text-xs font-bold text-[color:var(--brand)]">Overall attendance →</Link>
          </div>
          {trend.length ? <BarsChart data={trend} xKey="day" series={[{ key: "Present", label: "Present", color: "#10b981" }, { key: "Absent", label: "Absent", color: "#f43f5e" }]} /> : <Empty title="No attendance yet" hint="Mark attendance to see the overview." />}
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-2">Students by Class</h2>
          <DonutChart data={classList.map((c) => ({ name: className(c), value: c._count.students }))} centerLabel={{ value: students, caption: "Students" }} />
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="section-title mb-2">Attendance by class & section · {monthLabel(month)}</h2>
        <BarsChart data={perClass} xKey="name" max={100} unit="%" height={230} series={[{ key: "Attendance", label: "Attendance %", color: "#6366f1" }]} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Upcoming Exams</h2><Link href="/marks" className="text-xs font-bold text-[color:var(--brand)]">Exams →</Link></div>
          {exams.length === 0 ? <p className="text-sm text-[color:var(--ink-soft)]">No upcoming exams scheduled.</p> : (
            <ul className="space-y-2">
              {exams.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[color:var(--ink-strong)]">{e.name}</div><div className="text-xs text-[color:var(--ink-soft)]">{fmtDate(e.startDate)} · {examMax(e)} marks</div></div>
                  <Badge color="#7c3aed">Upcoming</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Pending Leave Requests</h2><Link href="/leave" className="text-xs font-bold text-[color:var(--brand)]">Review →</Link></div>
          {pendingLeaves.length === 0 ? <p className="text-sm text-[color:var(--ink-soft)]">No pending requests 🎉</p> : (
            <ul className="space-y-2">
              {pendingLeaves.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[color:var(--ink-strong)]">{l.staff.user.name}</div><div className="text-xs text-[color:var(--ink-soft)]">{LEAVE_TYPES[l.type].label} · {fmtDate(l.fromDate)} · {l.days}d</div></div>
                  <Badge color="#d97706">Pending</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Recent Observations</h2>
            <Link href="/remarks" className="text-xs font-bold text-[color:var(--brand)]">All →</Link>
          </div>
          {recentRemarks.length === 0 ? <p className="text-sm text-[color:var(--ink-soft)]">No remarks recorded yet.</p> : (
            <ul className="space-y-2">
              {recentRemarks.map((r) => (
                <li key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/students/${r.studentId}`} className="truncate text-sm font-bold text-[color:var(--ink-strong)] hover:underline">
                      {r.student.user.name}
                    </Link>
                    <Badge color={r.category === "IMPROVEMENT" ? "#e11d48" : r.category === "ACADEMIC" ? "#2563eb" : "#7c3aed"}>{r.category}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[color:var(--ink-soft)]">{r.remark}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[color:var(--ink-soft)]">
                    <span>{className(r.classRoom)} · {r.author.name}</span>
                    <span>{fmtDate(r.date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Recent Announcements</h2><Link href="/announcements" className="text-xs font-bold text-[color:var(--brand)]">All →</Link></div>
          {anns.length ? <AnnouncementCards items={anns} compact /> : <p className="text-sm text-[color:var(--ink-soft)]">Nothing posted yet.</p>}
        </div>
      </div>

      <div className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Unlock more with Swan Digital Solutions</h2>
          <Link href="/swan-digital" className="text-xs font-bold text-[color:var(--brand)]">Request Unlock →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOCKED_LIST.filter((a) => a.roles.includes("ADMIN")).map((a) => {
            const Icon = ICONS[a.icon] ?? ICONS.lock;
            return (
              <Link key={a.key} href={a.href} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-[color:var(--line)] transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: `color-mix(in srgb, ${a.color} 8%, white)`, color: "var(--ink-strong)" }}>
                <Icon size={15} style={{ color: a.color }} /> {a.title} {!unlocked.has(a.key) && <Lock size={11} className="text-[color:var(--ink-soft)]" />}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- schedule */
async function TodaySchedule({ where, showClass }: { where: { classId?: string; teacherId?: string }; showClass?: boolean }) {
  const day = weekday(todayISO());
  const slots = day === 0 ? [] : await db.timetableSlot.findMany({ where: { ...where, day }, include: { subject: true, classRoom: true, teacher: { include: { user: true } } }, orderBy: { period: "asc" } });
  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Today&apos;s Schedule · {day ? DAYS[day - 1].long : "Sunday"}</h2>
        <Link href="/timetable" className="text-xs font-bold text-[color:var(--brand)]">Timetable →</Link>
      </div>
      {slots.length === 0 ? <p className="text-sm text-[color:var(--ink-soft)]">No classes scheduled today.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {slots.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: `color-mix(in srgb, ${["#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"][i % 6]} 10%, white)` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-extrabold text-[color:var(--brand)] shadow-sm">P{s.period}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[color:var(--ink-strong)]">{s.subject.name}{showClass ? ` · ${className(s.classRoom)}` : ""}</div>
                <div className="flex items-center gap-1 text-xs text-[color:var(--ink-soft)]"><Clock size={11} /> {s.startTime}–{s.endTime} {!showClass && `· ${s.teacher.user.name}`}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- teacher */
async function TeacherDash({ user }: { user: SessionUser }) {
  const staff = user.staff!;
  const today = todayISO();
  const classIds = await teacherClassIds(staff.id);
  const [classes, allocs, approved, marked, anns, recentRemarks] = await Promise.all([
    db.classRoom.findMany({ where: { id: { in: classIds } }, orderBy: [{ grade: "asc" }, { section: "asc" }], include: { _count: { select: { students: true } } } }),
    db.allocation.findMany({ where: { teacherId: staff.id }, include: { subject: true, classRoom: true } }),
    db.leaveRequest.findMany({ where: { staffId: staff.id, status: "APPROVED", fromDate: { gte: toDate(`${today.slice(0, 4)}-01-01`) } } }),
    db.studentAttendance.findMany({ where: { date: toDate(today), classId: { in: classIds } }, distinct: ["classId"], select: { classId: true } }),
    getAnnouncements(user, 3),
    db.studentRemark.findMany({
      where: { classId: { in: classIds } },
      include: { student: { include: { user: true } }, author: true, classRoom: true },
      orderBy: { date: "desc" },
      take: 4,
    }),
  ]);
  const markedSet = new Set(marked.map((m) => m.classId));
  const usedCL = approved.filter((l) => l.type === "CASUAL").reduce((s, l) => s + l.days, 0);
  const students = classes.reduce((s, c) => s + c._count.students, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href="/classes" label="My Classes" value={classes.length} tone="blue" icon="classes" sub={`${students} students`} />
        <Tile href="/classes" label="Subjects Taught" value={new Set(allocs.map((a) => a.subjectId)).size} tone="orange" icon="subjects" sub={`${allocs.length} allocations`} />
        <Tile href="/attendance" label="Attendance Today" value={`${markedSet.size}/${classes.length}`} tone="green" icon="attendance" sub="classes marked" />
        <Tile href="/leave" label="Casual Leave Left" value={LEAVE_TYPES.CASUAL.quota - usedCL} tone="purple" icon="leave" sub={`of ${LEAVE_TYPES.CASUAL.quota} this year`} />
      </div>
      <TodaySchedule where={{ teacherId: staff.id }} showClass />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card card-pad">
          <h2 className="section-title mb-3">Attendance to mark today</h2>
          <ul className="space-y-2">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                <div className="flex-1 text-sm font-bold text-[color:var(--ink-strong)]">{className(c)} <span className="font-normal text-[color:var(--ink-soft)]">· {c._count.students} students</span></div>
                {markedSet.has(c.id) ? <Badge color="#059669">Marked</Badge> : <Link href={`/attendance?class=${c.id}&date=${today}`} className="btn btn-soft btn-sm">Mark <ArrowRight size={14} /></Link>}
              </li>
            ))}
          </ul>
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Class Remarks & PTM</h2>
            <Link href="/remarks" className="text-xs font-bold text-[color:var(--brand)]">All →</Link>
          </div>
          {recentRemarks.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-soft)]">No remarks yet. Add observations for students in your classes.</p>
          ) : (
            <ul className="space-y-2">
              {recentRemarks.map((r) => (
                <li key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/students/${r.studentId}`} className="truncate text-sm font-bold text-[color:var(--ink-strong)] hover:underline">
                      {r.student.user.name}
                    </Link>
                    <Badge color={r.category === "IMPROVEMENT" ? "#e11d48" : r.category === "ACADEMIC" ? "#2563eb" : "#7c3aed"}>{r.category}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[color:var(--ink-soft)]">{r.remark}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[color:var(--ink-soft)]">
                    <span>{className(r.classRoom)}</span>
                    <span>{fmtDate(r.date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Announcements</h2><Link href="/announcements" className="text-xs font-bold text-[color:var(--brand)]">All →</Link></div>
          {anns.length ? <AnnouncementCards items={anns} compact /> : <p className="text-sm text-[color:var(--ink-soft)]">Nothing posted yet.</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- student */
async function StudentDash({ user }: { user: SessionUser }) {
  const st = user.student!;
  const today = todayISO();
  const month = monthStr(today);
  const { from, to } = monthRange(month);
  const [allAtt, exams, anns, bus] = await Promise.all([
    db.studentAttendance.findMany({ where: { studentId: st.id }, orderBy: { date: "asc" } }),
    db.exam.findMany({ where: { published: true }, orderBy: { startDate: "asc" } }),
    getAnnouncements(user, 3),
    st.busId ? db.bus.findUnique({ where: { id: st.busId }, include: { driver: true } }) : Promise.resolve(null),
  ]);
  const thisMonth = allAtt.filter((a) => a.date >= toDate(from) && a.date <= toDate(to));
  const c = attendanceCounts(allAtt);
  const byMonth = new Map<string, { status: string }[]>();
  for (const a of allAtt) byMonth.set(a.date.toISOString().slice(0, 7), [...(byMonth.get(a.date.toISOString().slice(0, 7)) ?? []), a]);
  const monthly = [...byMonth.entries()].map(([m, rows]) => ({ month: monthLabel(m).split(" ")[0].slice(0, 3), Attendance: attendancePercent(rows) }));

  const results = (await Promise.all(exams.map(async (e) => ({ e, r: await examResults(e.id, st.classId) })))).map(({ e, r }) => ({ e, r, me: r?.rows.find((x) => x.studentId === st.id) })).filter((x) => x.me && x.me.outOf > 0);
  const latest = results[results.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href="/attendance" label="Attendance" value={`${c.percent}%`} tone="blue" icon="attendance" sub={`${attendancePercent(thisMonth)}% this month`} />
        <Tile href="/attendance" label="Present Days" value={c.present} tone="green" icon="students" sub="Overall this year" />
        <Tile href="/attendance" label="Absent Days" value={c.absent} tone="pink" icon="attendance" sub={`${c.excused} excused`} />
        <Tile href="/attendance" label="Late Days" value={c.late} tone="orange" icon="timetable" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href="/results" label={latest ? latest.e.name : "Latest Result"} value={latest ? `${latest.me!.percent}%` : "—"} tone="purple" icon="results" sub={latest ? `Grade ${gradeFor(latest.me!.percent).grade}` : "Not available"} />
        <Tile href="/results" label="Class Rank" value={latest?.me?.rank ? `#${latest.me.rank}` : "—"} tone="teal" icon="students" sub={latest ? `of ${latest.r!.rows.length}` : ""} />
        <Tile href="/timetable" label="My Class" value={className(st.classRoom)} tone="green" icon="classes" sub={`Roll no. ${st.rollNo}`} />
        <Tile href="/transport" label="My Bus" value={bus ? bus.busNumber : "—"} tone="blue" icon="bus" sub={bus ? bus.routeName : "Not using school transport"} />
      </div>
      <TodaySchedule where={{ classId: st.classId }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad">
          <div className="mb-2 flex items-center justify-between"><h2 className="section-title">Subject performance{latest ? ` · ${latest.e.name}` : ""}</h2><Link href="/results" className="text-xs font-bold text-[color:var(--brand)]">Full result →</Link></div>
          {latest ? (
            <BarsChart height={230} max={100} unit="%" data={latest.r!.subjects.map((s) => ({ subject: s.code, Percent: Math.round(((latest.me!.marks[s.id]?.total ?? 0) / latest.r!.perSubject) * 1000) / 10 }))} xKey="subject" series={[{ key: "Percent", label: "Percent", color: "#8b5cf6" }]} />
          ) : <Empty title="No results yet" />}
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-2">Exam performance</h2>
          {results.length ? <TrendChart data={results.map((r) => ({ exam: r.e.name, Percent: r.me!.percent }))} xKey="exam" yKey="Percent" label="Percent" unit="%" color="#ec4899" height={230} /> : <Empty title="No exams yet" />}
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-2">Monthly attendance</h2>
          {monthly.length ? <BarsChart data={monthly} xKey="month" max={100} unit="%" height={220} series={[{ key: "Attendance", label: "Attendance %", color: "#06b6d4" }]} /> : <Empty title="No attendance yet" />}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Announcements</h2><Link href="/announcements" className="text-xs font-bold text-[color:var(--brand)]">All →</Link></div>
          {anns.length ? <AnnouncementCards items={anns} compact /> : <p className="text-sm text-[color:var(--ink-soft)]">Nothing posted yet.</p>}
        </div>
      </div>
    </div>
  );
}
