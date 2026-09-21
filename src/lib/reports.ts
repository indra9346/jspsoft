import "server-only";
import { db } from "@/lib/db";
import { examResults } from "@/lib/results";
import { attendanceCounts, attendancePercent, className, examMax, fmtDate, gradeFor, iso, LEAVE_TYPES, monthLabel, monthRange, monthStr, todayISO, toDate, PASS_PERCENT } from "@/lib/utils";

export const REPORT_TYPES = [
  { key: "students", label: "Student report" },
  { key: "staff", label: "Staff report" },
  { key: "attendance", label: "Attendance report" },
  { key: "marks", label: "Marks report" },
  { key: "results", label: "Results report" },
  { key: "classes", label: "Class report" },
  { key: "sections", label: "Section report" },
  { key: "transport", label: "Transport report" },
  { key: "leave", label: "Leave report" },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]["key"];

export interface Filters { month?: string; exam?: string; classId?: string; subjectId?: string; studentId?: string; status?: string; year?: string }
export interface Report {
  title: string;
  filename: string;
  columns: string[];
  rows: (string | number)[][];
  summary: { label: string; value: string | number }[];
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export async function buildReport(type: ReportType, f: Filters): Promise<Report> {
  const month = f.month ?? monthStr(todayISO());
  const { from, to } = monthRange(month);
  const range = { gte: toDate(from), lte: toDate(to) };

  switch (type) {
    case "students": {
      const list = await db.student.findMany({
        where: { ...(f.classId && { classId: f.classId }), ...(f.status && { user: { active: f.status === "active" } }) },
        include: { user: true, classRoom: true, academicYear: true, bus: true },
        orderBy: [{ classRoom: { grade: "asc" } }, { classRoom: { section: "asc" } }, { rollNo: "asc" }],
      });
      return {
        title: "Student report", filename: "students",
        columns: ["Admission no", "Name", "Class", "Section", "Roll", "Academic year", "Gender", "Date of birth", "Guardian", "Guardian phone", "Bus", "Status"],
        rows: list.map((s) => [s.admissionNo, s.user.name, s.classRoom.grade, s.classRoom.section, s.rollNo, s.academicYear.name, s.gender === "M" ? "Male" : "Female", iso(s.dob), s.guardianName, s.guardianPhone, s.bus?.busNumber ?? "—", s.user.active ? "Active" : "Inactive"]),
        summary: [{ label: "Students", value: list.length }, { label: "Boys", value: list.filter((s) => s.gender === "M").length }, { label: "Girls", value: list.filter((s) => s.gender === "F").length }, { label: "On school bus", value: list.filter((s) => s.busId).length }],
      };
    }
    case "staff": {
      const [list, att] = await Promise.all([
        db.staff.findMany({ where: { staffType: "TEACHING" }, include: { user: true, allocations: { include: { subject: true, classRoom: true } } }, orderBy: { employeeId: "asc" } }),
        db.staffAttendance.findMany({ where: { date: range } }),
      ]);
      return {
        title: `Staff report · ${monthLabel(month)}`, filename: `staff-${month}`,
        columns: ["Employee ID", "Name", "Designation", "Department", "Phone", "Joined", "Subjects & classes", `Attendance % (${monthLabel(month)})`, "Status"],
        rows: list.map((s) => [s.employeeId, s.user.name, s.designation, s.department ?? "", s.user.phone ?? "", iso(s.joinDate), s.allocations.map((a) => `${a.subject.code} ${className(a.classRoom)}`).join(", "), attendancePercent(att.filter((a) => a.staffId === s.id)), s.user.active ? "Active" : "Inactive"]),
        summary: [{ label: "Teaching staff", value: list.length }, { label: "Staff attendance", value: `${attendancePercent(att)}%` }],
      };
    }
    case "attendance": {
      if (f.studentId) {
        const s = await db.student.findUnique({ where: { id: f.studentId }, include: { user: true, classRoom: true } });
        const recs = s ? await db.studentAttendance.findMany({ where: { studentId: s.id }, orderBy: { date: "desc" } }) : [];
        const c = attendanceCounts(recs);
        return {
          title: `Attendance · ${s?.user.name ?? ""} (${s ? className(s.classRoom) : ""})`, filename: `attendance-${s?.admissionNo ?? "student"}`,
          columns: ["Date", "Day", "Status"], rows: recs.map((r) => [iso(r.date), fmtDate(r.date, { weekday: "long", day: undefined, month: undefined, year: undefined }), r.status]),
          summary: [{ label: "Attendance", value: `${c.percent}%` }, { label: "Present", value: c.present }, { label: "Absent", value: c.absent }, { label: "Late", value: c.late }, { label: "Excused", value: c.excused }],
        };
      }
      const classes = await db.classRoom.findMany({ where: f.classId ? { id: f.classId } : {}, orderBy: [{ grade: "asc" }, { section: "asc" }] });
      const recs = await db.studentAttendance.findMany({ where: { classId: { in: classes.map((c) => c.id) }, date: range } });
      const all = attendanceCounts(recs);
      if (f.classId && classes[0]) {
        const students = await db.student.findMany({ where: { classId: f.classId }, include: { user: true }, orderBy: { rollNo: "asc" } });
        return {
          title: `Attendance · ${className(classes[0])} · ${monthLabel(month)}`, filename: `attendance-${className(classes[0])}-${month}`,
          columns: ["Roll", "Student", "Present", "Absent", "Late", "Excused", "Attendance %"],
          rows: students.map((s) => { const c = attendanceCounts(recs.filter((r) => r.studentId === s.id)); return [s.rollNo, s.user.name, c.present, c.absent, c.late, c.excused, c.percent]; }),
          summary: [{ label: "Section attendance", value: `${all.percent}%` }, { label: "Present", value: all.present + all.late }, { label: "Absent", value: all.absent }, { label: "Students", value: students.length }],
        };
      }
      const enrolled = await db.student.groupBy({ by: ["classId"], _count: true });
      const rows = classes.map((c) => { const k = attendanceCounts(recs.filter((r) => r.classId === c.id)); return [c.grade, c.section, enrolled.find((e) => e.classId === c.id)?._count ?? 0, k.present, k.absent, k.late, k.excused, k.percent]; });
      rows.push(["SCHOOL TOTAL", "", enrolled.reduce((a, e) => a + e._count, 0), all.present, all.absent, all.late, all.excused, all.percent]);
      return {
        title: `Overall attendance · ${monthLabel(month)}`, filename: `attendance-overall-${month}`,
        columns: ["Class", "Section", "Students", "Present", "Absent", "Late", "Excused", "Attendance %"], rows,
        summary: [{ label: "School attendance", value: `${all.percent}%` }, { label: "Present", value: all.present + all.late }, { label: "Absent", value: all.absent }, { label: "Records", value: all.total }],
      };
    }
    case "marks": {
      const exam = f.exam ? await db.exam.findUnique({ where: { id: f.exam } }) : await db.exam.findFirst({ where: { startDate: { lte: new Date() } }, orderBy: { startDate: "desc" } });
      if (!exam) return { title: "Marks report", filename: "marks", columns: ["Info"], rows: [["No exam found"]], summary: [] };
      const per = examMax(exam);
      if (f.studentId) {
        const s = await db.student.findUnique({ where: { id: f.studentId }, include: { user: true } });
        const marks = await db.mark.findMany({ where: { examId: exam.id, studentId: f.studentId }, include: { subject: true }, orderBy: { subject: { name: "asc" } } });
        return {
          title: `Marks · ${s?.user.name ?? ""} · ${exam.name}`, filename: `marks-${s?.admissionNo ?? "student"}`,
          columns: ["Subject", "Internal", "Theory", "Total", "Out of", "%", "Grade"],
          rows: marks.map((m) => { const t = m.internal + m.theory; return [m.subject.name, m.internal, m.theory, t, per, Math.round((t / per) * 1000) / 10, gradeFor((t / per) * 100).grade]; }),
          summary: [{ label: "Exam", value: exam.name }],
        };
      }
      if (f.classId && f.subjectId) {
        const [students, marks, subj] = await Promise.all([
          db.student.findMany({ where: { classId: f.classId, subjects: { some: { subjectId: f.subjectId } } }, include: { user: true }, orderBy: { rollNo: "asc" } }),
          db.mark.findMany({ where: { examId: exam.id, subjectId: f.subjectId, student: { classId: f.classId } } }),
          db.subject.findUnique({ where: { id: f.subjectId } }),
        ]);
        const tots = marks.map((m) => m.internal + m.theory);
        return {
          title: `Marks · ${subj?.name} · ${exam.name}`, filename: `marks-${subj?.code}-${exam.name}`,
          columns: ["Roll", "Student", "Internal", "Theory", "Total", "%", "Grade"],
          rows: students.map((s) => { const m = marks.find((x) => x.studentId === s.id); const t = m ? m.internal + m.theory : null; return [s.rollNo, s.user.name, m?.internal ?? "—", m?.theory ?? "—", t ?? "—", t === null ? "—" : Math.round((t / per) * 1000) / 10, t === null ? "—" : gradeFor((t / per) * 100).grade]; }),
          summary: [{ label: "Class average", value: tots.length ? Math.round((tots.reduce((a, b) => a + b, 0) / tots.length) * 10) / 10 : 0 }, { label: "Highest", value: tots.length ? Math.max(...tots) : 0 }, { label: "Lowest", value: tots.length ? Math.min(...tots) : 0 }, { label: "Out of", value: per }],
        };
      }
      const classes = await db.classRoom.findMany({ where: f.classId ? { id: f.classId } : {}, orderBy: [{ grade: "asc" }, { section: "asc" }] });
      const rows: (string | number)[][] = [];
      for (const c of classes) {
        const res = await examResults(exam.id, c.id);
        for (const sub of res?.subjects ?? []) {
          const v = (res?.rows ?? []).map((r) => r.marks[sub.id]?.total).filter((x): x is number => x !== undefined);
          rows.push([className(c), sub.name, v.length, v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0, v.length ? Math.max(...v) : 0, v.length ? Math.min(...v) : 0, v.length ? Math.round((v.filter((x) => (x / per) * 100 >= PASS_PERCENT).length / v.length) * 100) : 0]);
        }
      }
      return { title: `Marks summary · ${exam.name}`, filename: `marks-${exam.name}`, columns: ["Section", "Subject", "Students", "Average", "Highest", "Lowest", "Pass %"], rows, summary: [{ label: "Exam", value: exam.name }, { label: "Out of", value: per }] };
    }
    case "results": {
      const exam = f.exam ? await db.exam.findUnique({ where: { id: f.exam } }) : await db.exam.findFirst({ where: { startDate: { lte: new Date() } }, orderBy: { startDate: "desc" } });
      if (!exam) return { title: "Results report", filename: "results", columns: ["Info"], rows: [["No exam found"]], summary: [] };
      const classes = await db.classRoom.findMany({ where: f.classId ? { id: f.classId } : {}, orderBy: [{ grade: "asc" }, { section: "asc" }] });
      const rows: (string | number)[][] = [];
      let passed = 0, total = 0;
      for (const c of classes) {
        const r = await examResults(exam.id, c.id);
        for (const x of r?.rows.filter((y) => y.outOf > 0) ?? []) { total++; if (x.pass) passed++; rows.push([x.admissionNo, x.name, c.grade, c.section, exam.name, x.total, x.outOf, x.percent, x.grade, x.pass ? "Pass" : "Fail", x.rank ?? ""]); }
      }
      return { title: `Results · ${exam.name}`, filename: `results-${exam.name}`, columns: ["Admission no", "Student", "Class", "Section", "Exam", "Total", "Out of", "Percentage", "Grade", "Result", "Rank"], rows, summary: [{ label: "Students", value: total }, { label: "Passed", value: passed }, { label: "Pass %", value: `${pct(passed, total)}%` }] };
    }
    case "classes": {
      const exam = f.exam ? await db.exam.findUnique({ where: { id: f.exam } }) : await db.exam.findFirst({ where: { startDate: { lte: new Date() } }, orderBy: { startDate: "desc" } });
      const classes = await db.classRoom.findMany({ include: { students: true }, orderBy: [{ grade: "asc" }, { section: "asc" }] });
      const recs = await db.studentAttendance.findMany({ where: { date: range }, select: { status: true, classId: true } });
      const grades = [...new Set(classes.map((c) => c.grade))];
      const rows: (string | number)[][] = [];
      for (const g of grades) {
        const secs = classes.filter((c) => c.grade === g);
        let sc = 0, sp = 0, ss = 0;
        for (const c of secs) { const r = exam ? await examResults(exam.id, c.id) : null; for (const x of r?.rows.filter((y) => y.outOf > 0) ?? []) { sc++; ss += x.percent; if (x.pass) sp++; } }
        rows.push([g, secs.map((s) => s.section).join(", "), secs.reduce((a, c) => a + c.students.length, 0), attendancePercent(recs.filter((r) => secs.some((s) => s.id === r.classId))), sc ? Math.round((ss / sc) * 10) / 10 : 0, pct(sp, sc)]);
      }
      return { title: `Class report · ${monthLabel(month)}${exam ? ` · ${exam.name}` : ""}`, filename: `classes-${month}`, columns: ["Class", "Sections", "Students", "Attendance %", "Average result %", "Pass %"], rows, summary: [{ label: "Classes", value: grades.length }, { label: "Sections", value: classes.length }] };
    }
    case "sections": {
      const exam = f.exam ? await db.exam.findUnique({ where: { id: f.exam } }) : await db.exam.findFirst({ where: { startDate: { lte: new Date() } }, orderBy: { startDate: "desc" } });
      const classes = await db.classRoom.findMany({ include: { students: true, classTeacher: { include: { user: true } } }, orderBy: [{ grade: "asc" }, { section: "asc" }] });
      const recs = await db.studentAttendance.findMany({ where: { date: range }, select: { status: true, classId: true } });
      const rows: (string | number)[][] = [];
      for (const c of classes) {
        const r = exam ? await examResults(exam.id, c.id) : null;
        const sc = r?.rows.filter((y) => y.outOf > 0) ?? [];
        rows.push([c.grade, c.section, c.classTeacher?.user.name ?? "—", c.students.length, c.students.filter((s) => s.gender === "M").length, c.students.filter((s) => s.gender === "F").length, attendancePercent(recs.filter((x) => x.classId === c.id)), sc.length ? Math.round((sc.reduce((a, b) => a + b.percent, 0) / sc.length) * 10) / 10 : 0, pct(sc.filter((x) => x.pass).length, sc.length)]);
      }
      return { title: `Section report · ${monthLabel(month)}${exam ? ` · ${exam.name}` : ""}`, filename: `sections-${month}`, columns: ["Class", "Section", "Class teacher", "Students", "Boys", "Girls", "Attendance %", "Average result %", "Pass %"], rows, summary: [{ label: "Sections", value: classes.length }] };
    }
    case "transport": {
      const buses = await db.bus.findMany({ include: { driver: true, stops: true, _count: { select: { students: true } } }, orderBy: { busNumber: "asc" } });
      return {
        title: "Transport report", filename: "transport",
        columns: ["Bus", "Registration", "Route", "Departure", "Arrival", "Driver", "Driver phone", "Licence", "Stops", "Capacity", "Students", "Status"],
        rows: buses.map((b) => [b.busNumber, b.registrationNo, b.routeName, b.departureTime, b.arrivalTime, b.driver?.name ?? "—", b.driver?.phone ?? "—", b.driver?.licenseNo ?? "—", b.stops.length, b.capacity, b._count.students, b.status]),
        summary: [{ label: "Buses", value: buses.length }, { label: "Active", value: buses.filter((b) => b.status === "ACTIVE").length }, { label: "Students on buses", value: buses.reduce((a, b) => a + b._count.students, 0) }, { label: "Seats", value: buses.reduce((a, b) => a + b.capacity, 0) }],
      };
    }
    case "leave": {
      const year = f.year ?? todayISO().slice(0, 4);
      const list = await db.leaveRequest.findMany({
        where: { fromDate: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) }, ...(f.status && { status: f.status as "PENDING" | "APPROVED" | "REJECTED" }) },
        include: { staff: { include: { user: true } } }, orderBy: { fromDate: "desc" },
      });
      const approved = list.filter((l) => l.status === "APPROVED");
      return {
        title: `Leave report · ${year}`, filename: `leave-${year}`,
        columns: ["Staff", "Employee ID", "Type", "From", "To", "Days", "Reason", "Status", "Remark"],
        rows: list.map((l) => [l.staff.user.name, l.staff.employeeId, LEAVE_TYPES[l.type].label, iso(l.fromDate), iso(l.toDate), l.days, l.reason, l.status, l.remark ?? ""]),
        summary: [{ label: "Requests", value: list.length }, { label: "Approved days", value: approved.reduce((a, l) => a + l.days, 0) }, { label: "Pending", value: list.filter((l) => l.status === "PENDING").length }, { label: "Rejected", value: list.filter((l) => l.status === "REJECTED").length }],
      };
    }
  }
}
