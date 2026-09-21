import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { deleteSubjectAction, saveSubjectAction } from "@/actions/academics";

export const metadata = { title: "Subjects" };

const COLORS = ["#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#eab308", "#f43f5e"];

export default async function SubjectsPage() {
  await requireUser(["ADMIN"]);
  const subjects = await db.subject.findMany({ include: { _count: { select: { allocations: true } } }, orderBy: { name: "asc" } });

  const form = (s?: (typeof subjects)[number]) => (
    <ActionForm action={saveSubjectAction.bind(null, s?.id ?? null)}>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Subject name" name="name"><input id="name" name="name" className="input" defaultValue={s?.name} required /></Field>
        <Field label="Code" name="code"><input id="code" name="code" className="input" maxLength={8} defaultValue={s?.code} required /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton>{s ? "Save changes" : "Add subject"}</SubmitButton></div>
    </ActionForm>
  );

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle={`${subjects.length} subjects offered`}
        icon="subjects"
        color="linear-gradient(135deg,#8b5cf6,#ec4899)"
        actions={<Modal title="Add subject" trigger={<button className="btn btn-primary"><Plus size={16} /> Add subject</button>}>{form()}</Modal>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {subjects.map((s, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <div key={s.id} className="card card-pad">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-extrabold text-white" style={{ background: color }}>{s.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-[color:var(--ink-strong)]">{s.name}</div>
                  <Badge color={color}>{s._count.allocations} classes</Badge>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-1.5">
                <Modal title="Edit subject" trigger={<button className="btn btn-soft btn-sm"><Pencil size={14} /></button>}>{form(s)}</Modal>
                <ConfirmButton confirm={`Delete ${s.name}? Its allocations, timetable slots and marks will be removed.`} action={deleteSubjectAction.bind(null, s.id)}><Trash2 size={14} /></ConfirmButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
