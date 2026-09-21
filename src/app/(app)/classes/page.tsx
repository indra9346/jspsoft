import Link from "next/link";
import { CalendarCheck, CalendarRange, CheckCircle2, ClipboardEdit, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { teacherClassIds } from "@/lib/access";
import { getCurrentYear } from "@/lib/school";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { createClassAction, deleteAcademicYearAction, deleteClassAction, saveAcademicYearAction, saveClassAction, setCurrentYearAction } from "@/actions/academics";
import { className, fmtDate } from "@/lib/utils";

export const metadata = { title: "Classes & Academic Years" };

const COLORS = ["#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#eab308", "#f43f5e"];

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requireUser(["ADMIN", "TEACHER"], "classes");
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;
  const [years, cur] = await Promise.all([db.academicYear.findMany({ orderBy: { name: "desc" }, include: { _count: { select: { classes: true, students: true } } } }), getCurrentYear()]);
  const yearId = years.find((y) => y.id === sp.year)?.id ?? cur?.id;
  const ids = isAdmin ? undefined : await teacherClassIds(user.staff!.id);

  const [classes, teachers] = await Promise.all([
    db.classRoom.findMany({
      where: { ...(ids ? { id: { in: ids } } : {}), ...(isAdmin && yearId ? { academicYearId: yearId } : {}) },
      include: {
        classTeacher: { include: { user: true } }, academicYear: true, _count: { select: { students: true } },
        allocations: { include: { subject: true, teacher: { include: { user: true } } }, orderBy: { subject: { name: "asc" } } },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }],
    }),
    isAdmin ? db.staff.findMany({ where: { staffType: "TEACHING" }, include: { user: true }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
  ]);

  const editForm = (c: (typeof classes)[number]) => (
    <ActionForm action={saveClassAction.bind(null, c.id)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class" name="grade"><input id="grade" name="grade" className="input" defaultValue={c.grade} required /></Field>
        <Field label="Section" name="section"><input id="section" name="section" className="input" maxLength={3} defaultValue={c.section} required /></Field>
      </div>
      <Field label="Class teacher" name="classTeacherId">
        <select id="classTeacherId" name="classTeacherId" className="select" defaultValue={c.classTeacherId ?? ""}>
          <option value="">— Not assigned —</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}
        </select>
      </Field>
      <div className="flex justify-end"><SubmitButton>Save changes</SubmitButton></div>
    </ActionForm>
  );

  const grades = [...new Set(classes.map((c) => c.grade))];

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Classes, Sections & Academic Years" : "My Classes & Subjects"}
        subtitle={isAdmin ? `${classes.length} sections in the selected academic year` : "Classes, sections and subjects assigned to you"}
        icon="classes" color="linear-gradient(135deg,#10b981,#84cc16)"
        actions={isAdmin && (
          <Modal title="Add class with sections" trigger={<button className="btn btn-primary"><Plus size={16} /> Add class</button>}>
            <ActionForm action={createClassAction}>
              <Field label="Academic year" name="academicYearId">
                <select id="academicYearId" name="academicYearId" className="select" defaultValue={yearId} required>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Class" name="grade"><input id="grade" name="grade" className="input" placeholder="e.g. Class 10" required /></Field>
                <Field label="Sections" name="sections" hint="Separate with commas — e.g. A, B, C"><input id="sections" name="sections" className="input" placeholder="A, B" required /></Field>
              </div>
              <div className="flex justify-end"><SubmitButton>Create sections</SubmitButton></div>
            </ActionForm>
          </Modal>
        )}
      />

      {isAdmin && (
        <div className="card card-pad mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="section-title flex items-center gap-2"><CalendarRange size={18} /> Academic years</h2>
            <Modal title="New academic year" trigger={<button className="btn btn-soft btn-sm ml-auto"><Plus size={14} /> Add year</button>}>
              <ActionForm action={saveAcademicYearAction}>
                <Field label="Name" name="name" hint="Format 2027-2028"><input id="name" name="name" className="input" placeholder="2027-2028" required /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starts" name="startDate"><input id="startDate" name="startDate" type="date" className="input" required /></Field>
                  <Field label="Ends" name="endDate"><input id="endDate" name="endDate" type="date" className="input" required /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isCurrent" /> Make this the current academic year</label>
                <div className="flex justify-end"><SubmitButton>Create year</SubmitButton></div>
              </ActionForm>
            </Modal>
          </div>
          <div className="flex flex-wrap gap-3">
            {years.map((y) => (
              <div key={y.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${y.id === yearId ? "bg-[color:var(--brand-soft)] ring-[color:var(--brand)]" : "bg-white ring-[color:var(--line)]"}`}>
                <Link href={`/classes?year=${y.id}`} className="min-w-0">
                  <div className="flex items-center gap-2 font-extrabold text-[color:var(--ink-strong)]">{y.name} {y.isCurrent && <Badge color="#059669"><CheckCircle2 size={11} /> Current</Badge>}</div>
                  <div className="text-xs text-[color:var(--ink-soft)]">{fmtDate(y.startDate)} – {fmtDate(y.endDate)} · {y._count.classes} sections · {y._count.students} students</div>
                </Link>
                {!y.isCurrent && <ConfirmButton className="btn btn-ghost btn-sm" action={setCurrentYearAction.bind(null, y.id)}>Set current</ConfirmButton>}
                {!y.isCurrent && !y._count.classes && <ConfirmButton confirm={`Delete ${y.name}?`} action={deleteAcademicYearAction.bind(null, y.id)}><Trash2 size={13} /></ConfirmButton>}
              </div>
            ))}
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <Empty title="No classes yet" hint={isAdmin ? "Create your first class with its sections to get started." : "You have not been assigned any classes yet. Ask the admin to allocate you."} />
      ) : (
        <div className="space-y-6">
          {grades.map((g) => (
            <div key={g}>
              <h3 className="mb-3 text-lg font-extrabold">{g}</h3>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {classes.filter((c) => c.grade === g).map((c, i) => {
                  const color = COLORS[(grades.indexOf(g) + i) % COLORS.length];
                  const mine = user.staff ? c.allocations.filter((a) => a.teacherId === user.staff!.id) : [];
                  return (
                    <div key={c.id} className="card overflow-hidden">
                      <div className="flex items-center gap-3 p-4 text-white" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #ec4899))` }}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/25 text-lg font-extrabold">{c.section}</div>
                        <div className="flex-1"><div className="text-lg font-extrabold">Class {className(c)}</div><div className="flex items-center gap-1 text-xs text-white/90"><Users size={12} /> {c._count.students} students · {c.academicYear.name}</div></div>
                        {isAdmin && (
                          <div className="flex gap-1.5">
                            <Modal title="Edit section" trigger={<button className="btn btn-sm bg-white/25 text-white hover:bg-white/40"><Pencil size={14} /></button>}>{editForm(c)}</Modal>
                            <ConfirmButton className="btn btn-sm bg-white/25 text-white hover:bg-white/40" confirm={`Delete ${className(c)}?`} action={deleteClassAction.bind(null, c.id)}><Trash2 size={14} /></ConfirmButton>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex items-center gap-2 text-sm"><UserRound size={15} className="text-[color:var(--ink-soft)]" /><span className="text-[color:var(--ink-soft)]">Class teacher:</span><b className="text-[color:var(--ink-strong)]">{c.classTeacher?.user.name ?? "Not assigned"}</b></div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.allocations.length === 0 && <span className="text-xs text-[color:var(--ink-soft)]">No subjects allocated</span>}
                          {c.allocations.map((a) => (
                            <Badge key={a.id} color={mine.some((m) => m.id === a.id) ? "#059669" : "#7c3aed"}>{a.subject.name}{isAdmin ? ` · ${a.teacher.user.name.split(" ")[0]}` : mine.some((m) => m.id === a.id) ? " ✓" : ""}</Badge>
                          ))}
                        </div>
                        {!isAdmin && (
                          <div className="flex gap-2 pt-1">
                            <Link href={`/attendance?class=${c.id}`} className="btn btn-soft btn-sm"><CalendarCheck size={14} /> Attendance</Link>
                            <Link href={`/marks?class=${c.id}`} className="btn btn-ghost btn-sm"><ClipboardEdit size={14} /> Marks</Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
