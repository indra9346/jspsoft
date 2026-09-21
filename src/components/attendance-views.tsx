import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ATT_STATUS, STAFF_STATUSES, STUDENT_STATUSES, attendancePercent, monthLabel, monthRange, weekday, type AttStatus } from "@/lib/utils";

export function MonthNav({ month, base }: { month: string; base: string }) {
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center gap-2">
      <Link href={`${base}${sep}month=${prev}`} className="btn btn-ghost btn-sm" aria-label="Previous month"><ChevronLeft size={14} /></Link>
      <span className="min-w-36 text-center text-sm font-extrabold text-[color:var(--ink-strong)]">{monthLabel(month)}</span>
      <Link href={`${base}${sep}month=${next}`} className="btn btn-ghost btn-sm" aria-label="Next month"><ChevronRight size={14} /></Link>
    </div>
  );
}

export function Legend({ staff }: { staff?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {(staff ? STAFF_STATUSES : STUDENT_STATUSES).map((k) => (
        <span key={k} className="badge" style={{ color: ATT_STATUS[k].color, background: ATT_STATUS[k].bg }}>{ATT_STATUS[k].short} = {ATT_STATUS[k].label}</span>
      ))}
    </div>
  );
}

export interface MatrixRow {
  id: string;
  name: string;
  sub?: string;
  records: { date: Date; status: string }[];
}

/** Monthly grid: one row per person, one column per day of the month. */
export function MonthMatrix({ month, rows }: { month: string; rows: MatrixRow[] }) {
  const { days } = monthRange(month);
  const dayList = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  return (
    <div className="card table-wrap">
      <table className="table !border-separate text-center">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 !text-left" style={{ background: "#f8f1fb" }}>Name</th>
            {dayList.map((d) => (
              <th key={d} className="!px-1.5 !text-center" style={weekday(d) === 0 ? { color: "#e11d48" } : undefined}>{Number(d.slice(8))}</th>
            ))}
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const byDay = new Map(r.records.map((x) => [x.date.toISOString().slice(0, 10), x.status as AttStatus]));
            return (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 bg-white !text-left whitespace-nowrap">
                  <div className="font-bold text-[color:var(--ink-strong)]">{r.name}</div>
                  {r.sub && <div className="text-[11px] text-[color:var(--ink-soft)]">{r.sub}</div>}
                </td>
                {dayList.map((d) => {
                  const s = byDay.get(d);
                  const sun = weekday(d) === 0;
                  return (
                    <td key={d} className="!px-1 !py-1.5">
                      {s ? (
                        <span title={`${d} · ${ATT_STATUS[s].label}`} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-extrabold" style={{ background: ATT_STATUS[s].bg, color: ATT_STATUS[s].color }}>{ATT_STATUS[s].short}</span>
                      ) : (
                        <span className="text-[color:var(--line)]">{sun ? "·" : "–"}</span>
                      )}
                    </td>
                  );
                })}
                <td className="font-extrabold text-[color:var(--ink-strong)]">{r.records.length ? `${attendancePercent(r.records)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Calendar for a single person. */
export function MonthCalendar({ month, records }: { month: string; records: { date: Date; status: string }[] }) {
  const { days, from } = monthRange(month);
  const offset = (weekday(from) + 6) % 7; // Monday first
  const byDay = new Map(records.map((x) => [x.date.toISOString().slice(0, 10), x.status as AttStatus]));
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const s = byDay.get(d);
          const st = s ? ATT_STATUS[s] : null;
          return (
            <div key={d} className="flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold" title={st?.label} style={{ background: st ? st.bg : weekday(d) === 0 ? "#fff1f2" : "#ffffff", color: st ? st.color : "#a5a8d0", border: "1px solid var(--line)" }}>
              <span>{Number(d.slice(8))}</span>
              {st && <span className="text-[10px] font-extrabold">{st.short}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

