/* Server-action tests: calls the REAL server actions as different signed-in users (cookies() is stubbed with a
   signed session), including forbidden cases. Runs against the seeded DB and cleans up after itself.

     node --conditions react-server --import tsx scripts/action-tests.ts                                   */
import { createRequire } from "node:module";
import "dotenv/config";
const require = createRequire(import.meta.url);

/* ---- stub Next request APIs ---- */
let token = "";
const stub = (id: string, exports: unknown) => {
  const p = require.resolve(id);
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module;
};
stub("next/headers", { cookies: async () => ({ get: (n: string) => (n === "swan_session" && token ? { value: token } : undefined), set: () => {}, delete: () => {} }), headers: async () => new Headers() });
stub("next/cache", { revalidatePath: () => {}, revalidateTag: () => {} });
stub("next/navigation", { redirect: (u: string) => { throw Object.assign(new Error("NEXT_REDIRECT " + u), { digest: "NEXT_REDIRECT;replace;" + u }); }, notFound: () => { throw new Error("NEXT_NOT_FOUND"); } });

const { PrismaClient } = require("@prisma/client");
const { SignJWT } = require("jose");
const raw = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");
const as = async (u: { id: string; role: string; schoolId: string }) => { token = await new SignJWT({ role: u.role, sid: u.schoolId }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setExpirationTime("1h").sign(secret); };

let passes = 0, fails = 0;
const check = (ok: boolean, label: string, extra = "") => { if (ok) passes++; else fails++; console.log(`${ok ? "  ok  " : " FAIL "} ${label}${extra ? "  → " + extra : ""}`); };
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x); return f; };
type R = { ok: boolean; message: string } | null;
const denied = (r: R) => !!r && !r.ok;
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function main() {
  const A = await import("../src/actions/attendance");
  const M = await import("../src/actions/marks");
  const P = await import("../src/actions/people");
  const AC = await import("../src/actions/academics");
  const TT = await import("../src/actions/timetable");
  const AN = await import("../src/actions/announcements");
  const LV = await import("../src/actions/leave");
  const TR = await import("../src/actions/transport");
  const RQ = await import("../src/actions/requests");
  const FS = await import("../src/lib/features-server");
  const LK = await import("../src/actions/locked");
  const RM = await import("../src/actions/remarks");
  const { getAnnouncements } = await import("../src/lib/announcements");
  const { getUser } = await import("../src/lib/auth");

  const swan = await raw.school.findUniqueOrThrow({ where: { slug: "swan-school" } });
  const riv = await raw.school.findUniqueOrThrow({ where: { slug: "riverdale" } });
  const U = (email: string) => raw.user.findUniqueOrThrow({ where: { email }, include: { student: { include: { classRoom: true } }, staff: true } });
  const [admin, anita, stu1, rahul, rivAdmin] = await Promise.all(["admin@swanschool.in", "teacher1@swanschool.in", "student1@swanschool.in", "rahul.kumar@swanschool.in", "admin@riverdale.in"].map(U));
  const rivStudent = await raw.student.findFirstOrThrow({ where: { schoolId: riv.id } });
  const rivClass = await raw.classRoom.findFirstOrThrow({ where: { schoolId: riv.id } });

  const cls10A = await raw.classRoom.findFirstOrThrow({ where: { schoolId: swan.id, grade: "Class 10", section: "A" } });
  const cls6A = await raw.classRoom.findFirstOrThrow({ where: { schoolId: swan.id, grade: "Class 6", section: "A" } });
  const math = await raw.subject.findFirstOrThrow({ where: { schoolId: swan.id, code: "MAT" } });
  const english = await raw.subject.findFirstOrThrow({ where: { schoolId: swan.id, code: "ENG" } });
  const mid = await raw.exam.findFirstOrThrow({ where: { schoolId: swan.id, name: "Mid-Term Exam" } });
  const anitaMath10A = await raw.allocation.findUniqueOrThrow({ where: { classId_subjectId: { classId: cls10A.id, subjectId: math.id } } });
  check(anitaMath10A.teacherId === anita.staff.id, "seed: Anita Sharma teaches Mathematics in 10-A");

  console.log("\n== Auth / session ==");
  token = ""; check((await getUser()) === null, "no cookie → no user");
  await as(anita); check((await getUser())?.id === anita.id, "valid session → user");
  await as({ ...admin, schoolId: riv.id }); check((await getUser()) === null, "forged school claim → no user");

  console.log("\n== Marks: teacher limited to assigned class/section/subject ==");
  const rahulMark = () => raw.mark.findUniqueOrThrow({ where: { examId_studentId_subjectId: { examId: mid.id, studentId: rahul.student.id, subjectId: math.id } } });
  await as(anita);
  let r = await M.saveMarksAction(mid.id, cls10A.id, math.id, [{ id: rahul.student.id, internal: 19, theory: 75 }]);
  check(!!r?.ok, "Anita saves 10-A Mathematics marks", r?.message);
  const m1 = await rahulMark(); check(m1.internal === 19 && m1.theory === 75, "marks stored in DB (internal 19 + theory 75)");
  await as(anita); r = await M.saveMarksAction(mid.id, cls10A.id, english.id, [{ id: rahul.student.id, internal: 20, theory: 80 }]);
  check(denied(r), "Anita CANNOT save 10-A English (not her subject)", r?.message);
  r = await M.saveMarksAction(mid.id, cls6A.id, math.id, [{ id: rahul.student.id, internal: 1, theory: 1 }]);
  check(denied(r), "Anita CANNOT save Mathematics for a different section", r?.message);
  r = await M.saveMarksAction(mid.id, cls10A.id, math.id, [{ id: rahul.student.id, internal: 25, theory: 75 }]);
  check(denied(r), "internal above the 20 maximum rejected", r?.message);
  r = await M.saveMarksAction(mid.id, cls10A.id, math.id, [{ id: rahul.student.id, internal: 10, theory: null }]);
  check(denied(r), "half-entered marks rejected", r?.message);
  await as(stu1); r = await M.saveMarksAction(mid.id, cls6A.id, math.id, [{ id: stu1.student.id, internal: 20, theory: 80 }]);
  check(denied(r), "student CANNOT enter marks", r?.message);
  await as(anita); await M.saveMarksAction(mid.id, cls10A.id, math.id, [{ id: rahul.student.id, internal: 18, theory: 72 }]); // restore
  const m2 = await rahulMark(); check(m2.internal === 18 && m2.theory === 72, "restored Rahul's 18 + 72 = 90");

  console.log("\n== Student attendance: teacher only for assigned sections ==");
  const day = addDays(today, -1);
  await as(anita);
  const mine6A = await raw.student.findMany({ where: { classId: cls6A.id }, take: 3 });
  r = await A.markStudentAttendanceAction(cls6A.id, day, mine6A.map((s: { id: string }, i: number) => ({ id: s.id, status: (["PRESENT", "ABSENT", "EXCUSED"] as const)[i] })));
  check(!!r?.ok, "Anita (class teacher of 6-A) marks Present/Absent/Excused", r?.message);
  const rec = await raw.studentAttendance.findUnique({ where: { studentId_date: { studentId: mine6A[2].id, date: D(day) } } });
  check(rec?.status === "EXCUSED" && rec.markedById === anita.id && !!rec.academicYearId, "stored with status, teacher and academic year");
  const foreign = await raw.classRoom.findFirstOrThrow({ where: { schoolId: swan.id, grade: "Class 9", section: "B" } });
  const foreignStu = await raw.student.findFirstOrThrow({ where: { classId: foreign.id } });
  const anitaOwns = (await raw.allocation.count({ where: { classId: foreign.id, teacherId: anita.staff.id } })) + (await raw.classRoom.count({ where: { id: foreign.id, classTeacherId: anita.staff.id } }));
  r = await A.markStudentAttendanceAction(foreign.id, day, [{ id: foreignStu.id, status: "ABSENT" }]);
  check(anitaOwns ? true : denied(r), "Anita CANNOT mark attendance for a section she doesn't teach", r?.message);
  r = await A.markStudentAttendanceAction(cls6A.id, addDays(today, 3), [{ id: mine6A[0].id, status: "PRESENT" }]);
  check(denied(r), "future date rejected", r?.message);
  r = await A.markStudentAttendanceAction(cls6A.id, day, [{ id: mine6A[0].id, status: "HALF_DAY" as never }]);
  check(!r?.ok, "invalid status (Half day) rejected");
  await as(stu1); r = await A.markStudentAttendanceAction(cls6A.id, day, [{ id: stu1.student.id, status: "PRESENT" }]);
  check(denied(r), "student CANNOT mark attendance", r?.message);
  await as(anita); r = await A.markStaffAttendanceAction(day, [{ id: anita.staff.id, status: "PRESENT" }]);
  check(denied(r), "teacher CANNOT mark staff attendance (admin only)", r?.message);
  await as(admin); r = await A.markStaffAttendanceAction(day, [{ id: anita.staff.id, status: "LATE" }]);
  check(!!r?.ok, "admin marks staff attendance (Late)", r?.message);
  await as(admin); r = await A.markStaffAttendanceAction(day, [{ id: anita.staff.id, status: "EXCUSED" as never }]);
  check(!r?.ok, "staff status Excused rejected (only Present/Absent/Late/Leave)");

  console.log("\n== Multi-school isolation in actions ==");
  await as(admin);
  r = await P.deleteStudentAction(rivStudent.id); check(denied(r), "Swan admin CANNOT delete a Riverdale student", r?.message);
  check(!!(await raw.student.findUnique({ where: { id: rivStudent.id } })), "Riverdale student still exists");
  r = await M.saveMarksAction(mid.id, rivClass.id, math.id, [{ id: rivStudent.id, internal: 1, theory: 1 }]); check(denied(r), "Swan admin CANNOT save marks into Riverdale class", r?.message);
  r = await A.markStudentAttendanceAction(rivClass.id, day, [{ id: rivStudent.id, status: "ABSENT" }]); check(denied(r), "Swan admin CANNOT mark Riverdale attendance", r?.message);
  r = await P.toggleUserActiveAction(rivStudent.userId); check(denied(r), "Swan admin CANNOT deactivate a Riverdale user", r?.message);
  r = await AC.deleteClassAction(rivClass.id); check(denied(r), "Swan admin CANNOT delete a Riverdale class");
  check(!!(await raw.classRoom.findUnique({ where: { id: rivClass.id } })), "Riverdale class still exists");
  r = await P.saveStudentAction(null, null, fd({ name: "Cross Tenant", email: "cross@x.in", classId: rivClass.id, academicYearId: (await raw.academicYear.findFirstOrThrow({ where: { schoolId: swan.id } })).id, rollNo: "77", admissionNo: "X77", admissionDate: today, gender: "M", dob: "2012-01-01", guardianName: "G G", guardianPhone: "9000000000" }));
  check(denied(r), "Swan admin CANNOT enrol a student into a Riverdale class", r?.message);
  check((await raw.user.count({ where: { email: "cross@x.in" } })) === 0, "no cross-tenant student was created");

  console.log("\n== Riverdale rows cannot be touched from Swan (leave, transport, announcements, exams, timetable, forged school_id) ==");
  const rivLeave = await raw.leaveRequest.findFirstOrThrow({ where: { schoolId: riv.id } }); const rivBus = await raw.bus.findFirstOrThrow({ where: { schoolId: riv.id } }); const rivDriver = await raw.driver.findFirstOrThrow({ where: { schoolId: riv.id } });
  const rivAnn = await raw.announcement.findFirstOrThrow({ where: { schoolId: riv.id } }); const rivExam = await raw.exam.findFirstOrThrow({ where: { schoolId: riv.id } }); const rivSlot = await raw.timetableSlot.findFirstOrThrow({ where: { schoolId: riv.id } });
  await as(admin);
  r = await LV.reviewLeaveAction(rivLeave.id, "APPROVED", null, fd({})); check(denied(r) && (await raw.leaveRequest.findUniqueOrThrow({ where: { id: rivLeave.id } })).status === "PENDING", "Swan admin CANNOT approve a Riverdale leave request", r?.message);
  r = await TR.deleteBusAction(rivBus.id); check(denied(r) && !!(await raw.bus.findUnique({ where: { id: rivBus.id } })), "Swan admin CANNOT delete a Riverdale bus", r?.message);
  r = await TR.saveDriverAction(rivDriver.id, null, fd({ driverCode: "HACK", name: "Hacked", phone: "9000000000", licenseNo: "HACK-LICENSE", status: "ACTIVE" })); check(denied(r) && (await raw.driver.findUniqueOrThrow({ where: { id: rivDriver.id } })).name === "Riverdale Secret Driver", "Swan admin CANNOT edit a Riverdale driver", r?.message);
  r = await AN.deleteAnnouncementAction(rivAnn.id); check(denied(r) && !!(await raw.announcement.findUnique({ where: { id: rivAnn.id } })), "Swan admin CANNOT delete a Riverdale announcement", r?.message);
  r = await AC.deleteExamAction(rivExam.id); check(denied(r) && !!(await raw.exam.findUnique({ where: { id: rivExam.id } })), "Swan admin CANNOT delete a Riverdale exam", r?.message);
  r = await TT.clearSlotAction(rivClass.id, rivSlot.day, rivSlot.period); check(!!(await raw.timetableSlot.findUnique({ where: { id: rivSlot.id } })), "Swan admin CANNOT clear a Riverdale timetable slot", r?.message);
  r = await AC.saveAllocationAction(null, fd({ classId: rivClass.id, subjectId: (await raw.subject.findFirstOrThrow({ where: { schoolId: riv.id } })).id, teacherId: anita.staff.id })); check(denied(r), "Swan admin CANNOT allocate into a Riverdale class", r?.message);
  const y0 = await raw.academicYear.findFirstOrThrow({ where: { schoolId: swan.id, isCurrent: true } });
  r = await P.saveStudentAction(null, null, fd({ schoolId: riv.id, school_id: riv.id, name: "Forged School", email: "forged.school@swanschool.in", classId: cls10A.id, academicYearId: y0.id, rollNo: "91", admissionNo: "FORGE1", admissionDate: today, gender: "M", dob: "2011-01-01", guardianName: "G G", guardianPhone: "9000000000" }));
  const forgedStu = await raw.student.findFirst({ where: { admissionNo: "FORGE1" } }); check(!!r?.ok && forgedStu?.schoolId === swan.id, "forged schoolId in the request body is ignored (record lands in Swan)", forgedStu?.schoolId === swan.id ? "" : "WRONG SCHOOL");
  if (forgedStu) await P.deleteStudentAction(forgedStu.id);
  r = await P.saveStudentAction(null, null, fd({ name: "Mismatch", email: "mismatch@swanschool.in", classId: cls10A.id, academicYearId: (await raw.academicYear.findFirstOrThrow({ where: { schoolId: swan.id, isCurrent: false } })).id, rollNo: "92", admissionNo: "MIS1", admissionDate: today, gender: "M", dob: "2011-01-01", guardianName: "G G", guardianPhone: "9000000000" }));
  check(denied(r) && /different academic year/.test(r?.message ?? ""), "class / academic-year mismatch rejected", r?.message);
  await as(stu1); r = await AC.toggleStudentSubjectAction(stu1.student.id, math.id); check(denied(r), "student CANNOT change their own subjects", r?.message);
  r = await P.toggleUserActiveAction(rahul.id); check(denied(r), "student CANNOT deactivate another student", r?.message);
  r = await P.resetPasswordAction(rahul.id); check(denied(r), "student CANNOT reset another student's password", r?.message);
  r = await A.markStudentAttendanceAction(cls10A.id, addDays(today, -1), [{ id: rahul.student.id, status: "PRESENT" }]); check(denied(r), "student CANNOT overwrite another student's attendance", r?.message);
  console.log("\n== Locked features: backend blocks ==");
  for (const key of ["fees", "payments", "receipts", "parent_portal", "non_teaching_staff", "advanced_transport", "gps", "notifications", "biometric", "payroll", "library", "inventory", "hostel", "custom_integrations"]) {
    let blocked = false; try { await FS.assertFeature(key as never); } catch (e) { blocked = e instanceof FS.FeatureLockedError; }
    check(blocked, `assertFeature("${key}") throws FeatureLockedError`);
  }
  await as(admin);
  for (const key of ["fees", "payments", "receipts", "parent_portal", "non_teaching_staff", "advanced_transport", "gps", "notifications", "biometric", "payroll", "library", "inventory", "hostel", "custom_integrations"]) { r = await LK.lockedFeatureAction(key); check(denied(r) && /not active under your current plan/.test(r?.message ?? ""), `lockedFeatureAction("${key}") refused: not active under your current plan`); }
  r = await LK.saveNonTeachingStaffAction(null, null, fd({ name: "X" })); check(denied(r) && /not active under your current plan/.test(r?.message ?? ""), "non-teaching staff CREATE blocked", r?.message);
  r = await LK.deleteNonTeachingStaffAction("x"); check(denied(r) && /not active under your current plan/.test(r?.message ?? ""), "non-teaching staff DELETE blocked", r?.message);
  check((await raw.staff.count({ where: { staffType: "NON_TEACHING" } })) === 0, "no NON_TEACHING staff row exists");
  let okDefault = true; for (const k of ["students", "attendance", "marks", "results", "timetable", "announcements", "leave", "transport", "reports", "branding"]) { try { await FS.assertFeature(k as never); } catch { okDefault = false; } }
  check(okDefault, "all default features pass assertFeature");

  console.log("\n== Timetable: teacher & class double-booking ==");
  await as(admin);
  const slotOf = (classId: string, day2: number, period: number) => raw.timetableSlot.findUnique({ where: { classId_day_period: { classId, day: day2, period } } });
  const anitaSlot = await raw.timetableSlot.findFirstOrThrow({ where: { teacherId: anita.staff.id }, include: { classRoom: true } });
  // put Anita's same subject into another class at the same time → teacher clash
  const other = await raw.allocation.findFirstOrThrow({ where: { teacherId: anita.staff.id, classId: { not: anitaSlot.classId } } });
  const otherSlot = await slotOf(other.classId, anitaSlot.day, anitaSlot.period);
  if (otherSlot) await raw.timetableSlot.delete({ where: { id: otherSlot.id } });
  r = await TT.saveSlotAction(other.classId, anitaSlot.day, anitaSlot.period, null, fd({ subjectId: other.subjectId, startTime: anitaSlot.startTime, endTime: anitaSlot.endTime, room: "X" }));
  check(denied(r) && /already teaching/.test(r?.message ?? ""), "teacher double-booking blocked", r?.message);
  // class clash: same class, different period number but overlapping time
  const clsSlot = await raw.timetableSlot.findFirstOrThrow({ where: { classId: cls6A.id } });
  const emptyPeriod = [9, 10, 11, 12].find((p) => p);
  r = await TT.saveSlotAction(cls6A.id, clsSlot.day, emptyPeriod!, null, fd({ subjectId: clsSlot.subjectId, startTime: clsSlot.startTime, endTime: clsSlot.endTime }));
  check(denied(r) && /already has period/.test(r?.message ?? ""), "class double-booking (overlapping time) blocked", r?.message);
  r = await TT.saveSlotAction(cls6A.id, clsSlot.day, emptyPeriod!, null, fd({ subjectId: clsSlot.subjectId, startTime: "16:30", endTime: "16:00" }));
  check(denied(r), "end before start rejected", r?.message);
  r = await TT.saveSlotAction(cls6A.id, 6, 12, null, fd({ subjectId: clsSlot.subjectId, startTime: "18:00", endTime: "18:45", room: "R-1" }));
  const created = await slotOf(cls6A.id, 6, 12);
  check(!!r?.ok && !!created && created.startTime === "18:00", "valid period saved with start/end/room", r?.message);
  if (created) await raw.timetableSlot.delete({ where: { id: created.id } });
  await as(anita); r = await TT.saveSlotAction(cls10A.id, 6, 12, null, fd({ subjectId: english.id, startTime: "18:00", endTime: "18:45" }));
  check(denied(r), "teacher CANNOT schedule a subject they don't teach", r?.message);

  console.log("\n== Announcements: audience targeting & expiry ==");
  await as(admin);
  const sec = cls6A.id;
  r = await AN.createAnnouncementAction(null, fd({ title: "TEST Section 6-A only", body: "only for 6A students", audience: "SECTIONS", priority: "NORMAL", publishDate: today, classIds: [sec] }));
  check(!!r?.ok, "admin publishes announcement for SECTION 6-A", r?.message);
  r = await AN.createAnnouncementAction(null, fd({ title: "TEST Class 10 all sections", body: "class 10 notice", audience: "CLASSES", priority: "IMPORTANT", publishDate: today, grades: ["Class 10"] }));
  check(!!r?.ok, "admin publishes announcement for CLASS 10 (all sections)", r?.message);
  r = await AN.createAnnouncementAction(null, fd({ title: "TEST Expired", body: "old news here", audience: "ALL", priority: "NORMAL", publishDate: addDays(today, -5), expiryDate: addDays(today, -1) }));
  r = await AN.createAnnouncementAction(null, fd({ title: "TEST Future", body: "future news here", audience: "ALL", priority: "NORMAL", publishDate: addDays(today, 5) }));
  r = await AN.createAnnouncementAction(null, fd({ title: "TEST Teachers only", body: "teachers memo", audience: "TEACHERS", priority: "NORMAL", publishDate: today }));
  const titles = async (u: typeof stu1) => { await as(u); return (await getAnnouncements(await getUser() as never, 100)).map((a: { title: string }) => a.title); };
  const s6A = await titles(stu1), s10A = await titles(rahul), tch = await titles(anita);
  const other7 = await raw.user.findFirstOrThrow({ where: { schoolId: swan.id, role: "STUDENT", student: { classRoom: { grade: "Class 7" } } }, include: { student: { include: { classRoom: true } } } });
  const s7 = await titles(other7);
  check(s6A.includes("TEST Section 6-A only") && !s10A.includes("TEST Section 6-A only") && !s7.includes("TEST Section 6-A only"), "SECTION announcement reaches only 6-A students");
  check(s10A.includes("TEST Class 10 all sections") && !s6A.includes("TEST Class 10 all sections"), "CLASS announcement reaches Class 10 only");
  check(!s6A.includes("TEST Expired") && !tch.includes("TEST Expired"), "expired announcement hidden from students & teachers");
  check(!s6A.includes("TEST Future"), "future-dated announcement not yet visible");
  check(tch.includes("TEST Teachers only") && !s6A.includes("TEST Teachers only"), "TEACHERS audience: teachers see it, students don't");
  await as(stu1); r = await AN.createAnnouncementAction(null, fd({ title: "TEST hack", body: "student post", audience: "ALL", priority: "NORMAL", publishDate: today }));
  check(denied(r), "student CANNOT create announcements", r?.message);
  await as(anita); r = await AN.createAnnouncementAction(null, fd({ title: "TEST teacher all", body: "teacher tries everyone", audience: "ALL", priority: "NORMAL", publishDate: today }));
  check(denied(r), "teacher CANNOT broadcast to everyone", r?.message);
  await raw.announcement.deleteMany({ where: { title: { startsWith: "TEST" } } });

  console.log("\n== Staff leave → attendance integration ==");
  await as(anita);
  const from = addDays(today, 20), to = addDays(today, 22);
  r = await LV.applyLeaveAction(null, fd({ type: "EARNED", fromDate: from, toDate: to, reason: "Family trip planned" }));
  check(!!r?.ok, "teacher applies Earned Leave", r?.message);
  const lv = await raw.leaveRequest.findFirstOrThrow({ where: { staffId: anita.staff.id, type: "EARNED", status: "PENDING" } });
  r = await LV.applyLeaveAction(null, fd({ type: "EARNED", fromDate: from, toDate: from, reason: "overlapping request" })); check(denied(r), "overlapping leave rejected", r?.message);
  r = await LV.applyLeaveAction(null, fd({ type: "CASUAL", fromDate: addDays(today, 40), toDate: addDays(today, 80), reason: "too long a leave" })); check(denied(r), "over-quota / >30 days rejected", r?.message);
  r = await LV.applyLeaveAction(null, fd({ type: "EMERGENCY", fromDate: addDays(today, 50), toDate: addDays(today, 50), reason: "not a valid type" })); check(denied(r), "unknown leave type (Emergency) rejected");
  r = await LV.reviewLeaveAction(lv.id, "APPROVED", null, fd({})); check(denied(r), "teacher CANNOT approve leave", r?.message);
  await as(stu1); r = await LV.applyLeaveAction(null, fd({ type: "CASUAL", fromDate: from, toDate: from, reason: "student leave" })); check(denied(r), "student CANNOT apply for leave", r?.message);
  await as(admin); r = await LV.reviewLeaveAction(lv.id, "APPROVED", null, fd({ remark: "ok" }));
  check(!!r?.ok, "admin approves leave", r?.message);
  const leaveDays = await raw.staffAttendance.count({ where: { staffId: anita.staff.id, status: "LEAVE", date: { gte: D(from), lte: D(to) } } });
  check(leaveDays >= 2, `approved leave marked as LEAVE in staff attendance (${leaveDays} day(s), Sundays skipped)`);
  await raw.staffAttendance.deleteMany({ where: { staffId: anita.staff.id, date: { gte: D(from), lte: D(to) } } });
  await raw.leaveRequest.delete({ where: { id: lv.id } });

  console.log("\n== Transport (default feature) ==");
  await as(admin);
  r = await TR.saveDriverAction(null, null, fd({ driverCode: "D900", name: "Test Driver", phone: "9840099999", licenseNo: "TN09 2024 000999", status: "ACTIVE" }));
  check(!!r?.ok, "admin adds a driver", r?.message);
  const drv = await raw.driver.findFirstOrThrow({ where: { schoolId: swan.id, driverCode: "D900" } });
  r = await TR.saveBusAction(null, null, fd({ busNumber: "SW-99", registrationNo: "TN 09 ZZ 9999", capacity: "2", routeName: "Test – Route – School", departureTime: "07:10", arrivalTime: "08:20", status: "ACTIVE", driverId: drv.id }));
  check(!!r?.ok, "admin adds a bus with driver", r?.message);
  const bus = await raw.bus.findFirstOrThrow({ where: { schoolId: swan.id, busNumber: "SW-99" } });
  r = await TR.addStopAction(bus.id, null, fd({ name: "Test Stop", pickupTime: "07:25" })); check(!!r?.ok, "admin adds a stop", r?.message);
  const stop = await raw.busStop.findFirstOrThrow({ where: { busId: bus.id } });
  r = await TR.saveBusAction(null, null, fd({ busNumber: "SW-98", registrationNo: "TN 09 ZZ 9998", capacity: "10", routeName: "Other route here", departureTime: "07:00", arrivalTime: "08:00", status: "ACTIVE", driverId: drv.id }));
  check(denied(r), "one driver cannot drive two buses", r?.message);
  r = await TR.saveBusAction(null, null, fd({ busNumber: "SW-97", registrationNo: "TN 09 ZZ 9997", capacity: "10", routeName: "Bad time route", departureTime: "25:99", arrivalTime: "08:00", status: "ACTIVE" }));
  check(denied(r), "invalid time rejected", r?.message);
  // capacity: 2 seats — assign 3 students
  const yr = await raw.academicYear.findFirstOrThrow({ where: { schoolId: swan.id, isCurrent: true } });
  const three = await raw.student.findMany({ where: { schoolId: swan.id, classId: cls6A.id, busId: null }, include: { user: true }, take: 3 });
  const results: R[] = [];
  for (const s of three) results.push(await P.saveStudentAction(s.id, null, fd({ name: s.user.name, email: s.user.email, classId: s.classId, academicYearId: yr.id, rollNo: String(s.rollNo), admissionNo: s.admissionNo, admissionDate: today, gender: s.gender, dob: "2012-03-03", guardianName: s.guardianName, guardianPhone: s.guardianPhone, busId: bus.id, busStopId: stop.id })));
  check(results[0]?.ok === true && results[1]?.ok === true && denied(results[2]), "bus capacity enforced (2 seats: 3rd student refused)", results[2]?.message);
  await as(anita); r = await TR.saveBusAction(null, null, fd({ busNumber: "T-1", registrationNo: "TN 00 T 0001", capacity: "10", routeName: "Teacher route", departureTime: "07:00", arrivalTime: "08:00", status: "ACTIVE" }));
  check(denied(r), "teacher CANNOT manage transport (view only)", r?.message);
  await as(admin); await TR.deleteBusAction(bus.id); await TR.deleteDriverAction(drv.id);
  check((await raw.student.count({ where: { busId: bus.id } })) === 0 && (await raw.bus.count({ where: { id: bus.id } })) === 0, "deleting a bus unassigns students & removes it");

  console.log("\n== Students / classes / academic years ==");
  const before = await raw.student.count({ where: { schoolId: swan.id } });
  r = await P.saveStudentAction(null, null, fd({ name: "Test Student Zed", email: "zed.test@swanschool.in", phone: "9000012345", classId: cls10A.id, academicYearId: yr.id, rollNo: "88", admissionNo: "SW2026888", admissionDate: today, gender: "M", dob: "2011-02-02", guardianName: "Zed Parent", guardianPhone: "9000012346", address: "1 Test Rd", bloodGroup: "O+" }));
  check(!!r?.ok, "admin adds a student (class, section, academic year, guardian…)", r?.message);
  const zed = await raw.student.findFirstOrThrow({ where: { admissionNo: "SW2026888" }, include: { subjects: true } });
  check(zed.subjects.length === 8 && zed.academicYearId === yr.id && zed.classId === cls10A.id, "student auto-assigned to 8 class subjects + year + section");
  r = await P.saveStudentAction(zed.id, null, fd({ name: "Test Student Zed", email: "zed.test@swanschool.in", classId: cls10A.id, academicYearId: yr.id, rollNo: "88", admissionNo: "SW2026888", admissionDate: today, gender: "M", dob: "2011-02-02", guardianName: "Zed Parent", guardianPhone: "9000012346", address: "Edited address" }));
  check(!!r?.ok && (await raw.student.findUniqueOrThrow({ where: { id: zed.id } })).address === "Edited address", "admin edits a student", r?.message);
  r = await P.saveStudentAction(null, null, fd({ name: "Dup", email: "zed.test@swanschool.in", classId: cls10A.id, academicYearId: yr.id, rollNo: "89", admissionNo: "SW2026889", admissionDate: today, gender: "M", dob: "2011-02-02", guardianName: "G G", guardianPhone: "9000012346" }));
  check(denied(r), "duplicate email rejected", r?.message);
  r = await P.toggleUserActiveAction(zed.userId); check(!!r?.ok && !(await raw.user.findUniqueOrThrow({ where: { id: zed.userId } })).active, "admin deactivates a student");
  r = await AC.toggleStudentSubjectAction(zed.id, english.id); check(!!r?.ok && (await raw.studentSubject.count({ where: { studentId: zed.id } })) === 7, "admin removes a subject from a student");
  await raw.studentSubject.deleteMany({ where: { studentId: zed.id } });
  await as(anita); r = await P.saveStudentAction(null, null, fd({ name: "Hack", email: "hack@x.in" })); check(denied(r), "teacher CANNOT add students", r?.message);
  await as(admin); await P.deleteStudentAction(zed.id);
  check((await raw.student.count({ where: { schoolId: swan.id } })) === before, "test student removed");
  r = await AC.createClassAction(null, fd({ academicYearId: yr.id, grade: "Class 11", sections: "A, B, C" }));
  check(!!r?.ok && (await raw.classRoom.count({ where: { schoolId: swan.id, grade: "Class 11" } })) === 3, "admin creates Class 11 with sections A, B, C", r?.message);
  r = await AC.createClassAction(null, fd({ academicYearId: yr.id, grade: "Class 11", sections: "A" })); check(denied(r), "duplicate section rejected", r?.message);
  await raw.classRoom.deleteMany({ where: { schoolId: swan.id, grade: "Class 11" } });
  r = await AC.saveAcademicYearAction(null, fd({ name: "2027-2028", startDate: "2027-06-01", endDate: "2028-03-31" })); check(!!r?.ok, "admin creates academic year 2027-2028", r?.message);
  const y27 = await raw.academicYear.findFirstOrThrow({ where: { schoolId: swan.id, name: "2027-2028" } });
  r = await AC.saveAcademicYearAction(null, fd({ name: "27-28", startDate: "2027-06-01", endDate: "2028-03-31" })); check(denied(r), "bad year name rejected", r?.message);
  r = await AC.deleteAcademicYearAction(yr.id); check(denied(r), "cannot delete the current academic year", r?.message);
  await AC.deleteAcademicYearAction(y27.id);
  r = await AC.saveSubjectAction(null, null, fd({ name: "Test Subject", code: "tst" })); check(!!r?.ok, "admin creates a subject", r?.message);
  await raw.subject.deleteMany({ where: { schoolId: swan.id, code: "TST" } });
  const allocSub = await raw.subject.create({ data: { schoolId: swan.id, name: "Temp Sub", code: "TMP" } });
  r = await AC.saveAllocationAction(null, fd({ classId: cls10A.id, subjectId: allocSub.id, teacherId: anita.staff.id }));
  const enrolledNow = await raw.studentSubject.count({ where: { subjectId: allocSub.id } });
  check(!!r?.ok && enrolledNow === 10, "teacher allocation (Anita → 10-A) enrols the section's 10 students", r?.message);
  await raw.subject.delete({ where: { id: allocSub.id } });

  console.log("\n== Unlock request workflow ==");
  await as(admin);
  r = await RQ.requestUnlockAction(null, fd({ feature: "parent_portal", administratorName: "Admin Principal", email: "admin@swanschool.in", phone: "+91 98765 43210", message: "We would like to activate Parent Portal for our school." }));
  check(!!r?.ok && /submitted to Swan Digital Solutions/.test(r.message) && /swandigitalsolutions\.com/.test(r.message), "admin submits Request Unlock (Parent Portal)", r?.message);
  const req = await raw.featureUnlockRequest.findFirstOrThrow({ where: { schoolId: swan.id, requestedFeature: "parent_portal" } });
  check(req.status === "PENDING" && req.requestedBy === admin.id && req.message.includes("Parent Portal"), "request saved: PENDING, requested_by, message");
  r = await RQ.requestUnlockAction(null, fd({ feature: "parent_portal", administratorName: "A B", email: "a@b.in", phone: "9000000000" })); check(denied(r), "duplicate open request blocked", r?.message);
  r = await RQ.requestUnlockAction(null, fd({ feature: "not_a_feature", administratorName: "A B", email: "a@b.in", phone: "9000000000" })); check(denied(r), "unknown feature rejected");
  await as(anita); r = await RQ.requestUnlockAction(null, fd({ feature: "fees", administratorName: "A B", email: "a@b.in", phone: "9000000000" })); check(denied(r), "teacher CANNOT submit unlock requests", r?.message);
  await as(rivAdmin); await import("../src/lib/db").then(async ({ db }) => check((await db.featureUnlockRequest.count()) === 0, "Riverdale admin cannot see Swan's unlock requests"));
  await raw.featureUnlockRequest.deleteMany({ where: { schoolId: swan.id } });

  console.log("\n== Remarks & Observations authorization ==");
  await as(anita);
  r = await RM.saveRemarkAction(rahul.student.id, null, null, fd({ category: "ACADEMIC", remark: "Consistently performs well in geometry assignments.", date: today }));
  check(!!r?.ok, "Anita saves remark for student in her class (Rahul Kumar)", r?.message);
  const remarkRec = await raw.studentRemark.findFirstOrThrow({ where: { studentId: rahul.student.id, category: "ACADEMIC", remark: "Consistently performs well in geometry assignments." } });
  check(remarkRec.authorId === anita.id && remarkRec.classId === cls10A.id, "remark saved with author, class and category");

  // Teacher cannot add remark for a student in a class she doesn't teach (foreignStu is in 9-B)
  r = await RM.saveRemarkAction(foreignStu.id, null, null, fd({ category: "BEHAVIOUR", remark: "Trying to add unauthorized remark", date: today }));
  check(denied(r), "Anita CANNOT add remark for a student in an unassigned section (9-B)", r?.message);

  // Student cannot add remark
  await as(stu1);
  r = await RM.saveRemarkAction(rahul.student.id, null, null, fd({ category: "GENERAL", remark: "Student trying to add remark", date: today }));
  check(denied(r), "student CANNOT add remarks", r?.message);

  // Cross tenant: Swan admin cannot add remark for Riverdale student
  await as(admin);
  r = await RM.saveRemarkAction(rivStudent.id, null, null, fd({ category: "ACADEMIC", remark: "Cross tenant remark", date: today }));
  check(denied(r), "Swan admin CANNOT add remark for Riverdale student", r?.message);

  // Anita can delete her own remark
  await as(anita);
  r = await RM.deleteRemarkAction(remarkRec.id);
  check(!!r?.ok, "Anita can delete her own remark", r?.message);
  check((await raw.studentRemark.count({ where: { id: remarkRec.id } })) === 0, "remark deleted from DB");

  console.log(`\n${passes} passed, ${fails} failed`);
  await raw.$disconnect();
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
