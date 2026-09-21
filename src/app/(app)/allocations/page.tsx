import Link from "next/link";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Badge, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { deleteAllocationAction, saveAllocationAction } from "@/actions/academics";
import { className } from "@/lib/utils";

export const metadata = { title: "Class & Teacher Allocation" };

export default async function AllocationsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  await requireUser(["ADMIN"]);
  const [classes, subjects, teachers] = await Promise.all([
    db.classRoom.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ include: { user: true, allocations: true }, orderBy: { user: { name: "asc" } } }),
  ]);
  const { class: sel } = await searchParams;
  const current = classes.find((c) => c.id === sel) ?? classes[0];
  const allocs = current ? await db.allocation.findMany({ where: { classId: current.id }, include: { teacher: { include: { user: true } } } }) : [];

  return (
    <div>
      <PageHeader
        title="Class & Teacher Allocation"
        subtitle="Decide which teacher teaches which subject in each class"
        icon="allocation"
        color="linear-gradient(135deg,#06b6d4,#6366f1)"
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {classes.map((c) => (
          <Link key={c.id} href={`/allocations?class=${c.id}`} className={`btn btn-sm ${c.id === current?.id ? "btn-primary" : "btn-ghost"}`}>
            {className(c)}
          </Link>
        ))}
      </div>

      {current && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Subject</th><th>Assigned teacher</th><th>Change / assign teacher</th><th /></tr></thead>
            <tbody>
              {subjects.map((s) => {
                const a = allocs.find((x) => x.subjectId === s.id);
                return (
                  <tr key={s.id}>
                    <td><div className="font-bold text-[color:var(--ink-strong)]">{s.name}</div><div className="text-xs text-[color:var(--ink-soft)]">{s.code}</div></td>
                    <td>
                      {a ? (
                        <div className="flex items-center gap-2"><Avatar name={a.teacher.user.name} seed={a.teacher.user.email} size={30} /><span className="font-semibold">{a.teacher.user.name}</span></div>
                      ) : <Badge color="#d97706">Unassigned</Badge>}
                    </td>
                    <td>
                      <ActionForm action={saveAllocationAction} closeOnSuccess={false} className="flex items-center gap-2">
                        <input type="hidden" name="classId" value={current.id} />
                        <input type="hidden" name="subjectId" value={s.id} />
                        <select name="teacherId" className="select !w-56" defaultValue={a?.teacherId ?? ""} required>
                          <option value="" disabled>Choose teacher…</option>
                          {teachers.map((t) => <option key={t.id} value={t.id}>{t.user.name} ({t.allocations.length})</option>)}
                        </select>
                        <SubmitButton className="btn btn-soft btn-sm">{a ? "Update" : "Assign"}</SubmitButton>
                      </ActionForm>
                    </td>
                    <td className="text-right">
                      {a && <ConfirmButton confirm={`Remove ${s.name} from ${className(current)}? Timetable slots for it will be deleted.`} action={deleteAllocationAction.bind(null, a.id)}><Trash2 size={14} /></ConfirmButton>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-[color:var(--ink-soft)]">The number in brackets is how many class-subject allocations the teacher already has.</p>
    </div>
  );
}
