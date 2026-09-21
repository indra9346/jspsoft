import Link from "next/link";
import { Crown, Download, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { examResults } from "@/lib/results";
import { Badge, Empty, PageHeader, Tile } from "@/components/ui";
import { BarsChart, TrendChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { GRADE_SCALE, PASS_PERCENT, className, examMax, gradeFor } from "@/lib/utils";

export const metadata = { title: "Results" };

interface SP { exam?: string; class?: string; view?: string; subject?: string }

export default async function ResultsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "results");
  const sp = await searchParams;
  return user.role === "STUDENT" ? <StudentResults user={user} sp={sp} /> : <ClassResults user={user} sp={sp} />;
}

const gradeChip = (percent: number) => {
  const g = gradeFor(percent);
  return <span className="badge" style={{ color: g.color, background: `color-mix(in srgb, ${g.color} 13%, white)` }}>{g.grade}</span>;
};

/* -------------------------------------------------------------- student */
async function StudentResults({ user, sp }: { user: SessionUser; sp: SP }) {
  const st = user.student!; // own results only: id comes from the session
  const exams = await db.exam.findMany({ where: { published: true }, orderBy: { startDate: "asc" } });
  const all = await Promise.all(exams.map(async (e) => ({ exam: e, res: await examResults(e.id, st.classId) })));
  const withMine = all.map((a) => ({ ...a, me: a.res?.rows.find((r) => r.studentId === st.id) })).filter((a) => a.me && a.me.outOf > 0);
  const chosen = withMine.find((a) => a.exam.id === sp.exam) ?? withMine[withMine.length - 1];

  if (!chosen) return (<div><PageHeader title="Marks & Results" icon="results" color="linear-gradient(135deg,#f97316,#f43f5e)" /><Empty title="No results published yet" hint="Your marks will appear here as soon as your teachers save them." /></div>);

  const { exam, res, me } = chosen;
  const subjects = res!.subjects;
  const per = res!.perSubject;
  const avgs = subjects.map((s) => {
    const vals = res!.rows.map((r) => r.marks[s.id]?.total).filter((v): v is number => v !== undefined);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  });

  return (
    <div>
      <PageHeader title="Marks & Results" subtitle={`Class ${className(st.classRoom)} · Roll no. ${st.rollNo}`} icon="results" color="linear-gradient(135deg,#f97316,#f43f5e)"
        actions={<><Link className="btn btn-primary" href={`/results/report-card/${st.id}?exam=${exam.id}`}><FileText size={16} /> Report card</Link><a className="btn btn-ghost" href={`/results/report-card/${st.id}/pdf?exam=${exam.id}`}><Download size={16} /> Download PDF</a></>} />
      <div className="mb-5 flex flex-wrap gap-2">{withMine.map((a) => <Link key={a.exam.id} href={`/results?exam=${a.exam.id}`} className={`btn btn-sm ${a.exam.id === exam.id ? "btn-primary" : "btn-ghost"}`}>{a.exam.name}</Link>)}</div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Total" value={`${me!.total}/${me!.outOf}`} tone="blue" icon="marks" />
        <Tile label="Percentage" value={`${me!.percent}%`} tone="orange" icon="results" sub={`Grade ${me!.grade} · ${gradeFor(me!.percent).label}`} />
        <Tile label="Class rank" value={me!.rank ? `#${me!.rank}` : "—"} tone="green" icon="students" sub={`of ${res!.rows.length}`} />
        <Tile label="Result" value={me!.pass ? "Pass" : "Fail"} tone={me!.pass ? "teal" : "pink"} icon="attendance" sub={`Pass mark ${PASS_PERCENT}% per subject`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card table-wrap">
          <div className="p-4 pb-0"><h2 className="section-title">Subject-wise · {exam.name}</h2></div>
          <table className="table mt-3">
            <thead><tr><th>Subject</th><th>Internal /{exam.maxInternal}</th><th>Theory /{exam.maxTheory}</th><th>Total /{per}</th><th>%</th><th>Grade</th><th>Class avg</th></tr></thead>
            <tbody>
              {subjects.map((s, i) => {
                const m = me!.marks[s.id];
                const pct = m ? (m.total / per) * 100 : null;
                return (
                  <tr key={s.id}>
                    <td className="font-bold text-[color:var(--ink-strong)]">{s.name}</td>
                    <td>{m?.internal ?? "—"}</td><td>{m?.theory ?? "—"}</td><td className="font-extrabold">{m?.total ?? "—"}</td>
                    <td>{pct === null ? "—" : `${Math.round(pct * 10) / 10}%`}</td><td>{pct === null ? "—" : gradeChip(pct)}</td>
                    <td className="text-[color:var(--ink-soft)]">{avgs[i]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-2">Subject performance</h2>
          <BarsChart height={290} max={per} data={subjects.map((s, i) => ({ subject: s.code, You: me!.marks[s.id]?.total ?? 0, "Class avg": avgs[i] }))} xKey="subject" series={[{ key: "You", label: "You", color: "#8b5cf6" }, { key: "Class avg", label: "Class avg", color: "#06b6d4" }]} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card table-wrap">
          <div className="p-4 pb-0"><h2 className="section-title">Exam-wise summary</h2></div>
          <table className="table mt-3">
            <thead><tr><th>Exam</th><th>Total</th><th>%</th><th>Grade</th><th>Rank</th><th /></tr></thead>
            <tbody>
              {withMine.map((a) => (
                <tr key={a.exam.id}>
                  <td className="font-bold text-[color:var(--ink-strong)]">{a.exam.name}</td><td>{a.me!.total}/{a.me!.outOf}</td><td>{a.me!.percent}%</td><td>{gradeChip(a.me!.percent)}</td><td>{a.me!.rank ? `#${a.me!.rank}` : "—"}</td>
                  <td className="text-right"><Link className="btn btn-ghost btn-sm" href={`/results/report-card/${st.id}?exam=${a.exam.id}`}>Report card</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-pad"><h2 className="section-title mb-2">Exam performance</h2><TrendChart data={withMine.map((a) => ({ exam: a.exam.name, Percent: a.me!.percent }))} xKey="exam" yKey="Percent" label="Percent" unit="%" color="#f97316" height={220} /></div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- admin/teacher */
async function ClassResults({ user, sp }: { user: SessionUser; sp: SP }) {
  const [exams, classes] = await Promise.all([db.exam.findMany({ orderBy: { startDate: "desc" } }), visibleClasses(user)]);
  const exam = exams.find((e) => e.id === sp.exam) ?? exams.find((e) => e.startDate <= new Date()) ?? exams[0];
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];
  const view = sp.view === "subject" ? "subject" : "exam";
  const link = (p: Partial<SP>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ exam: exam?.id, class: cls?.id, view, ...p })) if (v) u.set(k, v);
    return `/results?${u}`;
  };

  const header = <PageHeader title="Results" subtitle="Exam-wise and subject-wise results with grades, pass/fail and ranks" icon="results" color="linear-gradient(135deg,#f97316,#f43f5e)" actions={<>{exam && cls && <a className="btn btn-ghost" href={`/reports/export?type=results&exam=${exam.id}&class=${cls.id}`}><Download size={16} /> Download</a>}<PrintButton /></>} />;
  if (!exam || !cls) return <div>{header}<Empty title="Nothing to show yet" hint="You need at least one exam and one class." /></div>;

  return (
    <div>
      {header}
      <div className="card card-pad no-print mb-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={link({ view: "exam" })} className={`btn btn-sm ${view === "exam" ? "btn-primary" : "btn-ghost"}`}>Exam-wise view</Link>
          <Link href={link({ view: "subject" })} className={`btn btn-sm ${view === "subject" ? "btn-primary" : "btn-ghost"}`}>Subject-wise view</Link>
        </div>
        {view === "exam" && <div className="flex flex-wrap gap-2">{exams.map((e) => <Link key={e.id} href={link({ exam: e.id })} className={`btn btn-sm ${e.id === exam.id ? "btn-soft !border-[color:var(--brand)]" : "btn-ghost"}`}>{e.name}</Link>)}</div>}
        <div className="flex flex-wrap gap-2">{classes.map((c) => <Link key={c.id} href={link({ class: c.id })} className={`btn btn-sm ${c.id === cls.id ? "btn-soft !border-[color:var(--brand)]" : "btn-ghost"}`}>{className(c)}</Link>)}</div>
      </div>
      {view === "exam" ? <ExamView examId={exam.id} classId={cls.id} name={className(cls)} /> : <SubjectView classId={cls.id} name={className(cls)} subjectId={sp.subject} link={link} exams={exams} user={user} />}
    </div>
  );
}

async function ExamView({ examId, classId, name }: { examId: string; classId: string; name: string }) {
  const data = await examResults(examId, classId);
  if (!data) return null;
  const { exam, subjects, rows, perSubject } = data;
  const scored = rows.filter((r) => r.outOf > 0);
  if (!scored.length) return <Empty title="No marks entered for this section yet" />;
  const avg = Math.round((scored.reduce((s, r) => s + r.percent, 0) / scored.length) * 10) / 10;
  const passed = scored.filter((r) => r.pass).length;
  const top = [...scored].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];
  const subjAvg = subjects.map((s) => {
    const v = rows.map((r) => r.marks[s.id]?.total).filter((x): x is number => x !== undefined);
    return { subject: s.code, Average: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0 };
  });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Class average" value={`${avg}%`} tone="blue" icon="results" sub={`${name} · ${exam.name}`} />
        <Tile label="Pass percentage" value={`${Math.round((passed / scored.length) * 100)}%`} tone="green" icon="attendance" sub={`${passed} of ${scored.length} passed`} />
        <Tile label="Topper" value={top.name.split(" ")[0]} tone="orange" icon="students" sub={`${top.percent}% · Grade ${top.grade}`} />
        <Tile label="Marks / subject" value={perSubject} tone="purple" icon="marks" sub={`${exam.maxInternal} internal + ${exam.maxTheory} theory`} />
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Rank</th><th>Roll</th><th>Adm. no.</th><th>Student</th>{subjects.map((s) => <th key={s.id} title={s.name}>{s.code}</th>)}<th>Total</th><th>%</th><th>Grade</th><th>Result</th><th /></tr></thead>
          <tbody>
            {[...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((r) => (
              <tr key={r.studentId}>
                <td>{r.rank === 1 ? <span className="inline-flex items-center gap-1 font-extrabold text-amber-500"><Crown size={14} /> 1</span> : (r.rank ?? "—")}</td>
                <td>{r.rollNo}</td><td className="text-xs">{r.admissionNo}</td>
                <td className="whitespace-nowrap font-bold text-[color:var(--ink-strong)]"><Link href={`/students/${r.studentId}`}>{r.name}</Link></td>
                {subjects.map((s) => {
                  const m = r.marks[s.id];
                  const fail = m !== undefined && (m.total / perSubject) * 100 < PASS_PERCENT;
                  return <td key={s.id} className={fail ? "font-bold text-rose-600" : ""} title={m ? `Internal ${m.internal} · Theory ${m.theory}` : ""}>{m?.total ?? "—"}</td>;
                })}
                <td className="font-bold">{r.total}/{r.outOf}</td><td>{r.outOf ? `${r.percent}%` : "—"}</td><td>{r.outOf ? gradeChip(r.percent) : "—"}</td>
                <td>{r.outOf ? <Badge color={r.pass ? "#059669" : "#e11d48"}>{r.pass ? "Pass" : "Fail"}</Badge> : "—"}</td>
                <td className="no-print"><Link className="btn btn-ghost btn-sm" href={`/results/report-card/${r.studentId}?exam=${exam.id}`}>Report card</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card card-pad"><h2 className="section-title mb-2">Subject averages (out of {perSubject})</h2><BarsChart data={subjAvg} xKey="subject" max={perSubject} series={[{ key: "Average", label: "Average", color: "#f97316" }]} /></div>
        <div className="card card-pad">
          <h2 className="section-title mb-3">Grading scale</h2>
          <div className="grid grid-cols-2 gap-2">
            {GRADE_SCALE.map((g, i) => (
              <div key={g.grade} className="flex items-center gap-2 rounded-xl p-2 text-sm" style={{ background: `color-mix(in srgb, ${g.color} 10%, white)` }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg font-extrabold text-white" style={{ background: g.color }}>{g.grade}</span>
                <span className="text-xs font-semibold text-[color:var(--ink-strong)]">{g.min}{i === 0 ? "%+" : `–${GRADE_SCALE[i - 1].min - 1}%`}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[color:var(--ink-soft)]">A student passes when every subject is at or above {PASS_PERCENT}%.</p>
        </div>
      </div>
    </div>
  );
}

async function SubjectView({ classId, name, subjectId, link, exams, user }: { classId: string; name: string; subjectId?: string; link: (p: Partial<SP>) => string; exams: { id: string; name: string; maxInternal: number; maxTheory: number; startDate: Date }[]; user: SessionUser }) {
  const allocs = await db.allocation.findMany({ where: { classId }, include: { subject: true }, orderBy: { subject: { name: "asc" } } });
  void user;
  const alloc = allocs.find((a) => a.subjectId === subjectId) ?? allocs[0];
  if (!alloc) return <Empty title="No subjects allocated to this section" />;
  const chron = [...exams].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const [students, marks] = await Promise.all([
    db.student.findMany({ where: { classId, subjects: { some: { subjectId: alloc.subjectId } } }, include: { user: true }, orderBy: { rollNo: "asc" } }),
    db.mark.findMany({ where: { subjectId: alloc.subjectId, student: { classId } } }),
  ]);
  const avg = chron.map((e) => {
    const v = marks.filter((m) => m.examId === e.id).map((m) => ((m.internal + m.theory) / examMax(e)) * 100);
    return { exam: e.name, Average: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0 };
  });
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2">{allocs.map((a) => <Link key={a.id} href={link({ subject: a.subjectId, view: "subject" })} className={`btn btn-sm ${a.id === alloc.id ? "btn-primary" : "btn-ghost"}`}>{a.subject.name}</Link>)}</div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card table-wrap">
          <div className="p-4 pb-0"><h2 className="section-title">{alloc.subject.name} · {name}</h2></div>
          <table className="table mt-3">
            <thead><tr><th>Roll</th><th>Student</th>{chron.map((e) => <th key={e.id}>{e.name}</th>)}<th>Average %</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const cells = chron.map((e) => marks.find((m) => m.examId === e.id && m.studentId === s.id));
                const pcts = cells.map((c, i) => (c ? ((c.internal + c.theory) / examMax(chron[i])) * 100 : null)).filter((x): x is number => x !== null);
                const a = pcts.length ? Math.round((pcts.reduce((x, y) => x + y, 0) / pcts.length) * 10) / 10 : null;
                return (
                  <tr key={s.id}>
                    <td>{s.rollNo}</td><td className="font-bold text-[color:var(--ink-strong)]">{s.user.name}</td>
                    {cells.map((c, i) => <td key={chron[i].id}>{c ? `${c.internal + c.theory}/${examMax(chron[i])}` : "—"}</td>)}
                    <td>{a === null ? "—" : <span className="flex items-center gap-2">{a}% {gradeChip(a)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card card-pad"><h2 className="section-title mb-2">Class average by exam</h2><TrendChart data={avg} xKey="exam" yKey="Average" label="Average" unit="%" color="#10b981" /></div>
      </div>
    </div>
  );
}
