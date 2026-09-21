import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { Empty, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { PrintButton } from "@/components/print-button";
import { clearSlotAction, saveSlotAction } from "@/actions/timetable";
import { DAYS, PERIODS, className } from "@/lib/utils";

export const metadata = { title: "Timetable" };

const COLORS = ["#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#eab308", "#f43f5e"];
const BREAKS: Record<number, string> = { 2: "Short break · 10:00 – 10:15", 4: "Lunch break · 11:45 – 12:30" };

type Slot = {
  id: string; classId: string; day: number; period: number; subjectId: string; room: string | null; startTime: string; endTime: string;
  subject: { name: string; code: string }; teacher: { id: string; user: { name: string } }; classRoom: { grade: string; section: string };
};

interface SP { class?: string; view?: string; teacher?: string }

export default async function TimetablePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "timetable");
  const sp = await searchParams;
  const include = { subject: true, teacher: { include: { user: true } }, classRoom: true } as const;

  if (user.role === "STUDENT") {
    const slots = await db.timetableSlot.findMany({ where: { classId: user.student!.classId }, include });
    return (
      <div>
        <PageHeader title="Timetable" subtitle={`Weekly timetable · ${className(user.student!.classRoom)}`} icon="timetable" color="linear-gradient(135deg,#6366f1,#8b5cf6)" actions={<PrintButton />} />
        <Grid slots={slots} mode="class" />
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN";
  const classes = await visibleClasses(user);
  const view = sp.view === "teacher" || (!isAdmin && sp.view !== "class") ? "teacher" : "class";
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];

  const teachers = isAdmin ? await db.staff.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }) : [];
  const teacherId = isAdmin ? (sp.teacher ?? teachers[0]?.id) : user.staff!.id;
  const teacherName = isAdmin ? teachers.find((t) => t.id === teacherId)?.user.name : "My schedule";

  return (
    <div>
      <PageHeader title="Timetable" subtitle={isAdmin ? "Manage class, section, day, period, subject, teacher, time and room — teacher and class clashes are blocked" : "Your weekly schedule and the timetables of your classes"} icon="timetable" color="linear-gradient(135deg,#6366f1,#8b5cf6)" actions={<PrintButton />} />
      <div className="no-print mb-5 flex flex-wrap gap-2">
        <Link href={`/timetable?view=class${cls ? `&class=${cls.id}` : ""}`} className={`btn ${view === "class" ? "btn-primary" : "btn-ghost"}`}>{isAdmin ? "Class timetable" : "Class timetables"}</Link>
        <Link href="/timetable?view=teacher" className={`btn ${view === "teacher" ? "btn-primary" : "btn-ghost"}`}>{isAdmin ? "Teacher timetable" : "My schedule"}</Link>
      </div>

      {view === "class" ? (
        cls ? <ClassView user={user} classes={classes} cls={cls} include={include} /> : <Empty title="No classes available" />
      ) : teacherId ? (
        <TeacherView teacherId={teacherId} teachers={teachers} name={teacherName ?? ""} isAdmin={isAdmin} include={include} />
      ) : <Empty title="No teachers" />}
    </div>
  );
}

async function ClassView({ user, classes, cls, include }: { user: SessionUser; classes: { id: string; grade: string; section: string }[]; cls: { id: string; grade: string; section: string }; include: { subject: true; teacher: { include: { user: true } }; classRoom: true } }) {
  const [slots, allocs] = await Promise.all([
    db.timetableSlot.findMany({ where: { classId: cls.id }, include }),
    db.allocation.findMany({ where: { classId: cls.id, ...(user.role === "TEACHER" ? { teacherId: user.staff!.id } : {}) }, include: { subject: true, teacher: { include: { user: true } } }, orderBy: { subject: { name: "asc" } } }),
  ]);
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        {classes.map((c) => <Link key={c.id} href={`/timetable?view=class&class=${c.id}`} className={`btn btn-sm ${c.id === cls.id ? "btn-soft !border-[color:var(--brand)]" : "btn-ghost"}`}>{className(c)}</Link>)}
      </div>
      <h2 className="section-title">{className(cls)} · weekly timetable</h2>
      {user.role === "TEACHER" && <p className="no-print text-xs text-[color:var(--ink-soft)]">You can add or clear periods for the subjects you teach. Empty cells marked + are free to schedule.</p>}
      <Grid
        slots={slots}
        mode="class"
        edit={{ classId: cls.id, canEditSlot: (s) => user.role === "ADMIN" || (!s || s.teacher.id === user.staff?.id), options: allocs.map((a) => ({ id: a.subjectId, label: `${a.subject.name} — ${a.teacher.user.name}` })) }}
      />
    </div>
  );
}

