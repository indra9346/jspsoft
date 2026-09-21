"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { createAnnouncementAction } from "@/actions/announcements";

const chipCls =
  "btn btn-ghost btn-sm peer-checked:!border-[color:var(--brand)] peer-checked:!bg-[color:var(--brand-soft)] peer-checked:!text-[color:var(--brand)] peer-focus-visible:ring-2";

export function AnnouncementForm({ classes, isAdmin, today }: { classes: { id: string; grade: string; label: string }[]; isAdmin: boolean; today: string }) {
  const [audience, setAudience] = useState(isAdmin ? "ALL" : "SECTIONS");
  const grades = [...new Set(classes.map((c) => c.grade))];
  return (
    <ActionForm action={createAnnouncementAction}>
      <Field label="Title" name="title"><input id="title" name="title" className="input" required maxLength={120} placeholder="e.g. Parent-Teacher Meeting" /></Field>
      <Field label="Content" name="body"><textarea id="body" name="body" className="textarea" required placeholder="Write your announcement…" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" name="publishDate"><input id="publishDate" name="publishDate" type="date" className="input" defaultValue={today} required /></Field>
        <Field label="Expiry date (optional)" name="expiryDate"><input id="expiryDate" name="expiryDate" type="date" className="input" /></Field>
        <Field label="Audience" name="audience">
          <select id="audience" name="audience" className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {isAdmin && <option value="ALL">Everyone</option>}
            {isAdmin && <option value="STUDENTS">All students</option>}
            {isAdmin && <option value="TEACHERS">All teachers</option>}
            {isAdmin && <option value="STAFF">All staff</option>}
            <option value="CLASSES">Specific class (all sections)</option>
            <option value="SECTIONS">Specific section</option>
          </select>
        </Field>
        <Field label="Priority" name="priority">
          <select id="priority" name="priority" className="select" defaultValue="NORMAL"><option value="NORMAL">Normal</option><option value="IMPORTANT">Important</option><option value="URGENT">Urgent</option></select>
        </Field>
      </div>
      {audience === "CLASSES" && (
        <div>
          <div className="label">Choose classes</div>
          <div className="flex flex-wrap gap-2">
            {grades.map((g) => <label key={g} className="cursor-pointer"><input type="checkbox" name="grades" value={g} className="peer sr-only" /><span className={chipCls}>{g}</span></label>)}
          </div>
        </div>
      )}
      {audience === "SECTIONS" && (
        <div>
          <div className="label">Choose sections</div>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => <label key={c.id} className="cursor-pointer"><input type="checkbox" name="classIds" value={c.id} className="peer sr-only" /><span className={chipCls}>{c.label}</span></label>)}
          </div>
        </div>
      )}
      <div className="flex justify-end"><SubmitButton>Publish announcement</SubmitButton></div>
    </ActionForm>
  );
}
