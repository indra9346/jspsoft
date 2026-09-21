"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCheck, Loader2, Save } from "lucide-react";
import { Feedback } from "@/components/form";
import { ATT_STATUS, type AttStatus } from "@/lib/utils";
import type { ActionState } from "@/lib/action";

export interface SheetItem {
  id: string;
  name: string;
  sub: string;
  initials: string;
  color: string;
  status: AttStatus | null;
}

export function AttendanceSheet({
  items,
  save,
  readOnly,
  statuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
}: {
  items: SheetItem[];
  save: (entries: { id: string; status: AttStatus }[]) => Promise<ActionState>;
  readOnly?: boolean;
  statuses?: AttStatus[];
}) {
  const ORDER = statuses;
  const [values, setValues] = useState<Record<string, AttStatus | null>>(() => Object.fromEntries(items.map((i) => [i.id, i.status])));
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { unmarked: 0 };
    for (const k of ORDER) c[k] = 0;
    for (const v of Object.values(values)) c[v ?? "unmarked"]++;
    return c;
  }, [values, ORDER]);

  const set = (id: string, s: AttStatus) => {
    setState(null);
    setValues((v) => ({ ...v, [id]: s }));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ORDER.map((k) => (
          <span key={k} className="badge" style={{ color: ATT_STATUS[k].color, background: ATT_STATUS[k].bg }}>
            {ATT_STATUS[k].label}: {counts[k]}
          </span>
        ))}
        {counts.unmarked > 0 && <span className="badge bg-slate-100 text-slate-500">Not marked: {counts.unmarked}</span>}
        {!readOnly && (
          <button type="button" className="btn btn-soft btn-sm ml-auto" onClick={() => { setState(null); setValues(Object.fromEntries(items.map((i) => [i.id, "PRESENT"]))); }}>
            <CheckCheck size={14} /> Mark all present
          </button>
        )}
      </div>

      <div className="card divide-y divide-[color:var(--line)] overflow-hidden">
        {items.map((it, idx) => (
          <div key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-[color:var(--brand2-soft)]">
            <span className="w-6 text-xs font-bold text-[color:var(--ink-soft)]">{idx + 1}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: it.color }}>{it.initials}</span>
            <div className="min-w-40 flex-1">
              <div className="text-sm font-bold text-[color:var(--ink-strong)]">{it.name}</div>
              <div className="text-xs text-[color:var(--ink-soft)]">{it.sub}</div>
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Attendance for ${it.name}`}>
              {ORDER.map((k) => {
                const on = values[it.id] === k;
                const st = ATT_STATUS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={readOnly}
                    onClick={() => set(it.id, k)}
                    className="rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition disabled:cursor-default"
                    style={{
                      color: on ? "#fff" : st.color,
                      background: on ? st.color : st.bg,
                      borderColor: on ? st.color : "transparent",
                    }}
                    title={st.label}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={pending || counts.unmarked > 0}
            onClick={() =>
              start(async () => {
                const entries = Object.entries(values).filter(([, v]) => v).map(([id, status]) => ({ id, status: status as AttStatus }));
                setState(await save(entries));
              })
            }
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save attendance
          </button>
          {counts.unmarked > 0 && <span className="text-xs font-semibold text-amber-600">Mark every student to save.</span>}
          <Feedback state={state} />
        </div>
      )}
    </div>
  );
}
