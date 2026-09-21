import Link from "next/link";
import { GetForm } from "@/components/get-form";
import { Eye, KeyRound, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { Avatar, Badge, Empty, PageHeader } from "@/components/ui";
import { ConfirmButton, Modal } from "@/components/form";
import { StudentForm } from "@/components/student-form";
import { deleteStudentAction, resetPasswordAction, toggleUserActiveAction } from "@/actions/people";
import { className } from "@/lib/utils";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; class?: string; status?: string; bus?: string }> }) {
  const user = await requireUser(["ADMIN", "TEACHER"], "students");
  const isAdmin = user.role === "ADMIN";
  const { q = "", class: classId = "", status = "", bus = "" } = await searchParams;

  const [classes, years, buses] = await Promise.all([
    visibleClasses(user),
    db.academicYear.findMany({ orderBy: { name: "desc" } }),
    db.bus.findMany({ include: { stops: { orderBy: { sequence: "asc" } } }, orderBy: { busNumber: "asc" } }),
  ]);

  const allowedClassIds = classes.map((c) => c.id);
  const targetClassId = classId && allowedClassIds.includes(classId) ? classId : undefined;

  const students = await db.student.findMany({
    where: {
      classId: targetClassId ? targetClassId : { in: allowedClassIds },
      ...(bus && { busId: bus }),
      ...(status && { user: { active: status === "active" } }),
      ...(q && {
        OR: [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { admissionNo: { contains: q, mode: "insensitive" } },
          { guardianName: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: { user: true, classRoom: true, bus: true },
    orderBy: [{ classRoom: { grade: "asc" } }, { classRoom: { section: "asc" } }, { rollNo: "asc" }],
  });

  const busOpts = buses.map((b) => ({ id: b.id, label: `${b.busNumber} · ${b.routeName}`, stops: b.stops.map((s) => ({ id: s.id, name: s.name })) }));

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Students" : "My Students"}
        subtitle={`${students.length} student${students.length === 1 ? "" : "s"}${!isAdmin ? " in your assigned section(s)" : ""}`}
        icon="students"
        color="linear-gradient(135deg,#3b82f6,#06b6d4)"
        actions={
          isAdmin && (
            <Modal title="Add student" wide trigger={<button className="btn btn-primary"><Plus size={16} /> Add student</button>}>
              <StudentForm classes={classes} years={years} buses={busOpts} />
            </Modal>
          )
        }
      />

      <GetForm className="card card-pad mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-[color:var(--ink-soft)]" />
            <input id="q" name="q" defaultValue={q} className="input !pl-9" placeholder="Name, admission no. or guardian" />
          </div>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="class">Class & section</label>
          <select id="class" name="class" defaultValue={targetClassId ?? ""} className="select">
            <option value="">All</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}
          </select>
        </div>
        {isAdmin && (
          <div className="w-40">
            <label className="label" htmlFor="bus">Bus</label>
            <select id="bus" name="bus" defaultValue={bus} className="select">
              <option value="">All</option>
              {buses.map((b) => <option key={b.id} value={b.id}>{b.busNumber}</option>)}
            </select>
          </div>
        )}
        <div className="w-36">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="select">
            <option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
        <button className="btn btn-soft">Filter</button>
        {(q || classId || status || bus) && <Link href="/students" className="btn btn-ghost">Clear</Link>}
      </GetForm>

      {students.length === 0 ? (
        <Empty title="No students found" hint={isAdmin ? "Try a different search, or add a new student." : "No students found in your assigned sections."} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Admission no.</th><th>Class</th><th>Roll</th><th>Guardian</th><th>Bus</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/students/${s.id}`} className="flex items-center gap-3">
                      <Avatar name={s.user.name} seed={s.user.email} photo={s.photoData} />
                      <div><div className="font-bold text-[color:var(--ink-strong)]">{s.user.name}</div><div className="text-xs text-[color:var(--ink-soft)]">{s.user.email}</div></div>
                    </Link>
                  </td>
                  <td>{s.admissionNo}</td>
                  <td><Badge color="#3b82f6">{className(s.classRoom)}</Badge></td>
                  <td>{s.rollNo}</td>
                  <td><div>{s.guardianName}</div><div className="text-xs text-[color:var(--ink-soft)]">{s.guardianPhone}</div></td>
                  <td>{s.bus ? <Badge color="#0d9488">{s.bus.busNumber}</Badge> : <span className="text-[color:var(--ink-soft)]">—</span>}</td>
                  <td>{s.user.active ? <Badge color="#059669">Active</Badge> : <Badge color="#e11d48">Inactive</Badge>}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/students/${s.id}`} className="btn btn-ghost btn-sm" title="View Student 360° Profile"><Eye size={14} /> Profile</Link>
                      {isAdmin && (
                        <>
                          <Modal title="Edit student" wide trigger={<button className="btn btn-soft btn-sm" title="Edit"><Pencil size={14} /></button>}>
                            <StudentForm classes={classes} years={years} buses={busOpts} student={s} />
                          </Modal>
                          <ConfirmButton className="btn btn-ghost btn-sm" title="Reset password to Swan@123" confirm={`Reset ${s.user.name}'s password to Swan@123?`} action={resetPasswordAction.bind(null, s.userId)}><KeyRound size={14} /></ConfirmButton>
                          <ConfirmButton className="btn btn-ghost btn-sm" title={s.user.active ? "Deactivate" : "Activate"} action={toggleUserActiveAction.bind(null, s.userId)}><Power size={14} /></ConfirmButton>
                          <ConfirmButton title="Delete" confirm={`Delete ${s.user.name}? Their attendance and marks will also be removed.`} action={deleteStudentAction.bind(null, s.id)}><Trash2 size={14} /></ConfirmButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
