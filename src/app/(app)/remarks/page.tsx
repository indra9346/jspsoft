import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { ActionForm, Field, Modal, SubmitButton } from "@/components/form";
import { saveRemarkAction } from "@/actions/remarks";
import { RemarksClient, type SerializedRemark } from "@/components/remarks-client";
import { className, todayISO } from "@/lib/utils";

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

export default async function RemarksPage() {
  const user = await requireUser(["ADMIN", "TEACHER"], "students");
  const isAdmin = user.role === "ADMIN";

  const classes = await visibleClasses(user);
  const allowedClassIds = classes.map((c) => c.id);

  const [remarksRaw, students] = await Promise.all([
    db.studentRemark.findMany({
      where: {
        classId: { in: allowedClassIds },
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

  const serializedRemarks: SerializedRemark[] = remarksRaw.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    classId: r.classId,
    category: r.category,
    remark: r.remark,
    date: r.date.toISOString(),
    authorId: r.authorId,
    author: {
      name: r.author.name,
    },
    student: {
      id: r.student.id,
      admissionNo: r.student.admissionNo,
      rollNo: r.student.rollNo,
      user: {
        name: r.student.user.name,
        email: r.student.user.email,
      },
    },
    classRoom: {
      grade: r.classRoom.grade,
      section: r.classRoom.section,
    },
  }));

  const classOptions = classes.map((c) => ({
    id: c.id,
    grade: c.grade,
    section: c.section,
  }));

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

      <RemarksClient
        initialRemarks={serializedRemarks}
        classes={classOptions}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
