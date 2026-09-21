import Link from "next/link";
import { KeyRound, Lock, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Badge, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { deleteStaffAction, resetPasswordAction, saveStaffAction, toggleUserActiveAction } from "@/actions/people";
import { className, fmtDate, iso } from "@/lib/utils";

export const metadata = { title: "Staff" };

type StaffRow = Awaited<ReturnType<typeof load>>[number];

const load = () =>
  db.staff.findMany({
    include: { user: true, classTeacherOf: true, allocations: { include: { subject: true, classRoom: true } } }, where: { staffType: "TEACHING" },
    orderBy: { employeeId: "asc" },
  });

function StaffForm({ s }: { s?: StaffRow }) {
  return (
    <ActionForm action={saveStaffAction.bind(null, s?.id ?? null)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name"><input id="name" name="name" className="input" defaultValue={s?.user.name} required /></Field>
        <Field label="Login email" name="email"><input id="email" name="email" type="email" className="input" defaultValue={s?.user.email} required /></Field>
        <Field label="Phone" name="phone"><input id="phone" name="phone" className="input" defaultValue={s?.user.phone ?? ""} required /></Field>
        <Field label="Employee ID" name="employeeId"><input id="employeeId" name="employeeId" className="input" defaultValue={s?.employeeId} required /></Field>
        <Field label="Designation" name="designation"><input id="designation" name="designation" className="input" defaultValue={s?.designation ?? "Teacher"} required /></Field>
        <Field label="Department" name="department"><input id="department" name="department" className="input" defaultValue={s?.department ?? ""} /></Field>
        <Field label="Qualification" name="qualification"><input id="qualification" name="qualification" className="input" defaultValue={s?.qualification ?? ""} /></Field>
        <Field label="Gender" name="gender">
          <select id="gender" name="gender" className="select" defaultValue={s?.gender ?? ""} required>
            <option value="" disabled>Select…</option><option value="M">Male</option><option value="F">Female</option>
          </select>
        </Field>
        <Field label="Joining date" name="joinDate"><input id="joinDate" name="joinDate" type="date" className="input" defaultValue={s ? iso(s.joinDate) : ""} required /></Field>
        {!s && (
          <Field label="Initial password" name="password" hint="Blank = Swan@123"><input id="password" name="password" className="input" placeholder="Swan@123" /></Field>
        )}
      </div>
      <div className="flex justify-end"><SubmitButton>{s ? "Save changes" : "Add staff member"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function StaffPage() {
  await requireUser(["ADMIN"], "staff");
  const staff = await load();
  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} teaching staff · non-teaching staff is an add-on`}
        icon="staff"
        color="linear-gradient(135deg,#fb923c,#f43f5e)"
        actions={
          <>
          <Link href="/non-teaching" className="btn btn-ghost"><Lock size={14} /> Non-teaching staff</Link>
          <Modal title="Add staff member" wide trigger={<button className="btn btn-primary"><Plus size={16} /> Add staff</button>}>
            <StaffForm />
          </Modal>
          </>
        }
      />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Staff member</th><th>Employee ID</th><th>Designation</th><th>Assigned subjects & classes</th><th>Joined</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.user.name} seed={s.user.email} />
                    <div>
                      <div className="font-bold text-[color:var(--ink-strong)]">{s.user.name}</div>
                      <div className="text-xs text-[color:var(--ink-soft)]">{s.user.email} · {s.user.phone}</div>
                    </div>
                  </div>
                </td>
                <td>{s.employeeId}</td>
                <td>
                  <div>{s.designation}</div>
                  <div className="text-xs text-[color:var(--ink-soft)]">{s.qualification}</div>
                </td>
                <td className="max-w-xs">
                  {s.classTeacherOf.length > 0 && <div className="mb-1 flex flex-wrap gap-1">{s.classTeacherOf.map((c) => <Badge key={c.id} color="#059669">Class teacher {className(c)}</Badge>)}</div>}
                  <div className="flex flex-wrap gap-1">{s.allocations.length ? s.allocations.map((a) => <Badge key={a.id} color="#7c3aed">{a.subject.code} · {className(a.classRoom)}</Badge>) : <span className="text-[color:var(--ink-soft)]">Not allocated</span>}</div>
                </td>
                <td>{fmtDate(s.joinDate)}</td>
                <td>{s.user.active ? <Badge color="#059669">Active</Badge> : <Badge color="#e11d48">Inactive</Badge>}</td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <Link href="/attendance?view=staff" className="btn btn-ghost btn-sm" title="View attendance">Attendance</Link>
                    <Modal title="Edit staff member" wide trigger={<button className="btn btn-soft btn-sm" title="Edit"><Pencil size={14} /></button>}>
                      <StaffForm s={s} />
                    </Modal>
                    <ConfirmButton className="btn btn-ghost btn-sm" title="Reset password" confirm={`Reset ${s.user.name}'s password to Swan@123?`} action={resetPasswordAction.bind(null, s.userId)}><KeyRound size={14} /></ConfirmButton>
                    <ConfirmButton className="btn btn-ghost btn-sm" title={s.user.active ? "Deactivate" : "Activate"} action={toggleUserActiveAction.bind(null, s.userId)}><Power size={14} /></ConfirmButton>
                    <ConfirmButton title="Delete" confirm={`Delete ${s.user.name}? Their allocations, timetable slots and attendance will also be removed.`} action={deleteStaffAction.bind(null, s.id)}><Trash2 size={14} /></ConfirmButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
