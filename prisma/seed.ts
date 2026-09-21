/* Demo data: "Swan School" (full) + "Riverdale Public School" (tiny second tenant used to prove data isolation).
   WARNING: wipes every table in the target database.   npm run db:seed */
import { PrismaClient, type AttendanceStatus, type StaffAttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const db = new PrismaClient();
const PASSWORD = "Swan@123";

let seed = 20260921;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s: string, n: number) => {
  const d = D(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdays = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (D(d).getUTCDay() !== 0) out.push(d);
  return out;
};

const PERIODS: [string, string][] = [
  ["08:30", "09:15"], ["09:15", "10:00"], ["10:15", "11:00"], ["11:00", "11:45"],
  ["12:30", "13:15"], ["13:15", "14:00"], ["14:00", "14:45"], ["14:45", "15:30"],
];

const SUBJECTS = [
  ["English", "ENG"], ["Mathematics", "MAT"], ["Science", "SCI"], ["Social Science", "SOC"],
  ["Hindi", "HIN"], ["Computer Science", "CSC"], ["Physical Education", "PED"], ["Art & Craft", "ART"],
];

const TEACHERS: [string, string, string, string][] = [
  ["Anita Sharma", "F", "M.Sc. Mathematics, B.Ed.", "Mathematics"],
  ["Suresh Kumar", "M", "M.Sc., B.Ed.", "Science"],
  ["Priya Natarajan", "F", "M.Sc. Physics, B.Ed.", "Science"],
  ["Karthik Subramanian", "M", "M.A. History, B.Ed.", "Social Science"],
  ["Meenakshi Iyer", "F", "M.A. Hindi, B.Ed.", "Hindi"],
  ["Rahul Verma", "M", "MCA, B.Ed.", "Computer Science"],
  ["Deepa Krishnan", "F", "M.P.Ed.", "Physical Education"],
  ["Vijay Anand", "M", "BFA, Diploma in Art Education", "Art & Craft"],
  ["Lakshmi Narayanan", "F", "M.A. English, B.Ed.", "English"],
  ["Mohammed Farooq", "M", "M.Sc. Mathematics, B.Ed.", "Mathematics"],
  ["Sneha Pillai", "F", "M.Sc. Chemistry, B.Ed.", "Science"],
  ["Arun Prakash", "M", "M.A. Economics, B.Ed.", "Social Science"],
  ["Divya Menon", "F", "M.A. English, B.Ed.", "English"],
  ["Ganesh Babu", "M", "M.A. Hindi, B.Ed.", "Hindi"],
  ["Revathi Sundaram", "F", "MCA, B.Ed.", "Computer Science"],
  ["Imran Khan", "M", "B.P.Ed.", "Physical Education"],
];

const FIRST_M = ["Aarav", "Vihaan", "Arjun", "Rohan", "Kabir", "Ishaan", "Aditya", "Dev", "Karthik", "Harish", "Naveen", "Siddharth", "Yash", "Pranav"];
const FIRST_F = ["Ananya", "Diya", "Ishita", "Meera", "Kavya", "Riya", "Saanvi", "Aditi", "Nandini", "Pooja", "Sanjana", "Tanvi", "Varsha", "Lavanya"];
const LAST = ["Sharma", "Iyer", "Reddy", "Nair", "Patel", "Menon", "Gupta", "Rao", "Krishnan", "Singh", "Pillai", "Das", "Chandran", "Mehta"];
const PARENT_FIRST = ["Ramesh", "Suresh", "Mahesh", "Lakshmi", "Geetha", "Sunil", "Anil", "Kavitha", "Rajesh", "Sudha"];
const BLOOD = ["A+", "B+", "O+", "AB+", "O-", "A-"];
const STREETS = ["Gandhi Street", "Nehru Nagar", "Lake View Road", "Temple Road", "Park Avenue", "Anna Salai"];

const BUS_DATA = [
  { n: "SW-01", reg: "TN 09 AB 1201", route: "Anna Nagar – Kilpauk – School", dep: "06:50", arr: "08:10", stops: ["Anna Nagar West", "Shenoy Nagar", "Kilpauk Garden", "Purasawalkam"] },
  { n: "SW-02", reg: "TN 09 AB 1202", route: "T Nagar – Guindy – School", dep: "06:45", arr: "08:15", stops: ["T Nagar Bus Stand", "Saidapet", "Guindy Junction", "Alandur"] },
  { n: "SW-03", reg: "TN 09 AC 2203", route: "Adyar – Velachery – School", dep: "06:55", arr: "08:20", stops: ["Adyar Signal", "Indira Nagar", "Velachery Main Road", "Taramani"] },
  { n: "SW-04", reg: "TN 09 AC 2204", route: "Porur – Vadapalani – School", dep: "07:00", arr: "08:10", stops: ["Porur Junction", "Valasaravakkam", "Vadapalani", "Ashok Nagar"] },
  { n: "SW-05", reg: "TN 09 AD 3205", route: "Tambaram – Chromepet – School", dep: "06:40", arr: "08:25", stops: ["Tambaram East", "Selaiyur", "Chromepet", "Pallavaram"] },
];
const DRIVERS = [["Murugesan K", "9840011201"], ["Selvaraj P", "9840011202"], ["Bala Subramani", "9840011203"], ["Ramesh Babu", "9840011204"], ["Jayakumar S", "9840011205"]];

async function main() {
  console.log("Wiping database…");
  await db.$executeRawUnsafe(`TRUNCATE TABLE "School" CASCADE`);
  const hash = await bcrypt.hash(PASSWORD, 10);
  const today = todayISO();

  /* ================= School A: Swan School ================= */
  const school = await db.school.create({
    data: {
      slug: "swan-school", name: "Swan School", address: "12, Swan Avenue, Anna Nagar, Chennai - 600040",
      phone: "+91 98765 43210", email: "office@swanschool.in", website: "https://www.swanschool.in", principalName: "Dr. Kavitha Raghavan",
    },
  });
  const sid = school.id;

  const prevYear = await db.academicYear.create({ data: { schoolId: sid, name: "2025-2026", startDate: D("2025-06-02"), endDate: D("2026-03-31") } });
  const year = await db.academicYear.create({ data: { schoolId: sid, name: "2026-2027", startDate: D("2026-06-01"), endDate: D("2027-03-31"), isCurrent: true } });
  void prevYear;

  const admin = await db.user.create({
    data: { schoolId: sid, email: "admin@swanschool.in", passwordHash: hash, name: "Admin Principal", role: "ADMIN", phone: "+91 98765 43210" },
  });

  const subjects: Awaited<ReturnType<typeof db.subject.create>>[] = [];
  for (const [name, code] of SUBJECTS) subjects.push(await db.subject.create({ data: { schoolId: sid, name, code } }));

  const teachers = [];
  for (let i = 0; i < TEACHERS.length; i++) {
    const [name, gender, qual, dept] = TEACHERS[i];
    const u = await db.user.create({
      data: {
        schoolId: sid, email: `teacher${i + 1}@swanschool.in`, passwordHash: hash, name, role: "TEACHER",
        phone: `+91 90000 ${String(10000 + i * 137).slice(0, 5)}`,
        staff: {
          create: {
            schoolId: sid, employeeId: `T${String(i + 1).padStart(3, "0")}`, designation: i < 3 ? "Senior Teacher" : "Teacher",
            department: dept, qualification: qual, gender, joinDate: D(`${2015 + (i % 9)}-06-${String(1 + (i % 20)).padStart(2, "0")}`),
          },
        },
      },
      include: { staff: true },
    });
    teachers.push(u.staff!);
  }

  const classes = [];
  let ci = 0;
  for (const grade of ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"])
    for (const section of ["A", "B"]) {
      classes.push(await db.classRoom.create({ data: { schoolId: sid, academicYearId: year.id, grade, section, classTeacherId: teachers[ci % teachers.length].id } }));
      ci++;
    }

  const alloc = new Map<string, string>();
  for (let c = 0; c < classes.length; c++)
    for (let s = 0; s < subjects.length; s++) {
      let teacher = teachers[(s + Math.floor(c / 2) + (c % 2) * 4) % teachers.length];
      if (classes[c].grade === "Class 10" && classes[c].section === "A" && subjects[s].code === "MAT") teacher = teachers[0]; // Anita Sharma → 10-A Mathematics
      alloc.set(`${classes[c].id}:${subjects[s].id}`, teacher.id);
      await db.allocation.create({ data: { schoolId: sid, classId: classes[c].id, subjectId: subjects[s].id, teacherId: teacher.id } });
    }

  /* timetable – greedy, never double-books a teacher */
  const busy = new Set<string>();
  const slots: { schoolId: string; classId: string; day: number; period: number; startTime: string; endTime: string; subjectId: string; teacherId: string; room: string }[] = [];
  for (let day = 1; day <= 6; day++) {
    const periods = day === 6 ? 4 : 8;
    const used: Record<string, Record<string, number>> = {};
    for (let p = 1; p <= periods; p++)
      classes.forEach((cl, idx) => {
        used[cl.id] ??= {};
        const order = [...subjects].sort((a, b) => (used[cl.id][a.id] ?? 0) - (used[cl.id][b.id] ?? 0) || rnd() - 0.5);
        for (const sub of order) {
          const t = alloc.get(`${cl.id}:${sub.id}`)!;
          if (busy.has(`${t}:${day}:${p}`) || (used[cl.id][sub.id] ?? 0) >= 2) continue;
          busy.add(`${t}:${day}:${p}`);
          used[cl.id][sub.id] = (used[cl.id][sub.id] ?? 0) + 1;
          slots.push({ schoolId: sid, classId: cl.id, day, period: p, startTime: PERIODS[p - 1][0], endTime: PERIODS[p - 1][1], subjectId: sub.id, teacherId: t, room: `R-${101 + idx}` });
          break;
        }
      });
  }
  await db.timetableSlot.createMany({ data: slots });

  /* transport */
  const buses = [];
  for (let i = 0; i < BUS_DATA.length; i++) {
    const b = BUS_DATA[i];
    const driver = await db.driver.create({ data: { schoolId: sid, driverCode: `D${String(i + 1).padStart(3, "0")}`, name: DRIVERS[i][0], phone: `+91 ${DRIVERS[i][1]}`, licenseNo: `TN09 2019 00${12340 + i}` } });
    const bus = await db.bus.create({
      data: { schoolId: sid, busNumber: b.n, registrationNo: b.reg, capacity: 40, routeName: b.route, departureTime: b.dep, arrivalTime: b.arr, status: i === 4 ? "MAINTENANCE" : "ACTIVE", driverId: driver.id },
    });
    const stops = [];
    for (let k = 0; k < b.stops.length; k++) {
      const [h, m] = b.dep.split(":").map(Number);
      const mins = h * 60 + m + k * 12;
      stops.push(await db.busStop.create({ data: { schoolId: sid, busId: bus.id, name: b.stops[k], sequence: k + 1, pickupTime: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}` } }));
    }
    buses.push({ bus, stops });
  }

  /* students */
  const students: { id: string; classId: string; ability: number; name: string; email: string }[] = [];
  let n = 1;
  for (const cl of classes)
    for (let r = 1; r <= 10; r++) {
      const isRahul = cl.grade === "Class 10" && cl.section === "A" && r === 1;
      const female = isRahul ? false : rnd() > 0.5;
      const first = isRahul ? "Rahul" : pick(female ? FIRST_F : FIRST_M);
      const last = isRahul ? "Kumar" : pick(LAST);
      const gradeNo = Number(cl.grade.split(" ")[1]);
      const bus = rnd() < 0.45 ? pick(buses.slice(0, 4)) : null;
      const stop = bus ? pick(bus.stops) : null;
      const email = isRahul ? "rahul.kumar@swanschool.in" : `student${n}@swanschool.in`;
      const u = await db.user.create({
        data: {
          schoolId: sid, email, passwordHash: hash, name: `${first} ${last}`, role: "STUDENT", phone: `+91 9${Math.floor(100000000 + rnd() * 899999999)}`,
          student: {
            create: {
              schoolId: sid, admissionNo: `SW${2026}${String(n).padStart(3, "0")}`, rollNo: r, classId: cl.id, academicYearId: year.id,
              gender: female ? "F" : "M",
              dob: D(`${2026 - gradeNo - 5}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`),
              admissionDate: D(`2026-06-${String(1 + Math.floor(rnd() * 10)).padStart(2, "0")}`),
              guardianName: `${pick(PARENT_FIRST)} ${last}`, guardianPhone: `+91 9${Math.floor(100000000 + rnd() * 899999999)}`,
              address: `${Math.floor(1 + rnd() * 90)}, ${pick(STREETS)}, Chennai`, bloodGroup: pick(BLOOD),
              busId: bus?.bus.id ?? null, busStopId: stop?.id ?? null,
            },
          },
        },
        include: { student: true },
      });
      students.push({ id: u.student!.id, classId: cl.id, ability: isRahul ? 88 : 45 + rnd() * 50, name: u.name, email });
      n++;
    }

  await db.studentSubject.createMany({
    data: students.flatMap((s) => subjects.map((sub) => ({ schoolId: sid, studentId: s.id, subjectId: sub.id }))),
  });

  /* attendance – 1 Jul → today (monthly tracking) */
  const days = weekdays("2026-07-01", today).filter((d) => d <= today);
  const sa: { schoolId: string; studentId: string; classId: string; academicYearId: string; date: Date; status: AttendanceStatus; markedById: string }[] = [];
  for (const d of days)
    for (const st of students) {
      const r = rnd();
      const status: AttendanceStatus = r < 0.9 ? "PRESENT" : r < 0.95 ? "ABSENT" : r < 0.98 ? "LATE" : "EXCUSED";
      sa.push({ schoolId: sid, studentId: st.id, classId: st.classId, academicYearId: year.id, date: D(d), status, markedById: admin.id });
    }
  await db.studentAttendance.createMany({ data: sa });

  const ta: { schoolId: string; staffId: string; date: Date; status: StaffAttendanceStatus }[] = [];
  for (const d of days)
    for (const t of teachers) {
      const r = rnd();
      ta.push({ schoolId: sid, staffId: t.id, date: D(d), status: r < 0.93 ? "PRESENT" : r < 0.97 ? "LATE" : r < 0.99 ? "ABSENT" : "LEAVE" });
    }
  await db.staffAttendance.createMany({ data: ta });

  /* exams: two completed, one upcoming */
  const ut = await db.exam.create({ data: { schoolId: sid, academicYearId: year.id, name: "Unit Test 1", startDate: D("2026-08-10") } });
  const mid = await db.exam.create({ data: { schoolId: sid, academicYearId: year.id, name: "Mid-Term Exam", startDate: D("2026-09-08") } });
  await db.exam.create({ data: { schoolId: sid, academicYearId: year.id, name: "Half-Yearly Exam", startDate: D(addDays(today, 45)) } });
  await db.exam.create({ data: { schoolId: sid, academicYearId: year.id, name: "Unit Test 2", startDate: D(addDays(today, 18)) } });
  const marks: { schoolId: string; examId: string; studentId: string; subjectId: string; internal: number; theory: number }[] = [];
  for (const ex of [ut, mid])
    for (const st of students)
      for (const sub of subjects) {
        const total = Math.max(8, Math.min(100, Math.round(st.ability + (rnd() - 0.5) * 30 + (ex === mid ? 2 : 0))));
        let internal = Math.min(20, Math.round(total * 0.2));
        let theory = Math.min(80, total - internal);
        if (st.email === "rahul.kumar@swanschool.in" && sub.code === "MAT" && ex === mid) { internal = 18; theory = 72; }
        marks.push({ schoolId: sid, examId: ex.id, studentId: st.id, subjectId: sub.id, internal, theory });
      }
  await db.mark.createMany({ data: marks });

  /* announcements */
  const c10 = classes.filter((c) => c.grade === "Class 10");
  const ann: [string, string, "ALL" | "STUDENTS" | "TEACHERS" | "STAFF" | "CLASSES" | "SECTIONS", string, string | null, string[]][] = [
    ["Annual Sports Day", "Annual Sports Day will be held on the school grounds on the coming Friday. All students should report by 8:00 AM in sports uniform.", "ALL", "IMPORTANT", addDays(today, 10), []],
    ["Staff Meeting – Curriculum Planning", "All teaching staff are requested to attend the curriculum planning meeting in the conference hall at 3:45 PM on Thursday.", "TEACHERS", "NORMAL", addDays(today, 5), []],
    ["Mid-Term Results Published", "Mid-Term Exam results are now available in the Marks & Results section of your portal.", "STUDENTS", "NORMAL", addDays(today, 20), []],
    ["Class 10 Board Preparation Schedule", "Special revision classes for Class 10 will run every day from 3:30 PM to 4:30 PM. Attendance is compulsory.", "CLASSES", "IMPORTANT", addDays(today, 30), c10.map((c) => c.id)],
    ["Science Exhibition – Class 8-B", "Class 8-B students will present science models on Saturday. Submit project titles to your class teacher.", "SECTIONS", "NORMAL", addDays(today, 6), [classes[5].id]],
    ["School Holiday Notice", "The school will remain closed on Monday on account of a local festival. Classes resume on Tuesday.", "ALL", "URGENT", addDays(today, 3), []],
    ["Staff Attendance Regularisation", "All staff must complete attendance regularisation before month end.", "STAFF", "NORMAL", addDays(today, 12), []],
    ["Old Notice: Summer Camp Registration", "Summer camp registration has closed.", "ALL", "NORMAL", addDays(today, -10), []],
  ];
  for (let i = 0; i < ann.length; i++) {
    const [title, body, audience, priority, expiry, targets] = ann[i];
    await db.announcement.create({
      data: {
        schoolId: sid, title, body, audience, priority, authorId: admin.id, publishDate: D(addDays(today, -i - 1)), expiryDate: D(expiry as string),
        createdAt: new Date(Date.now() - i * 26 * 3600 * 1000),
        targets: { create: targets.map((classId) => ({ schoolId: sid, classId })) },
      },
    });
  }

  /* leave */
  await db.leaveRequest.createMany({
    data: [
      { schoolId: sid, staffId: teachers[0].id, type: "CASUAL", fromDate: D(addDays(today, -20)), toDate: D(addDays(today, -19)), days: 2, reason: "Family function", status: "APPROVED", reviewedById: admin.id, remark: "Approved" },
      { schoolId: sid, staffId: teachers[1].id, type: "SICK", fromDate: D(addDays(today, -8)), toDate: D(addDays(today, -7)), days: 2, reason: "Fever and cold", status: "APPROVED", reviewedById: admin.id },
      { schoolId: sid, staffId: teachers[2].id, type: "EARNED", fromDate: D(addDays(today, 5)), toDate: D(addDays(today, 7)), days: 3, reason: "Personal work out of station", status: "PENDING" },
      { schoolId: sid, staffId: teachers[3].id, type: "CASUAL", fromDate: D(addDays(today, 2)), toDate: D(addDays(today, 3)), days: 2, reason: "Medical appointment for parent", status: "PENDING" },
      { schoolId: sid, staffId: teachers[4].id, type: "SICK", fromDate: D(addDays(today, -15)), toDate: D(addDays(today, -15)), days: 1, reason: "Migraine", status: "REJECTED", reviewedById: admin.id, remark: "Exam duty that day" },
    ],
  });

  /* student remarks & PTM observations */
  await db.studentRemark.createMany({
    data: [
      {
        schoolId: sid,
        studentId: students[0].id,
        classId: students[0].classId,
        academicYearId: year.id,
        authorId: teachers[0].userId,
        category: "ACADEMIC",
        remark: "Consistently demonstrates strong problem-solving skills in mathematics. Very attentive and active in class discussions.",
        date: D(addDays(today, -5)),
      },
      {
        schoolId: sid,
        studentId: students[0].id,
        classId: students[0].classId,
        academicYearId: year.id,
        authorId: admin.id,
        category: "PTM",
        remark: "Discussed academic trajectory during PTM. Parents are pleased with overall development and math performance.",
        date: D(addDays(today, -2)),
      },
      {
        schoolId: sid,
        studentId: students[1].id,
        classId: students[1].classId,
        academicYearId: year.id,
        authorId: teachers[0].userId,
        category: "BEHAVIOUR",
        remark: "Helpful towards classmates during group exercises. Displays good team leadership and disciplined habits.",
        date: D(addDays(today, -10)),
      },
      {
        schoolId: sid,
        studentId: students[2].id,
        classId: students[2].classId,
        academicYearId: year.id,
        authorId: teachers[1].userId,
        category: "IMPROVEMENT",
        remark: "Needs to practice handwriting and ensure timely homework submission in science journal.",
        date: D(addDays(today, -4)),
      },
      {
        schoolId: sid,
        studentId: students[3].id,
        classId: students[3].classId,
        academicYearId: year.id,
        authorId: teachers[2].userId,
        category: "ACTIVITIES",
        remark: "Excellent coordination and enthusiasm during science exhibition preparation.",
        date: D(addDays(today, -7)),
      },
    ],
  });

  /* ================= School B: separate tenant (isolation tests) ================= */
  const b = await db.school.create({ data: { slug: "riverdale", name: "Riverdale Public School", principalName: "Mr. S. Anand", website: "https://riverdale.example" } });
  const by = await db.academicYear.create({ data: { schoolId: b.id, name: "2026-2027", startDate: D("2026-06-01"), endDate: D("2027-03-31"), isCurrent: true } });
  const bAdmin = await db.user.create({ data: { schoolId: b.id, email: "admin@riverdale.in", passwordHash: hash, name: "Riverdale Admin", role: "ADMIN" } });
  const bc = await db.classRoom.create({ data: { schoolId: b.id, academicYearId: by.id, grade: "Class 10", section: "A" } });
  const bsub = await db.subject.create({ data: { schoolId: b.id, name: "Mathematics", code: "MAT" } });
  const bStudents: string[] = [];
  for (const [i, nm] of ["Secret Riverdale Student", "Other Riverdale Student"].entries()) {
    const u = await db.user.create({
      data: {
        schoolId: b.id, email: `student${i + 1}@riverdale.in`, passwordHash: hash, name: nm, role: "STUDENT",
        student: { create: { schoolId: b.id, admissionNo: `RV00${i + 1}`, rollNo: i + 1, classId: bc.id, academicYearId: by.id, gender: "M", dob: D("2011-01-01"), admissionDate: D("2026-06-02"), guardianName: "Guardian", guardianPhone: "+91 9000000000" } },
      },
      include: { student: true },
    });
    bStudents.push(u.student!.id);
    await db.studentSubject.create({ data: { schoolId: b.id, studentId: u.student!.id, subjectId: bsub.id } });
    await db.studentAttendance.create({ data: { schoolId: b.id, studentId: u.student!.id, classId: bc.id, academicYearId: by.id, date: D(today), status: "PRESENT" } });
  }

  // Riverdale extras: every area that isolation tests need (teacher, timetable, transport, exam+marks, notice, leave)
  const bt = await db.user.create({ data: { schoolId: b.id, email: "teacher@riverdale.in", passwordHash: hash, name: "Riverdale Secret Teacher", role: "TEACHER", staff: { create: { schoolId: b.id, employeeId: "RVT001", joinDate: D("2020-06-01") } } }, include: { staff: true } });
  await db.allocation.create({ data: { schoolId: b.id, classId: bc.id, subjectId: bsub.id, teacherId: bt.staff!.id } });
  await db.timetableSlot.create({ data: { schoolId: b.id, classId: bc.id, day: 1, period: 1, startTime: "09:00", endTime: "09:45", subjectId: bsub.id, teacherId: bt.staff!.id, room: "RV-ROOM" } });
  const bd = await db.driver.create({ data: { schoolId: b.id, driverCode: "RVD1", name: "Riverdale Secret Driver", phone: "9000000001", licenseNo: "RV-LIC-0001" } });
  await db.bus.create({ data: { schoolId: b.id, busNumber: "RV-BUS-1", registrationNo: "RV 01 AA 0001", capacity: 30, routeName: "Riverdale Secret Route", departureTime: "07:00", arrivalTime: "08:00", driverId: bd.id } });
  await db.announcement.create({ data: { schoolId: b.id, title: "Riverdale Secret Notice", body: "Only for Riverdale.", audience: "ALL", publishDate: D(today), authorId: bAdmin.id } });
  const bx = await db.exam.create({ data: { schoolId: b.id, academicYearId: by.id, name: "Riverdale Secret Exam", startDate: D(addDays(today, -3)) } });
  await db.mark.create({ data: { schoolId: b.id, examId: bx.id, studentId: bStudents[0], subjectId: bsub.id, internal: 11, theory: 33 } });
  await db.leaveRequest.create({ data: { schoolId: b.id, staffId: bt.staff!.id, type: "CASUAL", fromDate: D(addDays(today, 3)), toDate: D(addDays(today, 3)), days: 1, reason: "Riverdale secret leave reason" } });
  await db.staffAttendance.create({ data: { schoolId: b.id, staffId: bt.staff!.id, date: D(today), status: "PRESENT" } });

  /* ================= School C: J S Public Pre Primary School ================= */
  const jsSchool = await db.school.create({
    data: {
      slug: "js-public-school",
      name: "J S Public Pre Primary School",
      address: "Gollahalli, Gauribidanur Main Road, Doddaballapura – 561203",
      phone: "7975135781, 9187678257",
      email: "jspublicschool.edu@gmail.com",
      website: "https://jspublicschool.edu.in",
      principalName: "Headmistress Smt. Lakshmi Devi",
      primaryColor: "#0284c7",
      secondaryColor: "#10b981",
    },
  });
  const jsId = jsSchool.id;

  const jsYear = await db.academicYear.create({
    data: { schoolId: jsId, name: "2026-2027", startDate: D("2026-06-01"), endDate: D("2027-03-31"), isCurrent: true },
  });

  const jsAdmin = await db.user.create({
    data: {
      schoolId: jsId,
      email: "admin@jspublicschool.edu",
      passwordHash: hash,
      name: "Principal Smt. Lakshmi Devi",
      role: "ADMIN",
      phone: "7975135781",
    },
  });

  const JS_SUBJECTS = [
    ["English & Phonics", "ENG"],
    ["Number Work & Math", "NUM"],
    ["Environmental Studies", "EVS"],
    ["Rhymes & Storytelling", "RHY"],
    ["Art, Craft & Play", "ART"],
    ["Gross Motor & Physical Activities", "PE"],
  ];
  const jsSubjects: Awaited<ReturnType<typeof db.subject.create>>[] = [];
  for (const [name, code] of JS_SUBJECTS) {
    jsSubjects.push(await db.subject.create({ data: { schoolId: jsId, name, code } }));
  }

  const JS_TEACHERS = [
    ["Sunitha Gowda", "F", "D.El.Ed, Montessori Trained", "Pre-Primary"],
    ["Bhavani K", "F", "B.A., NTT Certified", "Pre-Primary"],
    ["Shilpa R", "F", "B.Sc., Early Childhood Education", "Pre-Primary"],
    ["Anusuya M", "F", "M.A., B.Ed., Nursery Teacher", "Pre-Primary"],
    ["Geetha Venkatesh", "F", "D.Ed., Montessori Diploma", "Pre-Primary"],
    ["Mamatha N", "F", "B.Com., NTT Diploma", "Pre-Primary"],
  ];
  const jsTeachers: Awaited<ReturnType<typeof db.staff.create>>[] = [];
  for (let i = 0; i < JS_TEACHERS.length; i++) {
    const [name, gender, qual, dept] = JS_TEACHERS[i];
    const u = await db.user.create({
      data: {
        schoolId: jsId,
        email: `teacher${i + 1}@jspublicschool.edu`,
        passwordHash: hash,
        name,
        role: "TEACHER",
        phone: `+91 98450 ${String(20000 + i * 111).slice(0, 5)}`,
        staff: {
          create: {
            schoolId: jsId,
            employeeId: `JST${String(i + 1).padStart(3, "0")}`,
            designation: "Pre-Primary Teacher",
            department: dept,
            qualification: qual,
            gender,
            joinDate: D("2021-06-01"),
          },
        },
      },
      include: { staff: true },
    });
    jsTeachers.push(u.staff!);
  }

  // Pre-primary classes: Playgroup, Nursery, LKG, UKG, Montessori (Sections A and B)
  const PRE_PRIMARY_GRADES = ["Playgroup", "Nursery", "LKG", "UKG", "Montessori"];
  const jsClasses: Awaited<ReturnType<typeof db.classRoom.create>>[] = [];
  for (const grade of PRE_PRIMARY_GRADES) {
    for (const section of ["A", "B"]) {
      let teacher = section === "A" ? jsTeachers[4] : jsTeachers[5];
      if (grade === "Montessori" && section === "A") teacher = jsTeachers[0]; // Sunitha Gowda (Teacher A) -> Montessori-A
      if (grade === "Montessori" && section === "B") teacher = jsTeachers[1]; // Bhavani K (Teacher B) -> Montessori-B
      if (grade === "Nursery" && section === "A") teacher = jsTeachers[2];   // Shilpa R (Teacher C) -> Nursery-A
      if (grade === "Nursery" && section === "B") teacher = jsTeachers[3];   // Anusuya M (Teacher D) -> Nursery-B

      jsClasses.push(
        await db.classRoom.create({
          data: {
            schoolId: jsId,
            academicYearId: jsYear.id,
            grade,
            section,
            classTeacherId: teacher.id,
          },
        })
      );
    }
  }

  // Subject Allocations for J S Public School
  // Section A teachers: Teacher A (0), Teacher C (2), Teacher E (4)
  // Section B teachers: Teacher B (1), Teacher D (3), Teacher F (5)
  // Guarantees Teacher A has ZERO allocations in Montessori-B or any Section B class!
  const aTeachers = [jsTeachers[0], jsTeachers[2], jsTeachers[4]];
  const bTeachers = [jsTeachers[1], jsTeachers[3], jsTeachers[5]];

  const jsAllocMap = new Map<string, string>();
  for (let c = 0; c < jsClasses.length; c++) {
    const cl = jsClasses[c];
    const pool = cl.section === "A" ? aTeachers : bTeachers;
    for (let s = 0; s < jsSubjects.length; s++) {
      const teacher = pool[(s + Math.floor(c / 2)) % pool.length];
      jsAllocMap.set(`${cl.id}:${jsSubjects[s].id}`, teacher.id);
      await db.allocation.create({
        data: { schoolId: jsId, classId: cl.id, subjectId: jsSubjects[s].id, teacherId: teacher.id },
      });
    }
  }

  // Timetable slots for JS Public School (Pre-primary schedule, 5 periods a day)
  const jsBusy = new Set<string>();
  const jsSlots: { schoolId: string; classId: string; day: number; period: number; startTime: string; endTime: string; subjectId: string; teacherId: string; room: string }[] = [];
  const JS_PERIODS = [["09:00", "09:40"], ["09:40", "10:20"], ["10:40", "11:20"], ["11:20", "12:00"], ["12:30", "13:10"]];
  for (let day = 1; day <= 5; day++) {
    for (let p = 1; p <= JS_PERIODS.length; p++) {
      jsClasses.forEach((cl, idx) => {
        for (const sub of jsSubjects) {
          const t = jsAllocMap.get(`${cl.id}:${sub.id}`)!;
          if (jsBusy.has(`${t}:${day}:${p}`)) continue;
          jsBusy.add(`${t}:${day}:${p}`);
          jsSlots.push({
            schoolId: jsId,
            classId: cl.id,
            day,
            period: p,
            startTime: JS_PERIODS[p - 1][0],
            endTime: JS_PERIODS[p - 1][1],
            subjectId: sub.id,
            teacherId: t,
            room: `Room-${101 + idx}`,
          });
          break;
        }
      });
    }
  }
  await db.timetableSlot.createMany({ data: jsSlots });

  // Students for J S Public School
  const JS_KIDS = [
    ["Aaradhya Gowda", "F", "2022-04-12", "Ramesh Gowda", "9187678257", "Gollahalli, Doddaballapura"],
    ["Chiranth K", "M", "2022-06-18", "Kumar Swamy", "9845012345", "Gauribidanur Road, Doddaballapura"],
    ["Deepthi M", "F", "2021-11-25", "Manjunath N", "9845023456", "Main Road, Doddaballapura"],
    ["Harshit Gowda", "M", "2021-08-14", "Girish Gowda", "9845034567", "Gollahalli, Doddaballapura"],
    ["Kusuma B", "F", "2021-02-10", "Basavaraj", "9845045678", "Doddaballapura Town"],
    ["Likith Kumar", "M", "2020-09-05", "Suresh K", "9845056789", "Near Bus Stand, Doddaballapura"],
    ["Manya S", "F", "2020-05-19", "Shivakumar", "9845067890", "Gollahalli Post, Doddaballapura"],
    ["Naveen R", "M", "2020-03-22", "Rangaswamy", "9845078901", "Gauribidanur Cross, Doddaballapura"],
    ["Prarthana V", "F", "2019-12-08", "Venkatesh Babu", "9845089012", "Gollahalli, Doddaballapura"],
    ["Rithvik S", "M", "2019-07-30", "Shankarappa", "9845090123", "Main Road, Doddaballapura"],
    ["Saanvi Patel", "F", "2019-10-15", "Prakash Patel", "9845091234", "Doddaballapura Industrial Area"],
    ["Tanmay G", "M", "2021-01-20", "Govindaraju", "9845092345", "Gollahalli, Doddaballapura"],
  ];

  const jsStudents: { id: string; classId: string; name: string; email: string }[] = [];
  let jsKidNum = 1;
  for (let c = 0; c < jsClasses.length; c++) {
    const cl = jsClasses[c];
    for (let r = 1; r <= 4; r++) {
      const kid = JS_KIDS[(jsKidNum - 1) % JS_KIDS.length];
      const email = `student${jsKidNum}@jspublicschool.edu`;
      const u = await db.user.create({
        data: {
          schoolId: jsId,
          email,
          passwordHash: hash,
          name: kid[0],
          role: "STUDENT",
          phone: kid[4],
          student: {
            create: {
              schoolId: jsId,
              admissionNo: `JSP${2026}${String(jsKidNum).padStart(3, "0")}`,
              rollNo: r,
              classId: cl.id,
              academicYearId: jsYear.id,
              gender: kid[1],
              dob: D(kid[2]),
              admissionDate: D("2026-06-05"),
              guardianName: kid[3],
              guardianPhone: kid[4],
              address: kid[5],
              bloodGroup: "B+",
            },
          },
        },
        include: { student: true },
      });
      jsStudents.push({ id: u.student!.id, classId: cl.id, name: kid[0], email });
      jsKidNum++;
    }
  }

  // Student subjects
  await db.studentSubject.createMany({
    data: jsStudents.flatMap((s) => jsSubjects.map((sub) => ({ schoolId: jsId, studentId: s.id, subjectId: sub.id }))),
  });

  // Attendance for J S Public School (last 10 school days)
  const jsAttDays = days.slice(-10);
  const jsSa: { schoolId: string; studentId: string; classId: string; academicYearId: string; date: Date; status: AttendanceStatus; markedById: string }[] = [];
  for (const d of jsAttDays) {
    for (const st of jsStudents) {
      const r = rnd();
      jsSa.push({
        schoolId: jsId,
        studentId: st.id,
        classId: st.classId,
        academicYearId: jsYear.id,
        date: D(d),
        status: r < 0.94 ? "PRESENT" : r < 0.98 ? "LATE" : "ABSENT",
        markedById: jsAdmin.id,
      });
    }
  }
  await db.studentAttendance.createMany({ data: jsSa });

  // Assessments / Term Evaluation for J S Public School
  const jsExam = await db.exam.create({
    data: { schoolId: jsId, academicYearId: jsYear.id, name: "Term 1 Continuous Evaluation", startDate: D("2026-09-15") },
  });
  const jsMarks: { schoolId: string; examId: string; studentId: string; subjectId: string; internal: number; theory: number }[] = [];
  for (const st of jsStudents) {
    for (const sub of jsSubjects) {
      jsMarks.push({
        schoolId: jsId,
        examId: jsExam.id,
        studentId: st.id,
        subjectId: sub.id,
        internal: 18 + Math.floor(rnd() * 3),
        theory: 65 + Math.floor(rnd() * 15),
      });
    }
  }
  await db.mark.createMany({ data: jsMarks });

  // Student Remarks & PTM Observations for J S Public School
  const montAClass = jsClasses.find((c) => c.grade === "Montessori" && c.section === "A")!;
  const montAStudents = jsStudents.filter((s) => s.classId === montAClass.id);

  const jsRemarksData = [
    {
      studentId: montAStudents[0].id,
      classId: montAStudents[0].classId,
      category: "ACADEMIC" as const,
      remark: "Recognizes all letters and phonics sounds accurately. Highly enthusiastic in rhymes.",
      authorId: jsTeachers[0].userId,
    },
    {
      studentId: montAStudents[0].id,
      classId: montAStudents[0].classId,
      category: "PTM" as const,
      remark: "PTM Discussion: Parents are delighted with progress in speaking and socializing. Encouraged reading picture books at home.",
      authorId: jsAdmin.id,
    },
    {
      studentId: montAStudents[1].id,
      classId: montAStudents[1].classId,
      category: "ACTIVITIES" as const,
      remark: "Excellent fine motor coordination during block building and colouring activities.",
      authorId: jsTeachers[0].userId,
    },
    {
      studentId: montAStudents[2].id,
      classId: montAStudents[2].classId,
      category: "BEHAVIOUR" as const,
      remark: "Well mannered and shares toys cooperatively with classmates.",
      authorId: jsTeachers[0].userId,
    },
    {
      studentId: montAStudents[3].id,
      classId: montAStudents[3].classId,
      category: "IMPROVEMENT" as const,
      remark: "Shy during morning circle time. Working on building confidence to speak in group settings.",
      authorId: jsTeachers[0].userId,
    },
    {
      studentId: jsStudents[0].id,
      classId: jsStudents[0].classId,
      category: "PARTICIPATION" as const,
      remark: "Very active in pre-primary circle practical exercises. Shows great focus.",
      authorId: jsTeachers[4].userId,
    },
    {
      studentId: jsStudents[1].id,
      classId: jsStudents[1].classId,
      category: "STRENGTHS" as const,
      remark: "Quick grasping of number concepts up to 20. Natural problem solver.",
      authorId: jsTeachers[4].userId,
    },
  ];

  await db.studentRemark.createMany({
    data: jsRemarksData.map((r, i) => ({
      schoolId: jsId,
      studentId: r.studentId,
      classId: r.classId,
      academicYearId: jsYear.id,
      authorId: r.authorId,
      category: r.category,
      remark: r.remark,
      date: D(addDays(today, -i - 1)),
    })),
  });

  // Announcements for J S Public School
  await db.announcement.create({
    data: {
      schoolId: jsId,
      title: "Parent-Teacher Meeting (PTM) Schedule",
      body: "Our first Term Parent-Teacher Meeting will be held on Saturday from 9:30 AM to 12:30 PM. All parents are warmly invited to review student portfolios and observations.",
      audience: "ALL",
      priority: "IMPORTANT",
      authorId: jsAdmin.id,
      publishDate: D(today),
      expiryDate: D(addDays(today, 10)),
    },
  });
  await db.announcement.create({
    data: {
      schoolId: jsId,
      title: "Colour Day Celebration Notice",
      body: "Next Wednesday will be celebrated as Green Day! Children are requested to wear green attire and bring a green vegetable/fruit for show-and-tell.",
      audience: "ALL",
      priority: "NORMAL",
      authorId: jsAdmin.id,
      publishDate: D(today),
      expiryDate: D(addDays(today, 7)),
    },
  });

  // Leave request for J S Public School
  await db.leaveRequest.create({
    data: {
      schoolId: jsId,
      staffId: jsTeachers[0].id,
      type: "CASUAL",
      fromDate: D(addDays(today, 3)),
      toDate: D(addDays(today, 4)),
      days: 2,
      reason: "Family wedding in Gauribidanur",
      status: "PENDING",
    },
  });

  console.log(`Seeded Swan School: ${classes.length} classes, ${teachers.length} teachers, ${students.length} students, ${buses.length} buses, ${days.length} school days of attendance.`);
  console.log(`Seeded Riverdale Public School (second tenant).`);
  console.log(`Seeded J S Public Pre Primary School: ${jsClasses.length} pre-primary classes, ${jsTeachers.length} teachers, ${jsStudents.length} students, remarks & PTM observations.`);
  console.log(`Logins (password ${PASSWORD}): admin@swanschool.in | teacher1@swanschool.in (Anita Sharma) | student1@swanschool.in | rahul.kumar@swanschool.in | admin@riverdale.in | admin@jspublicschool.edu`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
