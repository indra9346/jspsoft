import { requireUser } from "@/lib/auth";
import { Avatar, Badge, PageHeader } from "@/components/ui";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { changePasswordAction } from "@/actions/people";
import { StudentProfile } from "@/components/student-profile";
import { className, fmtDate } from "@/lib/utils";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const u = await requireUser();
  const rows: [string, string][] = [["Email", u.email], ["Role", u.role.charAt(0) + u.role.slice(1).toLowerCase()]];
  if (u.phone) rows.push(["Phone", u.phone]);
  if (u.staff) rows.push(["Employee ID", u.staff.employeeId], ["Designation", u.staff.designation], ["Joined", fmtDate(u.staff.joinDate)], ["Qualification", u.staff.qualification ?? "—"]);
  if (u.student) rows.push(["Class", className(u.student.classRoom)], ["Roll no.", String(u.student.rollNo)], ["Admission no.", u.student.admissionNo], ["Date of birth", fmtDate(u.student.dob)], ["Guardian", `${u.student.guardianName} · ${u.student.guardianPhone}`]);

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your details and password" icon="profile" color="linear-gradient(135deg,#8b5cf6,#ec4899)" />
      {u.role === "STUDENT" && u.student && (
        <div className="mb-8"><StudentProfile studentId={u.student.id} viewer={u} /></div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {u.role !== "STUDENT" && <div className="card overflow-hidden">
          <div className="flex items-center gap-4 p-5" style={{ background: "var(--grad)" }}>
            <Avatar name={u.name} seed={u.email} size={64} />
            <div className="text-white"><div className="text-xl font-extrabold text-white">{u.name}</div><Badge color="#fff" bg="rgba(255,255,255,.25)">{u.role}</Badge></div>
          </div>
          <div className="divide-y divide-[color:var(--line)]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 px-5 py-3 text-sm"><span className="w-32 font-semibold text-[color:var(--ink-soft)]">{k}</span><span className="font-semibold text-[color:var(--ink-strong)]">{v}</span></div>
            ))}
          </div>
        </div>}
        <div className="card card-pad">
          <h2 className="section-title mb-3">Change password</h2>
          <ActionForm action={changePasswordAction} resetOnSuccess closeOnSuccess={false}>
            <Field label="Current password" name="current"><input id="current" name="current" type="password" className="input" autoComplete="current-password" required /></Field>
            <Field label="New password" name="next" hint="At least 8 characters"><input id="next" name="next" type="password" className="input" autoComplete="new-password" required minLength={8} /></Field>
            <Field label="Confirm new password" name="confirm"><input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required /></Field>
            <SubmitButton>Update password</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
