import { BarChart3, Bus, CalendarCheck, Lock, MapPin, Megaphone, Search, Timer, UserRound, Wallet } from "lucide-react";

/* Static, read-only previews for locked add-ons. Nothing here reads or writes the database.
   Every value is DEMO data, clearly labelled, and every control is disabled. */

export const DemoBadge = ({ text = "DEMO PREVIEW — sample values, not real data" }: { text?: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
    <Lock size={11} /> {text}
  </span>
);

const Dis = ({ children, className = "btn btn-soft btn-sm" }: { children: React.ReactNode; className?: string }) => (
  <button type="button" disabled className={className}><Lock size={12} /> {children}</button>
);

/* ------------------------------------------------------------------ parent */
export function ParentPreview() {
  const cards = "card card-pad";
  const bars = [82, 74, 91, 68, 88, 79];
  const subj = ["MAT", "SCI", "ENG", "SOC", "HIN", "CSC"];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-[color:var(--line)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-lg font-extrabold text-white">S</span>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">Parent view · demo family</div>
          <div className="font-extrabold text-[color:var(--ink-strong)]">Sample Parent · 2 children linked</div>
        </div>
        <select disabled className="select !w-52" aria-label="Choose child"><option>Sample Student · Class 10-A</option></select>
        <Dis>Switch child</Dis>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><UserRound size={16} /> Child Profile</h3>
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-500 text-xl font-extrabold text-white">SS</span>
            <div><div className="font-extrabold text-[color:var(--ink-strong)]">Sample Student</div><div className="text-xs text-[color:var(--ink-soft)]">Class 10 · Section A · Roll 00</div><div className="text-xs text-[color:var(--ink-soft)]">Adm. no. DEMO-0000</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs"><span className="badge bg-sky-50 text-sky-700">Academic year 2026-2027</span><span className="badge bg-emerald-50 text-emerald-700">Active</span></div>
        </div>

        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><CalendarCheck size={16} /> Attendance</h3>
          <div className="flex items-center gap-4">
            <svg width="88" height="88" viewBox="0 0 36 36" aria-label="Attendance percentage demo"><circle cx="18" cy="18" r="15.5" fill="none" stroke="#e6e3f7" strokeWidth="4" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="91 100" strokeLinecap="round" transform="rotate(-90 18 18)" /><text x="18" y="21" textAnchor="middle" fontSize="8" fontWeight="800" fill="#34337c">94%</text></svg>
            <div className="text-sm"><div><b>Attendance percentage</b></div><div className="text-[color:var(--ink-soft)]">Present 63 · Absent 4 · Late 1</div></div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
            {Array.from({ length: 14 }, (_, i) => <span key={i} className="rounded-md py-1" style={{ background: i === 4 ? "#ffe4e6" : i === 9 ? "#fef3c7" : "#d1fae5", color: i === 4 ? "#e11d48" : i === 9 ? "#d97706" : "#059669" }}>{i === 4 ? "A" : i === 9 ? "L" : "P"}</span>)}
          </div>
        </div>

        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><BarChart3 size={16} /> Academic Performance</h3>
          <div className="flex h-24 items-end gap-2">
            {bars.map((b, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-lg" style={{ height: b, background: ["#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"][i] }} /><span className="text-[10px] font-bold text-[color:var(--ink-soft)]">{subj[i]}</span></div>)}
          </div>
          <div className="mt-2 text-xs text-[color:var(--ink-soft)]">Demo chart — subject percentages</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`${cards} table-wrap`}>
          <h3 className="section-title mb-3">Marks & Results</h3>
          <table className="table"><thead><tr><th>Subject</th><th>Internal</th><th>Theory</th><th>Total</th><th>Grade</th></tr></thead>
            <tbody>{[["Mathematics", 18, 72], ["Science", 15, 60], ["English", 17, 70]].map(([n, i, t]) => <tr key={String(n)}><td className="font-bold">{n}</td><td>{i}/20</td><td>{t}/80</td><td className="font-extrabold">{Number(i) + Number(t)}/100</td><td><span className="badge bg-emerald-50 text-emerald-700">A</span></td></tr>)}</tbody></table>
          <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="badge bg-violet-50 text-violet-700">Result: Pass</span><span className="badge bg-sky-50 text-sky-700">Percentage 87%</span><span className="badge bg-amber-50 text-amber-700">Rank #3</span></div>
        </div>
        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><Timer size={16} /> Timetable — today</h3>
          <ul className="space-y-2 text-sm">{[["P1", "Mathematics", "08:30–09:15"], ["P2", "Science", "09:15–10:00"], ["P3", "English", "10:15–11:00"]].map(([p, s, t]) => <li key={p} className="flex items-center gap-3 rounded-xl bg-[color:var(--brand2-soft)] p-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-extrabold text-[color:var(--brand)]">{p}</span><b className="flex-1">{s}</b><span className="text-xs text-[color:var(--ink-soft)]">{t}</span></li>)}</ul>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><Megaphone size={16} /> Announcements</h3>
          <div className="space-y-2 text-sm"><div className="rounded-xl bg-amber-50 p-2.5"><b>Sample: Parent–Teacher Meeting</b><div className="text-xs text-[color:var(--ink-soft)]">Demo announcement text</div></div><div className="rounded-xl bg-sky-50 p-2.5"><b>Sample: Sports Day</b><div className="text-xs text-[color:var(--ink-soft)]">Demo announcement text</div></div></div>
        </div>
        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><Wallet size={16} /> Fees</h3>
          <div className="space-y-1.5 text-sm">{[["Tuition Fee", "Demo"], ["Bus Fee", "Demo"], ["Due date", "—"]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-dashed border-[color:var(--line)] pb-1"><span className="text-[color:var(--ink-soft)]">{k}</span><b>{v}</b></div>)}</div>
          <div className="mt-3 flex gap-2"><Dis>Pay fees</Dis><Dis className="btn btn-ghost btn-sm">Receipts</Dis></div>
        </div>
        <div className={cards}>
          <h3 className="section-title mb-3 flex items-center gap-2"><Bus size={16} /> Transport</h3>
          <div className="space-y-1.5 text-sm">{[["Bus", "SW-DEMO"], ["Route", "Sample route"], ["Pick-up", "Stop 2 · 07:10"]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-dashed border-[color:var(--line)] pb-1"><span className="text-[color:var(--ink-soft)]">{k}</span><b>{v}</b></div>)}</div>
          <div className="mt-3"><Dis>Track bus live</Dis></div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- non-teaching staff */
const CATS = ["Office Staff", "Cleaner", "Watchman", "Helper", "Maintenance", "Other"];
const DEMO_ROWS = [
  ["NT-DEMO-01", "Sample Staff A", "Administration", "Office Staff", "98xxxxxx01", "01 Jun 2020", "Active"],
  ["NT-DEMO-02", "Sample Staff B", "Housekeeping", "Cleaner", "98xxxxxx02", "15 Jul 2021", "Active"],
  ["NT-DEMO-03", "Sample Staff C", "Security", "Watchman", "98xxxxxx03", "03 Jan 2019", "Active"],
  ["NT-DEMO-04", "Sample Staff D", "Support", "Helper", "98xxxxxx04", "10 Aug 2022", "Inactive"],
  ["NT-DEMO-05", "Sample Staff E", "Maintenance", "Maintenance", "98xxxxxx05", "22 Feb 2018", "Active"],
];
export function NonTeachingPreview() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATS.map((c, i) => <button key={c} type="button" disabled className="btn btn-ghost btn-sm" style={i === 0 ? { background: "var(--brand-soft)" } : undefined}>{c}</button>)}
      </div>
      <div className="card card-pad flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><label className="label">Search</label><div className="relative"><Search size={16} className="absolute left-3 top-3 text-[color:var(--ink-soft)]" /><input disabled className="input !pl-9" placeholder="Name, employee ID or phone" aria-label="Search non-teaching staff" /></div></div>
        <div className="w-44"><label className="label">Category</label><select disabled className="select" aria-label="Filter by category"><option>All categories</option></select></div>
        <div className="w-40"><label className="label">Status</label><select disabled className="select" aria-label="Filter by status"><option>All</option></select></div>
        <Dis className="btn btn-primary">Add staff</Dis>
      </div>
      <div className="card table-wrap">
        <div className="flex items-center gap-2 p-4 pb-0"><h3 className="section-title flex-1">Non-teaching staff directory</h3><DemoBadge /></div>
        <table className="table mt-3">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Phone</th><th>Joining date</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {DEMO_ROWS.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) => <td key={i} className={i === 1 ? "font-bold text-[color:var(--ink-strong)]" : ""}>{i === 6 ? <span className={`badge ${c === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{c}</span> : c}</td>)}
                <td><div className="flex justify-end gap-1.5"><Dis className="btn btn-ghost btn-sm">View profile</Dis><Dis className="btn btn-ghost btn-sm">Edit</Dis><Dis className="btn btn-ghost btn-sm">Deactivate</Dis></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- map (GPS) */
export function MapIllustration() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2"><MapPin size={16} className="text-[color:var(--brand)]" /><h3 className="section-title flex-1">Map view</h3><DemoBadge text="Illustration only — no live location" /></div>
      <svg viewBox="0 0 800 260" className="block w-full" role="img" aria-label="Illustrative map placeholder. No live location is shown.">
        <rect width="800" height="260" fill="#eef6ff" />
        {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="260" stroke="#dbe8fb" />)}
        {Array.from({ length: 4 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 70} x2="800" y2={i * 70} stroke="#dbe8fb" />)}
        <path d="M40 200 C 180 60, 300 220, 430 120 S 640 60, 760 150" fill="none" stroke="#a5b4fc" strokeWidth="6" strokeDasharray="4 12" strokeLinecap="round" />
        <rect x="18" y="210" width="44" height="26" rx="8" fill="#e6e3f7" /><text x="40" y="228" textAnchor="middle" fontSize="12" fontWeight="700" fill="#6b6ea6">Stop</text>
        <rect x="738" y="132" width="52" height="26" rx="8" fill="#e6e3f7" /><text x="764" y="150" textAnchor="middle" fontSize="12" fontWeight="700" fill="#6b6ea6">School</text>
        <text x="400" y="246" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8a8fc0">Live positions appear here after activation</text>
      </svg>
    </div>
  );
}
