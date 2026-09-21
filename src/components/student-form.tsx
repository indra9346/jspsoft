import { ActionForm, Field, SubmitButton } from "@/components/form";
import { BusPicker } from "@/components/bus-picker";
import { saveStudentAction } from "@/actions/people";
import { className, iso, todayISO } from "@/lib/utils";

interface Props {
  classes: { id: string; grade: string; section: string; academicYearId: string }[];
  years: { id: string; name: string; isCurrent: boolean }[];
  buses: { id: string; label: string; stops: { id: string; name: string }[] }[];
  student?: {
    id: string; admissionNo: string; rollNo: number; classId: string; academicYearId: string; gender: string; dob: Date; admissionDate: Date;
    guardianName: string; guardianPhone: string; address: string; bloodGroup: string | null; busId: string | null; busStopId: string | null;
    user: { name: string; email: string; phone: string | null };
  };
}

export function StudentForm({ classes, years, buses, student: s }: Props) {
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? "";
  return (
    <ActionForm action={saveStudentAction.bind(null, s?.id ?? null)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name"><input id="name" name="name" className="input" defaultValue={s?.user.name} required /></Field>
        <Field label="Login email" name="email"><input id="email" name="email" type="email" className="input" defaultValue={s?.user.email} required /></Field>
        <Field label="Admission number" name="admissionNo"><input id="admissionNo" name="admissionNo" className="input" defaultValue={s?.admissionNo} required /></Field>
        <Field label="Phone" name="phone"><input id="phone" name="phone" className="input" defaultValue={s?.user.phone ?? ""} /></Field>
        <Field label="Academic year" name="academicYearId">
          <select id="academicYearId" name="academicYearId" className="select" defaultValue={s?.academicYearId ?? currentYear?.id} required>
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? " (current)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Class & section" name="classId">
          <select id="classId" name="classId" className="select" defaultValue={s?.classId ?? ""} required>
            <option value="" disabled>Select class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>Class {className(c)} · {yearName(c.academicYearId)}</option>)}
          </select>
        </Field>
        <Field label="Roll no." name="rollNo"><input id="rollNo" name="rollNo" type="number" min={1} className="input" defaultValue={s?.rollNo} required /></Field>
        <Field label="Admission date" name="admissionDate"><input id="admissionDate" name="admissionDate" type="date" className="input" defaultValue={s ? iso(s.admissionDate) : todayISO()} required /></Field>
        <Field label="Gender" name="gender">
          <select id="gender" name="gender" className="select" defaultValue={s?.gender ?? ""} required>
            <option value="" disabled>Select…</option><option value="M">Male</option><option value="F">Female</option>
          </select>
        </Field>
        <Field label="Date of birth" name="dob"><input id="dob" name="dob" type="date" className="input" defaultValue={s ? iso(s.dob) : ""} required /></Field>
        <Field label="Blood group" name="bloodGroup"><input id="bloodGroup" name="bloodGroup" className="input" defaultValue={s?.bloodGroup ?? ""} placeholder="e.g. O+" /></Field>
        <Field label="Photo" name="photo" hint="PNG / JPG / WebP, up to 250 KB"><input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="input !py-1.5" /></Field>
        <Field label="Parent / guardian name" name="guardianName"><input id="guardianName" name="guardianName" className="input" defaultValue={s?.guardianName} required /></Field>
        <Field label="Parent / guardian phone" name="guardianPhone"><input id="guardianPhone" name="guardianPhone" className="input" defaultValue={s?.guardianPhone} required /></Field>
      </div>
      <Field label="Address" name="address"><input id="address" name="address" className="input" defaultValue={s?.address} /></Field>
      <BusPicker buses={buses} busId={s?.busId} stopId={s?.busStopId} />
      {!s && (
        <Field label="Initial password" name="password" hint="Leave blank to use the default password Swan@123">
          <input id="password" name="password" type="text" className="input" placeholder="Swan@123" />
        </Field>
      )}
      <p className="text-xs text-[color:var(--ink-soft)]">Subjects are assigned automatically from the class; you can adjust them on the student&apos;s profile.</p>
      <div className="flex justify-end"><SubmitButton>{s ? "Save changes" : "Add student"}</SubmitButton></div>
    </ActionForm>
  );
}
