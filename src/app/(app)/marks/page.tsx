import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { getCurrentYear } from "@/lib/school";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { MarksGrid } from "@/components/marks-grid";
import { deleteExamAction, saveExamAction } from "@/actions/academics";
import { saveMarksAction } from "@/actions/marks";
import { avatarColor, className, examMax, fmtDate, initials, iso, todayISO } from "@/lib/utils";

export const metadata = { title: "Marks & Exams" };

export default async function MarksPage({ searchParams }: { searchParams: Promise<{ exam?: string; class?: string; subject?: string }> }) {
  const user = await requireUser(["ADMIN", "TEACHER"], "marks");
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;
  const [exams, classes, years, curYear] = await Promise.all([db.exam.findMany({ orderBy: { startDate: "desc" }, include: { academicYear: true } }), visibleClasses(user), db.academicYear.findMany({ orderBy: { name: "desc" } }), getCurrentYear()]);
  const exam = exams.find((e) => e.id === sp.exam) ?? exams.find((e) => e.startDate <= new Date()) ?? exams[0];
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];

  // A teacher sees all subjects in their assigned section if they are the class teacher, or only their allocated subjects.
  const isClassTeacher = Boolean(cls && user.role === "TEACHER" && cls.classTeacherId === user.staff?.id);
  const allocs = cls
    ? await db.allocation.findMany({
        where: { classId: cls.id, ...(isAdmin || isClassTeacher ? {} : { teacherId: user.staff!.id }) },
        include: { subject: true, teacher: { include: { user: true } } },
        orderBy: { subject: { name: "asc" } },
      })
    : [];
  const alloc = allocs.find((a) => a.subjectId === sp.subject) ?? allocs[0];

  const [students, marks] = exam && cls && alloc
    ? await Promise.all([
        db.student.findMany({ where: { classId: cls.id, subjects: { some: { subjectId: alloc.subjectId } } }, include: { user: true }, orderBy: { rollNo: "asc" } }),
        db.mark.findMany({ where: { examId: exam.id, subjectId: alloc.subjectId, student: { classId: cls.id } } }),
      ])
    : [[], []];
  const markBy = new Map(marks.map((m) => [m.studentId, m]));

  const link = (p: Partial<{ exam: string; class: string; subject: string }>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ exam: exam?.id, class: cls?.id, subject: undefined as string | undefined, ...p })) if (v) u.set(k, v);
    return `/marks?${u}`;
  };

  const examForm = (e?: (typeof exams)[number]) => (
    <ActionForm action={saveExamAction.bind(null, e?.id ?? null)}>
      <Field label="Exam name" name="name"><input id="name" name="name" className="input" placeholder="e.g. Half-Yearly Exam" defaultValue={e?.name} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" name="startDate"><input id="startDate" name="startDate" type="date" className="input" defaultValue={e ? iso(e.startDate) : todayISO()} required /></Field>
        <Field label="Academic year" name="academicYearId">
          <select id="academicYearId" name="academicYearId" className="select" defaultValue={e?.academicYearId ?? curYear?.id} required>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
        </Field>
        <Field label="Max internal marks" name="maxInternal"><input id="maxInternal" name="maxInternal" type="number" min={0} className="input" defaultValue={e?.maxInternal ?? 20} required /></Field>
        <Field label="Max theory marks" name="maxTheory"><input id="maxTheory" name="maxTheory" type="number" min={1} className="input" defaultValue={e?.maxTheory ?? 80} required /></Field>
      </div>
      <p className="text-xs text-[color:var(--ink-soft)]">Total per subject = internal + theory (default 20 + 80 = 100).</p>
      <div className="flex justify-end"><SubmitButton>{e ? "Save changes" : "Create exam"}</SubmitButton></div>
    </ActionForm>
  );

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Marks & Exams" : "Enter Marks"}
        subtitle="Create exams, enter internal and theory marks — total, percentage and grade are calculated automatically"
        icon="marks" color="linear-gradient(135deg,#f97316,#f43f5e)"
        actions={isAdmin && <Modal title="Create exam" trigger={<button className="btn btn-primary"><Plus size={16} /> New exam</button>}>{examForm()}</Modal>}
      />

      {exams.length === 0 ? (
        <Empty title="No exams yet" hint={isAdmin ? "Create an exam to start entering marks." : "The admin has not created any exam yet."} />
      ) : (
        <div className="space-y-5">
          <div className="card card-pad">
            <div className="label">1 · Exam</div>
            <div className="flex flex-wrap gap-2">
              {exams.map((e) => (
                <div key={e.id} className="flex items-center">
                  <Link href={link({ exam: e.id })} className={`btn btn-sm ${e.id === exam?.id ? "btn-primary" : "btn-ghost"}`}>{e.name} <span className="opacity-70">· {fmtDate(e.startDate, { day: "2-digit", month: "short" })}</span></Link>
                  {isAdmin && e.id === exam?.id && (
                    <span className="ml-1 flex gap-1">
                      <Modal title="Edit exam" trigger={<button className="btn btn-soft btn-sm"><Pencil size={13} /></button>}>{examForm(e)}</Modal>
                      <ConfirmButton className="btn btn-danger btn-sm" confirm={`Delete "${e.name}" and ALL its marks?`} action={deleteExamAction.bind(null, e.id)}><Trash2 size={13} /></ConfirmButton>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="label mt-4">2 · Class & section{!isAdmin && " (only your assigned sections)"}</div>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => <Link key={c.id} href={link({ class: c.id })} className={`btn btn-sm ${c.id === cls?.id ? "btn-primary" : "btn-ghost"}`}>{className(c)}</Link>)}
              {classes.length === 0 && <span className="text-sm text-[color:var(--ink-soft)]">No classes assigned.</span>}
            </div>
            <div className="label mt-4">3 · Subject{!isAdmin && !isClassTeacher && " (only subjects you teach in this section)"}</div>
            <div className="flex flex-wrap gap-2">
              {allocs.map((a) => <Link key={a.id} href={link({ subject: a.subjectId })} className={`btn btn-sm ${a.id === alloc?.id ? "btn-primary" : "btn-ghost"}`}>{a.subject.name}</Link>)}
              {allocs.length === 0 && <span className="text-sm text-[color:var(--ink-soft)]">You teach no subject in this section — pick another section.</span>}
            </div>
          </div>

          {exam && cls && alloc && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="section-title">{exam.name} · {className(cls)} · {alloc.subject.name}</h2>
                <Badge color="#7c3aed">Teacher: {alloc.teacher.user.name}</Badge>
                <Badge color="#0891b2">{exam.academicYear.name} · {examMax(exam)} marks</Badge>
              </div>
              {students.length === 0 ? <Empty title="No students enrolled in this subject" /> : (
                <MarksGrid
                  key={`${exam.id}-${cls.id}-${alloc.subjectId}`}
                  maxInternal={exam.maxInternal} maxTheory={exam.maxTheory}
                  items={students.map((s) => ({ id: s.id, name: s.user.name, roll: s.rollNo, initials: initials(s.user.name), color: avatarColor(s.user.email), internal: markBy.get(s.id)?.internal ?? null, theory: markBy.get(s.id)?.theory ?? null }))}
                  save={saveMarksAction.bind(null, exam.id, cls.id, alloc.subjectId)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
