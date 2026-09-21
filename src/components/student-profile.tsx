import Link from "next/link";
import {
  Bus as BusIcon,
  Cake,
  Download,
  Droplet,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { examResults } from "@/lib/results";
import { AnnouncementCards } from "@/components/announcement-list";
import { Avatar, Badge, Tile } from "@/components/ui";
import { TrendChart, BarsChart } from "@/components/charts";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { Legend, MonthCalendar } from "@/components/attendance-views";
import { toggleStudentSubjectAction } from "@/actions/academics";
import { deleteRemarkAction, saveRemarkAction } from "@/actions/remarks";
import {
  ATT_STATUS,
  DAYS,
  attendanceCounts,
  attendancePercent,
  className,
  fmtDate,
  gradeFor,
  monthLabel,
  monthRange,
  monthStr,
  todayISO,
  toDate,
  iso,
  type AttStatus,
} from "@/lib/utils";

const REMARK_CATEGORIES: Record<string, { label: string; color: string }> = {
  ACADEMIC: { label: "Academic Progress", color: "#2563eb" },
  BEHAVIOUR: { label: "Behaviour", color: "#f97316" },
  PARTICIPATION: { label: "Participation", color: "#059669" },
  ATTENDANCE: { label: "Attendance", color: "#0891b2" },
  ACTIVITIES: { label: "Activities & Play", color: "#8b5cf6" },
  STRENGTHS: { label: "Strengths", color: "#10b981" },
  IMPROVEMENT: { label: "Needs Improvement", color: "#e11d48" },
  PTM: { label: "PTM Discussion", color: "#7c3aed" },
  GENERAL: { label: "General Observation", color: "#64748b" },
};

/** Full student 360° profile. Callers MUST have authorised access with canViewStudent() first. */
export async function StudentProfile({ studentId, viewer }: { studentId: string; viewer: SessionUser }) {
  const s = await db.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      academicYear: true,
      subjects: true,
      classRoom: {
        include: {
          classTeacher: { include: { user: true } },
          allocations: {
            include: { subject: true, teacher: { include: { user: true } } },
            orderBy: { subject: { name: "asc" } },
          },
        },
      },
      bus: { include: { driver: true, stops: { orderBy: { sequence: "asc" } } } },
    },
  });
  if (!s) return null;

  const today = todayISO();
  const month = monthStr(today);
  const { from, to } = monthRange(month);
  const isAdmin = viewer.role === "ADMIN";
  const isClassTeacher = viewer.role === "TEACHER" && s.classRoom.classTeacherId === viewer.staff?.id;
  const canAddRemark = isAdmin || isClassTeacher;

  const [att, exams, slots, anns, remarks] = await Promise.all([
    db.studentAttendance.findMany({ where: { studentId }, orderBy: { date: "desc" } }),
    db.exam.findMany({ where: { published: true }, orderBy: { startDate: "asc" } }),
    db.timetableSlot.findMany({ where: { classId: s.classId }, include: { subject: true, teacher: { include: { user: true } } } }),
    db.announcement.findMany({
      where: {
        publishDate: { lte: toDate(today) },
        AND: [
          { OR: [{ expiryDate: null }, { expiryDate: { gte: toDate(today) } }] },
          {
            OR: [
              { audience: { in: ["ALL", "STUDENTS"] } },
              { audience: { in: ["CLASSES", "SECTIONS"] }, targets: { some: { classId: s.classId } } },
            ],
          },
        ],
      },
      orderBy: { publishDate: "desc" },
      take: 4,
      include: { author: true, targets: { include: { classRoom: true } } },
    }),
    db.studentRemark.findMany({
      where: { studentId },
      include: { author: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const results = (
    await Promise.all(exams.map(async (e) => ({ e, r: await examResults(e.id, s.classId) })))
  )
    .map(({ e, r }) => ({ e, r, me: r?.rows.find((x) => x.studentId === studentId) }))
    .filter((x) => x.me && x.me.outOf > 0);
  const latest = results[results.length - 1];

  const c = attendanceCounts(att);
  const monthRows = att.filter((a) => a.date >= toDate(from) && a.date <= toDate(to));
  const byMonth = new Map<string, { status: string }[]>();
  for (const a of att) {
    const m = a.date.toISOString().slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), a]);
  }
  const monthly = [...byMonth.entries()].sort().map(([m, rows]) => ({
    month: monthLabel(m).slice(0, 3),
    Attendance: attendancePercent(rows),
  }));
  const enrolled = new Set(s.subjects.map((x) => x.subjectId));

  const info: [typeof Cake, string, string][] = [
    [Cake, "Date of birth", fmtDate(s.dob)],
    [UserRound, "Gender", s.gender === "M" ? "Male" : "Female"],
    [Droplet, "Blood group", s.bloodGroup ?? "—"],
    [Phone, "Phone", s.user.phone ?? "—"],
    [Mail, "Email", s.user.email],
    [UserRound, "Parent / guardian", s.guardianName],
    [Phone, "Guardian phone", s.guardianPhone],
    [MapPin, "Address", s.address || "—"],
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header & Identity */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-6" style={{ background: "var(--grad)" }}>
          <Avatar name={s.user.name} seed={s.user.email} size={84} photo={s.photoData} />
          <div className="min-w-0 flex-1 text-white">
            <h1 className="text-2xl font-extrabold !text-white">{s.user.name}</h1>
            <div className="flex flex-wrap gap-2 pt-2">
              {[`Class ${className(s.classRoom)}`, `Roll ${s.rollNo}`, `Adm. ${s.admissionNo}`, s.academicYear.name, s.user.active ? "Active" : "Inactive"].map((t) => (
                <span key={t} className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          {canAddRemark && (
            <Modal
              title={`Add Remark / PTM Note for ${s.user.name}`}
              wide
              trigger={<button className="btn btn-sm bg-white/20 text-white hover:bg-white/30"><Plus size={14} /> Add Remark</button>}
            >
              <ActionForm action={saveRemarkAction.bind(null, s.id, null)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category" name="category">
                    <select id="category" name="category" className="select" defaultValue="PTM" required>
                      {Object.entries(REMARK_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Observation date" name="date">
                    <input id="date" name="date" type="date" className="input" defaultValue={today} max={today} required />
                  </Field>
                </div>
                <Field label="Remark / Discussion note" name="remark" hint="Visible to Admin and useful during Parent-Teacher Meetings">
                  <textarea id="remark" name="remark" className="textarea" rows={4} placeholder="Note progress, participation, strengths, or areas needing attention…" required />
                </Field>
                <div className="flex justify-end"><SubmitButton>Save remark</SubmitButton></div>
              </ActionForm>
            </Modal>
          )}
        </div>
        <div className="grid gap-px bg-[color:var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([Icon, k, v]) => (
            <div key={k} className="flex items-start gap-2 bg-white p-4">
              <Icon size={16} className="mt-0.5 shrink-0 text-[color:var(--brand)]" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">{k}</div>
                <div className="break-words text-sm font-semibold text-[color:var(--ink-strong)]">{v}</div>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2 bg-white p-4">
            <Cake size={16} className="mt-0.5 shrink-0 text-[color:var(--brand)]" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">Admission date</div>
              <div className="text-sm font-semibold text-[color:var(--ink-strong)]">{fmtDate(s.admissionDate)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Parent-Teacher Meeting (PTM) 360° Summary Card */}
      <div className="card card-pad border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-pink-50/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-purple-600" />
            <h2 className="text-lg font-extrabold text-[color:var(--ink-strong)]">Parent-Teacher Meeting (PTM) 360° Overview</h2>
          </div>
          <Badge color="#7c3aed">PTM Helper</Badge>
        </div>
        <p className="text-xs text-[color:var(--ink-soft)] mb-4">
          Consolidated student standing for discussions with parents: Attendance reliability, overall academic performance, and qualitative teacher observations.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-purple-100">
            <div className="text-xs font-bold uppercase text-[color:var(--ink-soft)]">Attendance Standing</div>
            <div className="mt-1 text-2xl font-black text-emerald-600">{c.percent}%</div>
            <div className="text-xs text-[color:var(--ink-soft)] mt-0.5">{c.present} days present of {c.total} working days ({c.absent} absent)</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-purple-100">
            <div className="text-xs font-bold uppercase text-[color:var(--ink-soft)]">Academic Performance</div>
            <div className="mt-1 text-2xl font-black text-blue-600">
              {latest ? `${latest.me!.percent}% · ${latest.me!.grade}` : "—"}
            </div>
            <div className="text-xs text-[color:var(--ink-soft)] mt-0.5">
              {latest ? `${latest.e.name} (${latest.me!.total}/${latest.me!.outOf} marks)` : "No exam marks recorded yet"}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-purple-100">
            <div className="text-xs font-bold uppercase text-[color:var(--ink-soft)]">Teacher Remarks</div>
            <div className="mt-1 text-2xl font-black text-purple-700">{remarks.length}</div>
            <div className="text-xs text-[color:var(--ink-soft)] mt-0.5">
              {remarks.length ? `Latest: ${fmtDate(remarks[0].date)}` : "No remarks entered yet"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Student Remarks & Observations Section */}
      <div className="card card-pad">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Teacher Remarks & Observations ({remarks.length})</h2>
            <p className="text-xs text-[color:var(--ink-soft)]">Tracked remarks on academic progress, behaviour, number/letter skills, and parent discussions.</p>
          </div>
          {canAddRemark && (
            <Modal
              title={`Add Remark for ${s.user.name}`}
              wide
              trigger={<button className="btn btn-soft btn-sm"><Plus size={14} /> Add remark</button>}
            >
              <ActionForm action={saveRemarkAction.bind(null, s.id, null)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category" name="category">
                    <select id="category" name="category" className="select" defaultValue="ACADEMIC" required>
                      {Object.entries(REMARK_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date" name="date">
                    <input id="date" name="date" type="date" className="input" defaultValue={today} max={today} required />
                  </Field>
                </div>
                <Field label="Remark / Observation text" name="remark">
                  <textarea id="remark" name="remark" className="textarea" rows={3} placeholder="Observations, achievements, or areas needing attention…" required />
                </Field>
                <div className="flex justify-end"><SubmitButton>Save remark</SubmitButton></div>
              </ActionForm>
            </Modal>
          )}
        </div>

        {remarks.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-soft)] italic">No teacher remarks recorded for this student yet.</p>
        ) : (
          <div className="space-y-3">
            {remarks.map((r) => {
              const cat = REMARK_CATEGORIES[r.category] ?? REMARK_CATEGORIES.GENERAL;
              const canDelete = isAdmin || r.authorId === viewer.id;
              return (
                <div key={r.id} className="rounded-xl border border-[color:var(--line)] bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge color={cat.color}>{cat.label}</Badge>
                      <span className="text-xs font-semibold text-[color:var(--ink-soft)]">
                        {fmtDate(r.date)} · by <b>{r.author.name}</b>
                      </span>
                    </div>
                    {canDelete && (
                      <ConfirmButton
                        className="btn btn-ghost btn-sm text-rose-600"
                        title="Delete remark"
                        confirm="Delete this remark?"
                        action={deleteRemarkAction.bind(null, r.id)}
                      >
                        <Trash2 size={13} />
                      </ConfirmButton>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--ink-strong)]">{r.remark}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Class information */}
      <div className="card card-pad">
        <h2 className="section-title mb-3">Class information</h2>
        <div className="mb-4 grid gap-3 text-sm sm:grid-cols-4">
          {[
            ["Class", s.classRoom.grade],
            ["Section", s.classRoom.section],
            ["Academic year", s.academicYear.name],
            ["Class teacher", s.classRoom.classTeacher?.user.name ?? "Not assigned"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-[color:var(--brand2-soft)] p-3">
              <div className="text-[11px] font-bold uppercase text-[color:var(--ink-soft)]">{k}</div>
              <div className="font-bold text-[color:var(--ink-strong)]">{v}</div>
            </div>
          ))}
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">
          Subjects{isAdmin && " (click to assign / remove)"}
        </div>
        <div className="flex flex-wrap gap-2">
          {s.classRoom.allocations.map((a) => {
            const on = enrolled.has(a.subjectId);
            const chip = (
              <span className="inline-flex items-center gap-1.5">
                {a.subject.name} <span className="opacity-70">· {a.teacher.user.name.split(" ")[0]}</span>
              </span>
            );
            return isAdmin ? (
              <ConfirmButton
                key={a.id}
                className={`btn btn-sm ${on ? "btn-soft" : "btn-ghost opacity-60"}`}
                title={on ? "Enrolled — click to remove" : "Not enrolled — click to assign"}
                action={toggleStudentSubjectAction.bind(null, s.id, a.subjectId)}
              >
                {chip}
              </ConfirmButton>
            ) : (
              <Badge key={a.id} color={on ? "#7c3aed" : "#6b6ea6"}>
                {a.subject.name}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* 5. Attendance History & Analytics */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold">Attendance</h2>
          <a className="btn btn-ghost btn-sm ml-auto" href={`/reports/export?type=student_attendance&student=${s.id}`}>
            <Download size={14} /> Download attendance report
          </a>
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Attendance" value={`${c.percent}%`} tone="blue" icon="attendance" sub={`${attendancePercent(monthRows)}% this month`} />
          <Tile label="Present days" value={c.present} tone="green" icon="students" />
          <Tile label="Absent days" value={c.absent} tone="pink" icon="attendance" sub={`${c.excused} excused`} />
          <Tile label="Late days" value={c.late} tone="orange" icon="timetable" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card card-pad">
            <h3 className="section-title mb-3">{monthLabel(month)}</h3>
            <MonthCalendar month={month} records={monthRows} />
            <div className="mt-4"><Legend /></div>
          </div>
          <div className="space-y-6">
            <div className="card card-pad">
              <h3 className="section-title mb-2">Monthly attendance</h3>
              <BarsChart data={monthly} xKey="month" max={100} unit="%" height={200} series={[{ key: "Attendance", label: "Attendance %", color: "#06b6d4" }]} />
            </div>
            <div className="card card-pad">
              <h3 className="section-title mb-2">History</h3>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {att.slice(0, 40).map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-[color:var(--line)]">
                    <span className="font-semibold">{fmtDate(a.date, { weekday: "short" })}</span>
                    <Badge color={ATT_STATUS[a.status as AttStatus].color}>{ATT_STATUS[a.status as AttStatus].label}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Marks & Academic Results */}
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="section-title">Marks & results</h2>
          {results.length > 0 && (
            <Link href={`/results/report-card/${s.id}?exam=${latest.e.id}`} className="btn btn-soft btn-sm ml-auto">
              <FileText size={14} /> Report card
            </Link>
          )}
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-soft)]">No marks recorded yet.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.e.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-[color:var(--line)]">
                  <b className="flex-1 text-[color:var(--ink-strong)]">{r.e.name}</b>
                  <span>{r.me!.total}/{r.me!.outOf}</span>
                  <span>{r.me!.percent}%</span>
                  <Badge color={gradeFor(r.me!.percent).color}>{r.me!.grade}</Badge>
                  <Badge color={r.me!.pass ? "#059669" : "#e11d48"}>{r.me!.pass ? "Pass" : "Fail"}</Badge>
                </div>
              ))}
              <TrendChart data={results.map((r) => ({ exam: r.e.name, Percent: r.me!.percent }))} xKey="exam" yKey="Percent" label="Percent" unit="%" color="#ec4899" height={170} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{latest.e.name}</th>
                    <th>Internal</th>
                    <th>Theory</th>
                    <th>Total</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.r!.subjects.map((sub) => {
                    const m = latest.me!.marks[sub.id];
                    return (
                      <tr key={sub.id}>
                        <td className="font-bold">{sub.name}</td>
                        <td>{m ? `${m.internal}/${latest.e.maxInternal}` : "—"}</td>
                        <td>{m ? `${m.theory}/${latest.e.maxTheory}` : "—"}</td>
                        <td>{m ? `${m.total}/${latest.r!.perSubject}` : "—"}</td>
                        <td>
                          {m ? (
                            <Badge color={gradeFor((m.total / latest.r!.perSubject) * 100).color}>
                              {gradeFor((m.total / latest.r!.perSubject) * 100).grade}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 7. Class Timetable */}
      <div className="card card-pad">
        <h2 className="section-title mb-3">Class timetable</h2>
        <div className="table-wrap">
          <table className="table text-center">
            <thead>
              <tr>
                <th>Period</th>
                {DAYS.map((d) => (
                  <th key={d.n} className="!text-center">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((p) => (
                <tr key={p}>
                  <td className="font-bold">P{p}</td>
                  {DAYS.map((d) => {
                    const sl = slots.find((x) => x.day === d.n && x.period === p);
                    return (
                      <td key={d.n} className="!px-2 text-xs">
                        {sl ? (
                          <>
                            <b>{sl.subject.code}</b>
                            <div className="text-[color:var(--ink-soft)]">{sl.startTime}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Announcements & Transport */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad">
          <h2 className="section-title mb-3">Announcements</h2>
          {anns.length ? (
            <AnnouncementCards
              compact
              items={anns.map((a) => ({
                id: a.id,
                title: a.title,
                body: a.body,
                audience: a.audience,
                priority: a.priority,
                createdAt: a.createdAt,
                authorName: a.author.name,
                authorId: a.authorId,
                expiryDate: a.expiryDate,
                classes: a.targets.map((t) => className(t.classRoom)),
              }))}
            />
          ) : (
            <p className="text-sm text-[color:var(--ink-soft)]">No announcements for this student.</p>
          )}
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <BusIcon size={18} /> Transport
          </h2>
          {!s.bus ? (
            <p className="text-sm text-[color:var(--ink-soft)]">Does not use school transport.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {[
                ["Bus", `${s.bus.busNumber} (${s.bus.registrationNo})`],
                ["Driver", s.bus.driver ? `${s.bus.driver.name} · ${s.bus.driver.phone}` : "Not assigned"],
                ["Route", s.bus.routeName],
                ["Departure", s.bus.departureTime],
                ["Arrival at school", s.bus.arrivalTime],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-dashed border-[color:var(--line)] pb-1.5">
                  <span className="font-semibold text-[color:var(--ink-soft)]">{k}</span>
                  <span className="font-bold text-[color:var(--ink-strong)]">{v}</span>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {s.bus.stops.map((st) => (
                  <Badge key={st.id} color={st.id === s.busStopId ? "#e11d48" : "#0d9488"}>
                    {st.sequence}. {st.name} · {st.pickupTime}
                    {st.id === s.busStopId ? " ★" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <span className="hidden">{iso(new Date())}</span>
    </div>
  );
}
