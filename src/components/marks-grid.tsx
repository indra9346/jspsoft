"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Feedback } from "@/components/form";
import { gradeFor } from "@/lib/utils";
import type { ActionState } from "@/lib/action";

export interface MarkItem {
  id: string;
  name: string;
  roll: number;
  initials: string;
  color: string;
  internal: number | null;
  theory: number | null;
}

export function MarksGrid({
  items,
  maxInternal,
  maxTheory,
  save,
}: {
  items: MarkItem[];
  maxInternal: number;
  maxTheory: number;
  save: (entries: { id: string; internal: number | null; theory: number | null }[]) => Promise<ActionState>;
}) {
  const max = maxInternal + maxTheory;
  const [vals, setVals] = useState<Record<string, { i: string; t: string }>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { i: i.internal === null ? "" : String(i.internal), t: i.theory === null ? "" : String(i.theory) }])),
  );
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  const bad = (v: string, m: number) => v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > m);
  const half = (v: { i: string; t: string }) => (v.i === "") !== (v.t === "");
  const anyInvalid = Object.values(vals).some((v) => bad(v.i, maxInternal) || bad(v.t, maxTheory) || half(v));
  const totals = Object.values(vals).filter((v) => v.i !== "" && v.t !== "" && !bad(v.i, maxInternal) && !bad(v.t, maxTheory)).map((v) => Number(v.i) + Number(v.t));
  const avg = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0;

  const set = (id: string, k: "i" | "t", v: string) => { setState(null); setVals((s) => ({ ...s, [id]: { ...s[id], [k]: v } })); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="badge bg-violet-50 text-violet-600">Entered: {totals.length}/{items.length}</span>
        <span className="badge bg-sky-50 text-sky-600">Class average: {avg}/{max}</span>
        <span className="badge bg-amber-50 text-amber-600">Internal {maxInternal} + Theory {maxTheory} = {max}</span>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Roll</th><th>Student</th><th>Internal (/{maxInternal})</th><th>Theory (/{maxTheory})</th><th>Total (/{max})</th><th>Grade</th></tr></thead>
          <tbody>
            {items.map((it) => {
              const v = vals[it.id];
              const okv = v.i !== "" && v.t !== "" && !bad(v.i, maxInternal) && !bad(v.t, maxTheory);
              const total = okv ? Number(v.i) + Number(v.t) : null;
              const g = total === null ? null : gradeFor((total / max) * 100);
              const cls = (b: boolean) => (b ? { borderColor: "#e11d48", background: "#fff1f2" } : undefined);
              return (
                <tr key={it.id}>
                  <td className="font-bold">{it.roll}</td>
                  <td><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: it.color }}>{it.initials}</span><span className="font-bold text-[color:var(--ink-strong)]">{it.name}</span></div></td>
                  <td><input type="number" inputMode="decimal" min={0} max={maxInternal} step="0.5" className="input !w-24 text-center font-bold" style={cls(bad(v.i, maxInternal) || half(v))} value={v.i} aria-label={`Internal marks for ${it.name}`} onChange={(e) => set(it.id, "i", e.target.value)} /></td>
                  <td><input type="number" inputMode="decimal" min={0} max={maxTheory} step="0.5" className="input !w-24 text-center font-bold" style={cls(bad(v.t, maxTheory) || half(v))} value={v.t} aria-label={`Theory marks for ${it.name}`} onChange={(e) => set(it.id, "t", e.target.value)} /></td>
                  <td className="font-extrabold">{total === null ? "—" : `${total}/${max}`}</td>
                  <td>{g ? <span className="badge" style={{ color: g.color, background: `color-mix(in srgb, ${g.color} 13%, white)` }}>{g.grade}</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending || anyInvalid}
          onClick={() => start(async () => setState(await save(items.map((i) => ({ id: i.id, internal: vals[i.id].i === "" ? null : Number(vals[i.id].i), theory: vals[i.id].t === "" ? null : Number(vals[i.id].t) })))))}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save marks
        </button>
        {anyInvalid && <span className="text-xs font-semibold text-rose-600">Marks must be within the limits and entered for both internal and theory.</span>}
        <Feedback state={state} />
      </div>
    </div>
  );
}
