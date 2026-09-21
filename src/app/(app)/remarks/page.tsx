import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { Avatar, Badge, Empty, PageHeader, Tile } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { GetForm } from "@/components/get-form";
import { deleteRemarkAction, saveRemarkAction } from "@/actions/remarks";
import { className, fmtDate, todayISO } from "@/lib/utils";
import type { RemarkCategory } from "@prisma/client";

export const metadata = { title: "Student Remarks & Observations" };

const CATEGORIES: Record<string, { label: string; color: string }> = {
  ACADEMIC: { label: "Academic Progress", color: "#2563eb" },
  BEHAVIOUR: { label: "Behaviour", color: "#f97316" },
  PARTICIPATION: { label: "Class Participation", color: "#059669" },
  ATTENDANCE: { label: "Attendance Observation", color: "#0891b2" },
  ACTIVITIES: { label: "Activities & Play", color: "#8b5cf6" },
  STRENGTHS: { label: "Strengths", color: "#10b981" },
  IMPROVEMENT: { label: "Area for Improvement", color: "#e11d48" },
  PTM: { label: "PTM Discussion", color: "#7c3aed" },
  GENERAL: { label: "General Observation", color: "#64748b" },
};

interface SP {
  q?: string;
  class?: string;
  category?: string;
}

export default async function RemarksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(["ADMIN", "TEACHER"], "students");
  const isAdmin = user.role === "ADMIN";
  const { q = "", class: classId = "", category = "" } = await searchParams;

  const classes = await visibleClasses(user);
  const allowedClassIds = classes.map((c) => c.id);
  const targetClassId = classId && allowedClassIds.includes(classId) ? classId : undefined;

  const [remarks, students] = await Promise.all([
    db.studentRemark.findMany({
      where: {
        classId: targetClassId ? targetClassId : { in: allowedClassIds },
        ...(category && { category: category as RemarkCategory }),
        ...(q && {
          OR: [
            { student: { user: { name: { contains: q, mode: "insensitive" } } } },
            { student: { admissionNo: { contains: q, mode: "insensitive" } } },
            { remark: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        student: { include: { user: true } },
        classRoom: true,
        author: true,
      },
      orderBy: { date: "desc" },
    }),
    db.student.findMany({
      where: { classId: { in: allowedClassIds }, user: { active: true } },
      include: { user: true, classRoom: true },
      orderBy: [{ classRoom: { grade: "asc" } }, { classRoom: { section: "asc" } }, { rollNo: "asc" }],
    }),
  ]);

  const ptmCount = remarks.filter((r) => r.category === "PTM").length;
  const academicCount = remarks.filter((r) => r.category === "ACADEMIC" || r.category === "STRENGTHS" || r.category === "IMPROVEMENT").length;
  const behaviourCount = remarks.filter((r) => r.category === "BEHAVIOUR" || r.category === "PARTICIPATION").length;

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Student Remarks & PTM Observations" : "Student Remarks"}
        subtitle="Record observations, learning progress, behaviour notes, and Parent-Teacher Meeting discussion summaries"
        icon="announce"
        color="linear-gradient(135deg,#7c3aed,#ec4899)"
        actions={
          students.length > 0 && (
            <Modal title="Add Student Remark / Observation" wide trigger={<button className="btn btn-primary"><Plus size={16} /> Add remark</button>}>
              <ActionForm action={saveRemarkAction.bind(null, students[0].id, null)}>
                <Field label="Select student" name="studentId">
                  <select
                    id="studentId"
                    name="studentId"
                    className="select"
                    defaultValue={students[0].id}
                    required
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.user.name} (Roll {s.rollNo} · {className(s.classRoom)})
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category" name="category">
                    <select id="category" name="category" className="select" defaultValue="GENERAL" required>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Observation date" name="date">
                    <input id="date" name="date" type="date" className="input" defaultValue={todayISO()} max={todayISO()} required />
                  </Field>
                </div>
                <Field label="Remark / Observation text" name="remark" hint="E.g. Good classroom participation; needs practice with letter sounds.">
                  <textarea id="remark" name="remark" className="textarea" rows={3} placeholder="Enter your detailed observations or notes for the parents…" required />
                </Field>
                <div className="flex justify-end"><SubmitButton>Save remark</SubmitButton></div>
              </ActionForm>
            </Modal>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Total Remarks" value={remarks.length} tone="purple" icon="announce" sub="Recorded observations" />
        <Tile label="PTM Discussions" value={ptmCount} tone="teal" icon="students" sub="Parent meeting notes" />
        <Tile label="Academic Notes" value={academicCount} tone="blue" icon="marks" sub="Progress & skills" />
        <Tile label="Behaviour & Activities" value={behaviourCount} tone="orange" icon="classes" sub="Social & active play" />
      </div>

      <GetForm className="card card-pad mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-[color:var(--ink-soft)]" />
            <input id="q" name="q" defaultValue={q} className="input !pl-9" placeholder="Student name, admission no, or keyword" />
          </div>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="class">Class & section</label>
          <select id="class" name="class" defaultValue={targetClassId ?? ""} className="select">
            <option value="">All sections</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}
          </select>
        </div>
        <div className="w-52">
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category} className="select">
            <option value="">All categories</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-soft">Filter</button>
        {(q || classId || category) && <Link href="/remarks" className="btn btn-ghost">Clear</Link>}
      </GetForm>

      {remarks.length === 0 ? (
        <Empty title="No remarks recorded" hint={isAdmin ? "Teachers or Admin have not added any remarks yet." : "You have not added remarks for your students yet."} />
      ) : (
        <div className="space-y-3">
          {remarks.map((r) => {
            const cat = CATEGORIES[r.category] ?? CATEGORIES.GENERAL;
            const canDelete = isAdmin || r.authorId === user.id;
            return (
              <div key={r.id} className="card card-pad hover:bg-[color:var(--brand2-soft)] transition">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.student.user.name} seed={r.student.user.email} size={40} />
                    <div>
                      <Link href={`/students/${r.student.id}`} className="font-bold text-[color:var(--ink-strong)] hover:underline flex items-center gap-2">
                        {r.student.user.name}
                        <span className="text-xs font-normal text-[color:var(--ink-soft)]">({className(r.classRoom)} · Roll {r.student.rollNo})</span>
                      </Link>
                      <div className="text-xs text-[color:var(--ink-soft)]">
                        Entered by <b>{r.author.name}</b> on {fmtDate(r.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={cat.color}>{cat.label}</Badge>
                    {canDelete && (
                      <ConfirmButton
                        className="btn btn-ghost btn-sm text-rose-600"
                        title="Delete remark"
                        confirm="Are you sure you want to delete this remark?"
                        action={deleteRemarkAction.bind(null, r.id)}
                      >
                        <Trash2 size={14} />
                      </ConfirmButton>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-sm text-[color:var(--ink-strong)] bg-white/70 p-3 rounded-xl border border-[color:var(--line)]">
                  {r.remark}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