async function TeacherView({ teacherId, teachers, name, isAdmin, include }: { teacherId: string; teachers: { id: string; user: { name: string } }[]; name: string; isAdmin: boolean; include: { subject: true; teacher: { include: { user: true } }; classRoom: true } }) {
  const slots = await db.timetableSlot.findMany({ where: { teacherId }, include });
  const perWeek = slots.length;
  return (
    <div className="space-y-4">
      {isAdmin && (
        <form className="no-print flex items-end gap-2" action="/timetable">
          <input type="hidden" name="view" value="teacher" />
          <div className="w-64"><label className="label" htmlFor="teacher">Teacher</label>
            <select id="teacher" name="teacher" defaultValue={teacherId} className="select">{teachers.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}</select></div>
          <button className="btn btn-soft">Show</button>
        </form>
      )}
      <h2 className="section-title">{name} · {perWeek} periods a week</h2>
      <Grid slots={slots} mode="teacher" />
    </div>
  );
}

function Grid({ slots, mode, edit }: {
  slots: Slot[];
  mode: "class" | "teacher";
  edit?: { classId: string; canEditSlot: (s?: Slot) => boolean; options: { id: string; label: string }[] };
}) {
  const subjectColor = (id: string) => COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % COLORS.length];
  const find = (day: number, period: number) => slots.find((s) => s.day === day && s.period === period);

  return (
    <div className="card table-wrap p-2">
      <table className="w-full min-w-[820px] border-separate border-spacing-1.5 text-sm">
        <thead>
          <tr>
            <th className="w-28 rounded-xl p-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">Period</th>
            {DAYS.map((d) => <th key={d.n} className="rounded-xl p-2 text-center text-xs font-extrabold uppercase tracking-wider text-white" style={{ background: "var(--grad)" }}>{d.long}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <RowGroup key={p.n} brk={BREAKS[p.n - 1]}>
              <tr>
                <td className="rounded-xl bg-white p-2 ring-1 ring-[color:var(--line)]">
                  <div className="font-extrabold text-[color:var(--ink-strong)]">Period {p.n}</div>
                  <div className="text-[11px] text-[color:var(--ink-soft)]">{p.time}</div>
                </td>
                {DAYS.map((d) => {
                  const s = find(d.n, p.n);
                  const saturdayOff = d.n === 6 && p.n > 4 && !s && !edit;
                  const content = s ? (
                    <div className="h-full rounded-xl p-2 text-left" style={{ background: `color-mix(in srgb, ${subjectColor(s.subjectId)} 14%, white)`, borderLeft: `4px solid ${subjectColor(s.subjectId)}` }}>
                      <div className="font-bold text-[color:var(--ink-strong)]">{s.subject.name}</div>
                      <div className="text-[11px] text-[color:var(--ink-soft)]">{mode === "teacher" ? `Class ${className(s.classRoom)}` : s.teacher.user.name}{s.room ? ` · ${s.room}` : ""}</div>
                      <div className="text-[11px] font-semibold" style={{ color: subjectColor(s.subjectId) }}>{s.startTime}–{s.endTime}</div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-14 items-center justify-center rounded-xl text-xs text-[color:var(--line)]">{edit ? <Plus size={16} /> : saturdayOff ? "" : "—"}</div>
                  );
                  return (
                    <td key={d.n} className="h-16 align-top">
                      {edit && edit.canEditSlot(s) ? (
                        <Modal title={`${DAYS[d.n - 1].long} · Period ${p.n}`} trigger={<button className="block h-full w-full text-left transition hover:scale-[1.02]" aria-label={`Edit ${d.long} period ${p.n}`}>{content}</button>}>
                          <ActionForm action={saveSlotAction.bind(null, edit.classId, d.n, p.n)}>
                            <Field label="Subject & teacher" name="subjectId">
                              <select id="subjectId" name="subjectId" className="select" defaultValue={s?.subjectId ?? ""} required>
                                <option value="" disabled>Choose…</option>
                                {edit.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                              </select>
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field label="Start time" name="startTime"><input id="startTime" name="startTime" type="time" className="input" defaultValue={s?.startTime ?? p.time.split(" – ")[0]} required /></Field>
                              <Field label="End time" name="endTime"><input id="endTime" name="endTime" type="time" className="input" defaultValue={s?.endTime ?? p.time.split(" – ")[1]} required /></Field>
                            </div>
                            <Field label="Room (optional)" name="room"><input id="room" name="room" className="input" defaultValue={s?.room ?? ""} maxLength={20} /></Field>
                            <div className="flex justify-between">
                              {s ? <ConfirmButton action={clearSlotAction.bind(null, edit.classId, d.n, p.n)} confirm="Clear this period?">Clear period</ConfirmButton> : <span />}
                              <SubmitButton>Save period</SubmitButton>
                            </div>
                          </ActionForm>
                        </Modal>
                      ) : content}
                    </td>
                  );
                })}
              </tr>
            </RowGroup>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({ brk, children }: { brk?: string; children: React.ReactNode }) {
  return (
    <>
      {brk && (
        <tr>
          <td colSpan={DAYS.length + 1} className="rounded-xl bg-amber-50 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-amber-600">{brk}</td>
        </tr>
      )}
      {children}
    </>
  );
}
