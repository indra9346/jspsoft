/* End-to-end HTTP tests against a running server (npm run dev / start).
     npx tsx scripts/smoke.ts [baseUrl]
   Signs real session cookies for demo users and checks: page rendering per role, role guards,
   student-vs-student and school-vs-school isolation, forged tokens, locked add-ons (UI + API), CSV downloads,
   secret leakage. Exits non-zero on any failure. */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");
let fails = 0, passes = 0;

const check = (ok: boolean, label: string, extra = "") => {
  if (ok) passes++; else fails++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${extra ? "  → " + extra : ""}`);
};
const cookie = async (uid: string, sid: string, role: string) =>
  `swan_session=${await new SignJWT({ role, sid }).setProtectedHeader({ alg: "HS256" }).setSubject(uid).setExpirationTime("1h").sign(secret)}`;
const get = (path: string, ck?: string) => fetch(BASE + path, { headers: ck ? { cookie: ck } : {}, redirect: "manual" });

const LOCKED_PAGES: [string, string][] = [
  ["/fees", "Fee Management"], ["/payments", "Online Payment"], ["/receipts", "Fee Receipt Generation"], ["/parent", "Parent Portal"],
  ["/non-teaching", "Non-Teaching Staff Management"], ["/transport/advanced", "Advanced Transport & Live GPS"], ["/transport/gps", "Live GPS Tracking"],
  ["/notifications", "SMS / Email / WhatsApp Notifications"], ["/biometric", "Biometric/RFID Attendance Integration"], ["/payroll", "Payroll"],
  ["/library", "Library Management"], ["/inventory", "Inventory Management"], ["/hostel", "Hostel Management"], ["/custom", "School-Specific Custom Requirements"],
];
const LOCKED_KEYS = ["fees", "payments", "receipts", "parent_portal", "non_teaching_staff", "advanced_transport", "gps", "notifications", "biometric", "payroll", "library", "inventory", "hostel", "custom_integrations"];

async function main() {
  const swan = await db.school.findUniqueOrThrow({ where: { slug: "swan-school" } });
  const riv = await db.school.findUniqueOrThrow({ where: { slug: "riverdale" } });
  const user = (email: string) => db.user.findUniqueOrThrow({ where: { email }, include: { student: true, staff: true } });
  const [admin, teacher, stu, rahul, rivAdmin] = await Promise.all(["admin@swanschool.in", "teacher1@swanschool.in", "student1@swanschool.in", "rahul.kumar@swanschool.in", "admin@riverdale.in"].map(user));
  const A = await cookie(admin.id, swan.id, "ADMIN"), T = await cookie(teacher.id, swan.id, "TEACHER"), S = await cookie(stu.id, swan.id, "STUDENT"), RA = await cookie(rivAdmin.id, riv.id, "ADMIN");
  const rivStudent = await db.student.findFirstOrThrow({ where: { schoolId: riv.id }, include: { user: true } });

  console.log("\n== 1. Every page renders (200) for its role ==");
  const pages: Record<string, [string, string[]]> = {
    ADMIN: [A, ["/dashboard", "/students", "/students?q=rahul&status=active", `/students/${rahul.student!.id}`, "/staff", "/classes", "/subjects", "/allocations", "/attendance", "/attendance?view=monthly", "/attendance?view=history", "/attendance?view=overall", `/attendance?view=student&student=${rahul.student!.id}&class=${rahul.student!.classId}`, "/attendance?view=staff", "/marks", "/results", "/results?view=subject", `/results/report-card/${rahul.student!.id}`, "/timetable", "/timetable?view=teacher", "/announcements", "/leave", "/transport", "/reports", ...["students", "staff", "attendance", "marks", "results", "classes", "sections", "transport", "leave"].map((t) => `/reports?type=${t}`), "/branding", "/system", "/swan-digital", "/profile"]],
    TEACHER: [T, ["/dashboard", "/classes", "/attendance", "/attendance?view=monthly", "/attendance?view=overall", "/attendance?view=staff", "/marks", "/results", "/timetable", "/timetable?view=class", "/announcements", "/leave", "/transport", "/profile"]],
    STUDENT: [S, ["/dashboard", "/attendance", "/attendance?month=2026-08", "/results", `/results/report-card/${stu.student!.id}`, "/timetable", "/announcements", "/transport", "/profile", `/students/${stu.student!.id}`, "/fees", "/receipts"]],
  };
  for (const [role, [ck, list]] of Object.entries(pages))
    for (const p of list) {
      const r = await get(p, ck); const body = r.status === 200 ? await r.text() : "";
      check(r.status === 200 && !/Application error|Unhandled Runtime Error|Internal Server Error/i.test(body), `${role} ${p}`, String(r.status));
    }

  console.log("\n== 2. Role guards ==");
  for (const [ck, role, paths] of [[T, "TEACHER", ["/students", "/staff", "/branding", "/system", "/reports", "/subjects", "/allocations", "/swan-digital"]], [S, "STUDENT", ["/students", "/staff", "/marks", "/leave", "/branding", "/system", "/reports", "/classes", "/swan-digital", "/payroll", "/library"]]] as const)
    for (const p of paths) { const r = await get(p, ck); check(r.status === 307 && (r.headers.get("location") ?? "").includes("/dashboard"), `${role} blocked from ${p}`, `${r.status}`); }
  const anon = await get("/dashboard"); check(anon.status === 307 && (anon.headers.get("location") ?? "").includes("/login"), "anonymous → /login");

  console.log("\n== 3. Student A cannot reach Student B ==");
  const other = rahul.student!.id;
  check((await get(`/students/${other}`, S)).status === 404, "student1 → /students/<rahul>", "404");
  check((await get(`/students/${stu.student!.id}`, S)).status === 200, "student1 → own profile");
  check((await get(`/results/report-card/${other}`, S)).status === 404, "student1 → report card of rahul", "404");
  check((await get(`/reports/export?type=student_attendance&student=${other}`, S)).status === 403, "student1 → CSV attendance of rahul", "403");
  check((await get(`/reports/export?type=report_card&student=${other}`, S)).status === 403, "student1 → CSV report card of rahul", "403");
  check((await get(`/reports/export?type=students`, S)).status === 403, "student1 → school-wide student CSV", "403");
  check((await get(`/reports/export?type=student_attendance`, S)).status === 200, "student1 → own attendance CSV");
  const ownHtml = await (await get("/attendance?student=" + other, S)).text();
  check(!ownHtml.includes("Rahul Kumar"), "attendance page ignores ?student= for students (no Rahul data)");
  const resHtml = await (await get(`/results?student=${other}`, S)).text();
  check(!resHtml.includes("Rahul Kumar"), "results page ignores ?student= for students");

  console.log("\n== 4. Teacher sees only assigned sections/students ==");
  const mine = new Set([...(await db.classRoom.findMany({ where: { classTeacherId: teacher.staff!.id } })).map((c) => c.id), ...(await db.allocation.findMany({ where: { teacherId: teacher.staff!.id } })).map((a) => a.classId)]);
  const notMine = await db.student.findFirstOrThrow({ where: { classId: { notIn: [...mine] }, schoolId: swan.id }, include: { user: true } });
  const inMine = await db.student.findFirstOrThrow({ where: { classId: { in: [...mine] } } });
  check((await get(`/students/${notMine.id}`, T)).status === 404, "teacher1 → student outside assigned sections", "404");
  check((await get(`/students/${inMine.id}`, T)).status === 200, "teacher1 → student in assigned section");
  check((await get(`/results/report-card/${notMine.id}`, T)).status === 404, "teacher1 → report card outside assigned sections", "404");
  const foreignCls = await db.classRoom.findFirstOrThrow({ where: { id: { notIn: [...mine] }, schoolId: swan.id } });
  const tAtt = await (await get(`/attendance?class=${foreignCls.id}`, T)).text();
  check(!tAtt.includes(notMine.user.name), "teacher1 attendance ?class=<foreign> shows no foreign students");
  const tMarks = await (await get(`/marks?class=${foreignCls.id}`, T)).text();
  check(!tMarks.includes(notMine.user.name), "teacher1 marks ?class=<foreign> shows no foreign students");

  console.log("\n== 5. School A vs School B isolation ==");
  check((await get(`/students/${rivStudent.id}`, A)).status === 404, "Swan admin → Riverdale student profile", "404");
  check((await get(`/students/${rahul.student!.id}`, RA)).status === 404, "Riverdale admin → Swan student profile", "404");
  const rivList = await (await get("/students", RA)).text();
  check(rivList.includes("Secret Riverdale Student") && !rivList.includes("Rahul Kumar"), "Riverdale student list has only Riverdale students");
  const swanList = await (await get("/students", A)).text();
  check(!swanList.includes("Secret Riverdale Student"), "Swan student list has no Riverdale students");
  const rivCls = await db.classRoom.findFirstOrThrow({ where: { schoolId: riv.id } });
  const leak = await (await get(`/attendance?class=${rivCls.id}&view=daily`, A)).text();
  check(!leak.includes("Secret Riverdale Student"), "Swan admin /attendance?class=<riverdale class> leaks nothing");
  const leak2 = await (await get(`/students?class=${rivCls.id}`, A)).text();
  check(!leak2.includes("Secret Riverdale Student"), "Swan admin /students?class=<riverdale class> leaks nothing");
  const csv = await (await get("/reports/export?type=students", A)).text();
  check(!csv.includes("Secret Riverdale") && csv.includes("Rahul"), "Swan student CSV contains only Swan data");
  const forged = await cookie(admin.id, riv.id, "ADMIN"); // Swan admin id with Riverdale school claim
  const fr = await get("/dashboard", forged); check(fr.status === 307 && (fr.headers.get("location") ?? "").includes("/login"), "forged token (user of school A, claim school B) rejected");
  const bad = await get("/dashboard", "swan_session=not.a.jwt"); check(bad.status === 307, "garbage token rejected");
  const rivRes = await (await get("/marks", RA)).text(); check(!rivRes.includes("Mid-Term Exam"), "Riverdale admin does not see Swan exams");

  console.log("\n== 6. Locked add-ons: UI restriction + Request Unlock + backend block ==");
  for (const [path, title] of LOCKED_PAGES) {
    const html = await (await get(path, A)).text();
    check(html.includes("not active under your current plan") || html.includes("customized according to your school"), `${path} shows plan restriction`, title);
    check(html.includes("Request Unlock") || html.includes("Contact Swan Digital Solutions"), `${path} has Request Unlock / Contact button`);
    check(html.includes("/swan-digital?feature="), `${path} links to unlock request form`);
  }
  check((await (await get("/receipts", A)).text()).includes("PREVIEW"), "/receipts shows a clearly labelled PREVIEW template");
  check((await (await get("/receipts", A)).text()).includes("Authorized Signature"), "/receipts template has signature block");
  for (const k of LOCKED_KEYS) { const r = await get(`/api/features/${k}`, A); const j = await r.json().catch(() => ({})); check(r.status === 403 && j.error === "FEATURE_LOCKED", `API /api/features/${k} → 403 locked`); }
  for (const m of ["POST", "PUT", "DELETE"]) { const r = await fetch(`${BASE}/api/features/fees`, { method: m, headers: { cookie: A } }); check(r.status === 403, `API ${m} /api/features/fees → 403`); }
  const nav = await (await get("/dashboard", A)).text(); check(nav.includes("Add-on"), "sidebar marks add-ons with a lock badge");
  const tp = await (await get("/transport", S)).text(); check(!tp.includes("not active under your current plan"), "basic Transport is NOT locked for students");
  const ta = await (await get("/transport", A)).text(); check(ta.includes("SW-01") && !ta.includes("not active under your current plan"), "basic Transport works for admin (buses listed)");
  const stf = await (await get("/staff", A)).text(); check(stf.includes("Non-teaching staff"), "Staff page points to locked non-teaching add-on");

  console.log("\n== 7. Per-school unlock (school_features) ==");
  await db.schoolFeature.upsert({ where: { schoolId_featureKey: { schoolId: riv.id, featureKey: "fees" } }, update: { enabled: true }, create: { schoolId: riv.id, featureKey: "fees" } });
  check((await get("/api/features/fees", RA)).status === 501, "Riverdale (unlocked fees) → 501 not 403");
  check((await get("/api/features/fees", A)).status === 403, "Swan still locked for fees");
  check((await (await get("/fees", RA)).text()).includes("unlocked for your school"), "Riverdale /fees shows unlocked state");
  check((await (await get("/fees", A)).text()).includes("not active under your current plan"), "Swan /fees still locked");
  await db.schoolFeature.deleteMany({ where: { schoolId: riv.id } });

  console.log("\n== 8. Downloads & printable documents ==");
  for (const p of ["students", "staff", "attendance", "marks", "results", "classes", "sections", "transport", "leave"]) { const r = await get(`/reports/export?type=${p}`, A); check(r.status === 200 && (r.headers.get("content-type") ?? "").includes("csv"), `CSV ${p}`); }
  check((await get(`/reports/export?type=report_card&student=${rahul.student!.id}`, A)).status === 200, "CSV report card (admin)");
  const rc = await (await get(`/results/report-card/${rahul.student!.id}`, A)).text();
  check(rc.includes("Swan School") && rc.includes("REPORT CARD") && rc.includes("Rahul Kumar") && rc.includes("Authorized Signature") && rc.includes("Dr. Kavitha Raghavan"), "report card carries branding, student, signature block, principal");
  const math = await db.subject.findFirstOrThrow({ where: { schoolId: swan.id, code: "MAT" } });
  const mid = await db.exam.findFirstOrThrow({ where: { schoolId: swan.id, name: "Mid-Term Exam" } });
  const rm = await db.mark.findFirstOrThrow({ where: { studentId: rahul.student!.id, subjectId: math.id, examId: mid.id } });
  check(rm.internal === 18 && rm.theory === 72, "Rahul Kumar 10-A Maths: internal 18/20 + theory 72/80 = 90/100 stored");

  console.log("\n== 6b. Locked add-ons: every HTTP method, every feature (backend) + sub-pages ==");
  for (const k of LOCKED_KEYS) for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) { const r = await fetch(`${BASE}/api/features/${k}`, { method: m, headers: { cookie: A }, body: m === "GET" ? undefined : "{}" }); check(r.status === 403, `${m} /api/features/${k} → 403`, String(r.status)); }
  const anonApi = await fetch(`${BASE}/api/features/fees`, { redirect: "manual" }); check(anonApi.status !== 200 && anonApi.status !== 501, "anonymous → /api/features/fees is not served", String(anonApi.status));
  for (const [p2, needle] of [["/transport/driver-app", "Driver Mobile App"], ["/transport/tracking", "Real-Time Tracking"], ["/transport/parent-tracking", "Parent Live Tracking"], ["/notifications/sms", "SMS Notifications"], ["/notifications/email", "Email Notifications"], ["/notifications/whatsapp", "WhatsApp Notifications"]]) { const h = await (await get(p2, A)).text(); check(h.includes(needle) && h.includes("not active under your current plan") && h.includes("Request Unlock"), `${p2} locked sub-page`); }
  const parentHtml = await (await get("/parent", A)).text(); check(parentHtml.includes("Contact Swan Digital Solutions to activate Parent Portal.") && parentHtml.includes("This feature is available as an additional subscription."), "Parent Portal wording");
  const ntHtml = await (await get("/non-teaching", A)).text(); check(ntHtml.includes("Non-Teaching Staff Management is not active under your current plan.") && ntHtml.includes("Contact Swan Digital Solutions to unlock this feature."), "Non-teaching wording");
  const gpsHtml = await (await get("/transport/advanced", A)).text(); check(gpsHtml.includes("Advanced Transport &amp; Live GPS is not active under your current plan."), "Advanced transport wording");

  console.log("\n== 5b. School isolation across teachers, transport, announcements, leave, marks, reports ==");
  const MARK = ["Riverdale Secret", "RV-BUS-1", "Riverdale secret leave reason", "RVT001", "Riverdale Secret Route"];
  const T9 = ["students", "staff", "attendance", "marks", "results", "classes", "sections", "transport", "leave"];
  const swanAdminPages = ["/staff", "/transport", "/announcements", "/leave", "/marks", "/results", "/timetable?view=teacher", "/attendance?view=staff", "/attendance?view=overall", "/dashboard", "/allocations", "/subjects", "/classes", ...T9.map((t) => `/reports?type=${t}`), ...T9.map((t) => `/reports/export?type=${t}`), ...["students", "staff", "transport", "results", "leave"].map((t) => `/reports/export?type=${t}&format=pdf`)];
  let leaks = 0; for (const pth of swanAdminPages) { const r = await get(pth, A); const b = pth.includes("format=pdf") ? Buffer.from(await r.arrayBuffer()).toString("latin1") : await r.text(); if (MARK.some((m) => b.includes(m))) { leaks++; console.log("   leak in", pth); } }
  check(leaks === 0, `Swan admin: ${swanAdminPages.length} pages/exports contain no Riverdale data`);
  const SW = ["Anita Sharma", "SW-01", "Rahul Kumar", "Murugesan"]; let leaks2 = 0;
  for (const pth of ["/staff", "/transport", "/announcements", "/leave", "/marks", "/students", "/dashboard", "/reports?type=students", "/reports?type=staff", "/reports?type=transport", "/reports/export?type=staff", "/reports/export?type=transport", "/reports/export?type=students"]) { const b = await (await get(pth, RA)).text(); const found = SW.filter((m) => b.includes(m)); if (found.length) { leaks2++; console.log("   leak in", pth, found); } }
  check(leaks2 === 0, "Riverdale admin: staff/transport/announcements/leave/marks/students/reports contain no Swan data");
  const rivT = await user("teacher@riverdale.in"); const RT = await cookie(rivT.id, riv.id, "TEACHER"); const rt = await (await get("/timetable", RT)).text(); check(rt.includes("periods a week"), "Riverdale teacher sees own timetable"); check(!rt.includes("Anita Sharma") && !rt.includes("R-101"), "Riverdale teacher timetable has no Swan data");
  const rivBusPage = await (await get("/transport", RA)).text(); check(rivBusPage.includes("RV-BUS-1") && !rivBusPage.includes("SW-01"), "Riverdale transport shows only Riverdale buses");
  const swanLeaves = await (await get("/leave", A)).text(); check(!swanLeaves.includes("Riverdale"), "Swan leave page has no Riverdale requests");
  check((await get(`/results/report-card/${rivStudent.id}/pdf`, A)).status === 404, "cross-school report-card PDF by ID → 404");
  check((await get(`/results/report-card/${rahul.student!.id}/pdf`, RA)).status === 404, "Riverdale admin → Swan student's report-card PDF → 404");
  const forged2 = await cookie(teacher.id, riv.id, "TEACHER"); check((await get("/dashboard", forged2)).status === 307, "forged school claim on a teacher token rejected");
  const forged3 = await cookie(rivAdmin.id, swan.id, "ADMIN"); check((await get("/students", forged3)).status === 307, "Riverdale admin token re-labelled as Swan rejected");

  console.log("\n== 9. Secrets never reach the browser ==");
  { const staticDir = path.join(process.cwd(), ".next", "static"); let scanned = 0, hit = "";
    const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const fp = path.join(d, f.name); if (f.isDirectory()) walk(fp); else if (/\.(js|css|html|json|map)$/.test(f.name)) { scanned++; const c = fs.readFileSync(fp, "utf8"); if (/postgresql:\/\/|AKIA[0-9A-Z]{16}|BEGIN (RSA )?PRIVATE KEY/.test(c) || (process.env.AUTH_SECRET && c.includes(process.env.AUTH_SECRET))) hit = fp; } } };
    if (fs.existsSync(staticDir)) walk(staticDir); check(scanned > 0 && !hit, `client bundle (${scanned} files) contains no DATABASE_URL / AUTH_SECRET / AWS keys`, hit); }
  const pub = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_")); check(pub.every((k) => !/URL|SECRET|KEY|PASS|TOKEN/i.test(k) || k === "NEXT_PUBLIC_SWAN_WEBSITE"), `NEXT_PUBLIC_ variables are harmless (${pub.join(", ")})`);
  for (const p of ["/dashboard", "/system", "/branding", "/login"]) {
    const html = await (await get(p, A)).text();
    const leaked = /postgresql:\/\/|postgres:postgres/.test(html) || (!!process.env.AUTH_SECRET && html.includes(process.env.AUTH_SECRET));
    check(!leaked, `no DATABASE_URL value / AUTH_SECRET value in ${p} HTML`);
  }

  console.log(`\n${passes} passed, ${fails} failed`);
  await db.$disconnect();
  process.exit(fails ? 1 : 0);
}
main();
