"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, Field, SubmitButton } from "@/components/form";
import { deleteSlotAction, saveSlotAction } from "@/actions/timetable";
import { DAYS, PERIODS } from "@/lib/utils";

/* ------------------------------------------------------------------ picker */
export interface PickerClass { id: string; yearId: string; grade: string; section: string }

/** Academic year → Class → Section. Changing any select is a client-side route change (only the timetable data reloads). */
export function ClassPicker({ years, classes, currentId }: { years: { id: string; name: string }[]; classes: PickerClass[]; currentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cur = classes.find((c) => c.id === currentId) ?? classes[0];
  const inYear = classes.filter((c) => c.yearId === cur?.yearId);
  const grades = [...new Set(inYear.map((c) => c.grade))];
  const sections = inYear.filter((c) => c.grade === cur?.grade);
  const go = (id?: string) => id && start(() => router.replace(`/timetable?view=class&class=${id}`));
  const sel = "select !w-auto min-w-32";
  return (
    <div className="card card-pad mb-4 flex flex-wrap items-end gap-3" aria-busy={pending} data-class-picker>
      <div>
        <label className="label" htmlFor="tt-year">Academic year</label>
        <select id="tt-year" className={sel} value={cur?.yearId} onChange={(e) => go(classes.find((c) => c.yearId === e.target.value)?.id)}>
          {years.filter((y) => classes.some((c) => c.yearId === y.id)).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tt-class">Class</label>
        <select id="tt-class" className={sel} value={cur?.grade} onChange={(e) => go(inYear.find((c) => c.grade === e.target.value)?.id)}>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tt-section">Section</label>
        <select id="tt-section" className={sel} value={cur?.id} onChange={(e) => go(e.target.value)}>
          {sections.map((c) => <option key={c.id} value={c.id}>{c.section}</option>)}
        </select>
      </div>
      {pending && <span className="pb-2 text-xs font-semibold text-[color:var(--ink-soft)]" role="status">Loading timetable…</span>}
    </div>
  );
}

/* --------------------------------------------------------------- slot form */
export interface SlotFormProps {
  classId: string;
  yearName: string;
  grade: string;
  section: string;
  slot?: { id: string; day: number; period: number; subjectId: string; teacherId: string; startTime: string; endTime: string; room: string | null };
  day: number;
  period: number;
  subjects: { id: string; label: string; teacherId: string }[];
  teachers: { id: string; name: string }[];
}

/** Create / edit one timetable entry (Academic year, Class, Section shown; Day, Period, Subject, Teacher, Start, End, Room editable). */
export function SlotForm({ classId, yearName, grade, section, slot, day, period, subjects, teachers }: SlotFormProps) {
  const [p, setP] = useState(String(slot?.period ?? period));
  const [subject, setSubject] = useState(slot?.subjectId ?? "");
  const [teacher, setTeacher] = useState(slot?.teacherId ?? "");
  const [start, setStart] = useState(slot?.startTime ?? PERIODS[period - 1]?.time.split(" – ")[0] ?? "08:30");
  const [end, setEnd] = useState(slot?.endTime ?? PERIODS[period - 1]?.time.split(" – ")[1] ?? "09:15");
  const ro = "input !bg-[color:var(--brand2-soft)]";
  return (
    <ActionForm action={saveSlotAction.bind(null, classId, slot?.day ?? day, slot?.period ?? period)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Academic year" name="tt-ay"><input id="tt-ay" className={ro} value={yearName} readOnly /></Field>
        <Field label="Class" name="tt-cl"><input id="tt-cl" className={ro} value={grade} readOnly /></Field>
        <Field label="Section" name="tt-sec"><input id="tt-sec" className={ro} value={section} readOnly /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day" name="day">
          <select id="day" name="day" className="select" defaultValue={slot?.day ?? day}>{DAYS.map((d) => <option key={d.n} value={d.n}>{d.long}</option>)}</select>
        </Field>
        <Field label="Period" name="period">
          <select id="period" name="period" className="select" value={p} onChange={(e) => {
            setP(e.target.value);
            if (!slot) { const t = PERIODS[Number(e.target.value) - 1]?.time.split(" – "); if (t) { setStart(t[0]); setEnd(t[1]); } }
          }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Period {n}</option>)}
          </select>
        </Field>
        <Field label="Subject" name="subjectId">
          <select id="subjectId" name="subjectId" className="select" required value={subject} onChange={(e) => {
            setSubject(e.target.value);
            const dflt = subjects.find((s) => s.id === e.target.value)?.teacherId;
            if (dflt) setTeacher(dflt); // pre-select the teacher allocated to this subject (can be changed)
          }}>
            <option value="" disabled>Choose subject…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Teacher" name="teacherId">
          <select id="teacherId" name="teacherId" className="select" required value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="" disabled>Choose teacher…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Start time" name="startTime"><input id="startTime" name="startTime" type="time" className="input" required value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End time" name="endTime"><input id="endTime" name="endTime" type="time" className="input" required value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Room (optional)" name="room"><input id="room" name="room" className="input" maxLength={20} defaultValue={slot?.room ?? ""} /></Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {slot ? (
          <ConfirmButton action={deleteSlotAction.bind(null, slot.id)} confirm="Delete this timetable entry?" className="btn btn-danger"><Trash2 size={14} /> Delete entry</ConfirmButton>
        ) : <span />}
        <SubmitButton>{slot ? "Save changes" : "Save period"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
