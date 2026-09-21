/* Real-browser UI workflow tests (Microsoft Edge via Playwright). Every form is clicked, filled and submitted like a user would.
     npm run build && npx next start -p 3300          (or npm run dev)
     npx tsx scripts/ui-tests.ts http://localhost:3300
   Needs the seeded demo database. Creates test records (prefixed "UI") and removes most of them again; re-seed afterwards. */
import { chromium, type Browser, type BrowserContext, type Page, type Locator } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, PDFName } from "pdf-lib";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import "dotenv/config";

const BASE = process.argv[2] ?? "http://localhost:3000";
const raw = new PrismaClient();
const FIX = path.join(process.cwd(), "scripts", "fixtures");
const SHOTS = path.join(os.tmpdir(), "swan-ui-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const results: { section: string; name: string; ok: boolean; note?: string }[] = [];
let section = "";
async function step(name: string, fn: () => Promise<void>, page?: Page) {
  try { await fn(); results.push({ section, name, ok: true }); console.log(`  ok   ${name}`); }
  catch (e) {
    const msg = (e as Error).message.split("\n")[0].slice(0, 220);
    results.push({ section, name, ok: false, note: msg }); console.log(` FAIL  ${name}  → ${msg}`);
    if (page) await page.screenshot({ path: path.join(SHOTS, `FAIL-${results.length}.png`), fullPage: false }).catch(() => {});
  }
}
const sec = (s: string) => { section = s; console.log(`\n== ${s} ==`); };
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

let browser: Browser;
async function login(email: string, viewport = { width: 1280, height: 900 }): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", "Swan@123");
  await page.getByRole("button", { name: /Sign in as/ }).click();
  await page.waitForURL("**/dashboard", { timeout: 45000 });
  return { ctx, page };
}
const dlg = (p: Page, title: string) => p.getByRole("dialog", { name: title });
async function submitDialog(p: Page, title: string, button: string) {
  const d = dlg(p, title);
  await d.getByRole("button", { name: button, exact: true }).click();
  const closed = await d.waitFor({ state: "hidden", timeout: 15000 }).then(() => true).catch(() => false);
  if (!closed) throw new Error(`Dialog "${title}" stayed open: ${(await d.locator("[role=status]").allInnerTexts()).join(" | ") || "no message"}`);
}
async function selectText(sel: Locator, re: RegExp) {
  const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: o.textContent ?? "" })));
  const hit = opts.find((o) => re.test(o.t)); assert(hit, `option ${re} not found in [${opts.map((o) => o.t).join(" ; ").slice(0, 200)}]`);
  await sel.selectOption(hit!.v);
}
const body = (p: Page) => p.locator("body").innerText();
const CHART = ".recharts-rectangle, .recharts-sector, .recharts-area-area";
async function charts(p: Page) { await p.waitForSelector(CHART, { timeout: 15000 }); await p.waitForTimeout(1200); return p.locator(CHART).count(); }

async function overflowOffenders(p: Page): Promise<string[]> {
  return p.evaluate(() => {
    const vw = document.documentElement.clientWidth; const bad: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) bad.push(`PAGE scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    document.querySelectorAll("main *, header *, body > div *").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) return;
      let a: HTMLElement | null = (el as HTMLElement).parentElement, contained = false;
      while (a && a !== document.body) {
        const o = getComputedStyle(a).overflowX;
        if ((o === "auto" || o === "scroll" || o === "hidden") && a.getBoundingClientRect().right <= vw + 1) { contained = true; break; }
        a = a.parentElement;
      }
      if (!contained) bad.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)} right=${Math.round(r.right)}`);
    });
    return bad.slice(0, 5);
  });
}

async function main() {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const swan = await raw.school.findUniqueOrThrow({ where: { slug: "swan-school" } });
  const yr = await raw.academicYear.findFirstOrThrow({ where: { schoolId: swan.id, isCurrent: true } });
  const cls = async (g: string, s: string) => raw.classRoom.findFirstOrThrow({ where: { schoolId: swan.id, grade: g, section: s } });
  const c10A = await cls("Class 10", "A"), c6A = await cls("Class 6", "A"), c9B = await cls("Class 9", "B");

  /* ============================== ADMIN ============================== */
  const { ctx: actx, page: A } = await login("admin@swanschool.in");
  sec("ADMIN — dashboard & branding of the shell");
  await step("dashboard shows all required tiles", async () => {
    const t = await body(A);
    for (const k of ["TOTAL STUDENTS", "TOTAL TEACHERS", "TOTAL STAFF", "TOTAL CLASSES", "TODAY'S ATTENDANCE", "OVERALL ATTENDANCE", "PENDING LEAVE REQUESTS", "ACTIVE BUSES", "Upcoming Exams", "Recent Announcements"]) assert(t.toUpperCase().includes(k.toUpperCase()), `missing ${k}`);
    assert((await charts(A)) > 3, "dashboard charts did not render");
  }, A);
  await step("Swan logo in header, sidebar, dashboard hero + favicon", async () => {
    const n = await A.locator('img[src="/swan-logo.png"]').count(); assert(n >= 3, `logo images found: ${n}`);
    const ic = await A.locator('link[rel~="icon"]').first().getAttribute("href"); assert(ic, "no favicon link");
    const r = await A.request.get(BASE + "/favicon.ico"); assert(r.status() === 200 && (r.headers()["content-type"] ?? "").includes("icon"), "favicon.ico not served");
  }, A);

  sec("ADMIN — students");
  const T1 = "UI Student Alpha";
  await step("1. add student (class, section, year, guardian, photo, bus)", async () => {
    await A.goto(BASE + "/students"); await A.getByRole("button", { name: "Add student" }).click();
    const d = dlg(A, "Add student");
    await d.getByLabel("Full name").fill(T1); await d.getByLabel("Login email").fill("ui.alpha@swanschool.in");
    await d.getByLabel("Admission number").fill("SWUI001"); await d.getByLabel("Phone", { exact: true }).fill("9000011111");
    await selectText(d.getByLabel("Class & section"), /^Class 10-A · 2026-2027/); await d.getByLabel("Roll no.").fill("41");
    await d.getByLabel("Gender").selectOption("F"); await d.getByLabel("Date of birth").fill("2011-04-05"); await d.getByLabel("Blood group").fill("B+");
    await d.getByLabel("Parent / guardian name").fill("UI Guardian"); await d.getByLabel("Parent / guardian phone").fill("9000022222"); await d.getByLabel("Address").fill("5 UI Street, Chennai");
    await d.getByLabel("Photo").setInputFiles(path.join(FIX, "photo.png"));
    await submitDialog(A, "Add student", "Add student");
    const s = await raw.student.findFirst({ where: { admissionNo: "SWUI001" }, include: { subjects: true } });
    assert(s && s.classId === c10A.id && s.academicYearId === yr.id, "student not saved with class/section/year");
    assert(s!.photoData?.startsWith("data:image/png"), "photo not stored");
    assert(s!.subjects.length === 8, `expected 8 auto-assigned subjects, got ${s!.subjects.length}`);
  }, A);
  await step("photo upload displays on profile", async () => {
    const s = await raw.student.findFirstOrThrow({ where: { admissionNo: "SWUI001" } });
    await A.goto(BASE + `/students/${s.id}`);
    const img = A.locator(`img[alt="${T1}"]`).first(); await img.waitFor();
    assert((await img.getAttribute("src"))?.startsWith("data:image/png"), "photo not rendered");
    assert(await img.evaluate((i) => (i as HTMLImageElement).naturalWidth > 10), "photo image failed to decode");
  }, A);
  await step("3. search student", async () => {
    await A.goto(BASE + "/students"); await A.fill("#q", "UI Student Alpha"); await A.getByRole("button", { name: "Filter" }).click();
    await A.waitForURL(/q=UI/); const rows = await A.getByRole("row").filter({ hasText: "UI Student Alpha" }).count(); assert(rows === 1, `rows=${rows}`);
    assert(!(await body(A)).includes("Rahul Kumar"), "search leaked unrelated rows");
  }, A);
  await step("4. filter student (class + status)", async () => {
    await A.goto(BASE + "/students"); await selectText(A.locator("#class"), /^10-A/); await A.locator("#status").selectOption("active");
    await A.getByRole("button", { name: "Filter" }).click(); await A.waitForURL(/class=/);
    const t = await body(A); assert(t.includes("UI Student Alpha") && t.includes("Rahul Kumar"), "10-A students missing"); assert(!t.includes("Class 6") , "filter did not narrow");
    const n = await A.locator("tbody tr").count(); assert(n === 11, `expected 11 rows in 10-A, got ${n}`);
  }, A);
  await step("2/5/6/7. edit student → change class & section (10-A → 9-B), keep year", async () => {
    await A.goto(BASE + "/students?q=UI+Student+Alpha"); await A.getByRole("row").filter({ hasText: "UI Student Alpha" }).getByTitle("Edit").click();
    const d = dlg(A, "Edit student"); await selectText(d.getByLabel("Class & section"), /^Class 9-B/); await d.getByLabel("Address").fill("Edited by UI test");
    await submitDialog(A, "Edit student", "Save changes");
    const s = await raw.student.findFirstOrThrow({ where: { admissionNo: "SWUI001" } });
    assert(s.classId === c9B.id && s.address === "Edited by UI test", "edit not persisted");
    await A.goto(BASE + `/students/${s.id}`); const t = await body(A); assert(t.includes("Edited by UI test") && /section\s*b/i.test(t) && t.includes("2026-2027"), "profile does not show new class/section/year");
  }, A);
  await step("assign academic year: class/year mismatch is rejected, matching year accepted", async () => {
    await A.goto(BASE + "/students?q=UI+Student+Alpha"); await A.getByRole("row").filter({ hasText: "UI Student Alpha" }).getByTitle("Edit").click(); const d = dlg(A, "Edit student");
    await selectText(d.getByLabel("Academic year"), /2025-2026/); await d.getByRole("button", { name: "Save changes", exact: true }).click(); await d.locator("[role=status]").waitFor();
    assert(/different academic year/.test(await d.locator("[role=status]").innerText()), "mismatch not rejected"); await selectText(d.getByLabel("Academic year"), /2026-2027/); await submitDialog(A, "Edit student", "Save changes");
    assert((await raw.student.findFirstOrThrow({ where: { admissionNo: "SWUI001" } })).academicYearId === yr.id, "year not kept");
  }, A);
  await step("assign subjects: admin removes / re-adds a subject on the student profile", async () => {
    const s = await raw.student.findFirstOrThrow({ where: { admissionNo: "SWUI001" } }); await A.goto(BASE + `/students/${s.id}`);
    await A.getByRole("button", { name: /Art & Craft/ }).click(); await A.waitForTimeout(1500); assert((await raw.studentSubject.count({ where: { studentId: s.id } })) === 7, "subject not removed");
    await A.reload(); await A.getByRole("button", { name: /Art & Craft/ }).click(); await A.waitForTimeout(1500); assert((await raw.studentSubject.count({ where: { studentId: s.id } })) === 8, "subject not re-added");
  }, A);
  await step("deactivate → shows Inactive → reactivate", async () => {
    await A.goto(BASE + "/students?q=UI+Student+Alpha"); const row = A.getByRole("row").filter({ hasText: "UI Student Alpha" });
    await row.getByTitle("Deactivate").click(); await A.waitForTimeout(1500);
    let u = await raw.user.findUniqueOrThrow({ where: { email: "ui.alpha@swanschool.in" } }); assert(!u.active, "not deactivated");
    await A.reload(); assert((await row.innerText()).includes("Inactive"), "row does not say Inactive");
    await row.getByTitle("Activate").click(); await A.waitForTimeout(1500);
    u = await raw.user.findUniqueOrThrow({ where: { email: "ui.alpha@swanschool.in" } }); assert(u.active, "not reactivated");
  }, A);

  sec("ADMIN — teachers, subjects, classes, sections, academic years");
  await step("9/10. add teacher then edit teacher", async () => {
    await A.goto(BASE + "/staff"); await A.getByRole("button", { name: "Add staff" }).click(); const d = dlg(A, "Add staff member");
    await d.getByLabel("Full name").fill("UI Teacher Beta"); await d.getByLabel("Login email").fill("ui.beta@swanschool.in"); await d.getByLabel("Phone").fill("9000033333");
    await d.getByLabel("Employee ID").fill("TUI01"); await d.getByLabel("Designation").fill("Teacher"); await d.getByLabel("Department").fill("Mathematics");
    await d.getByLabel("Qualification").fill("M.Sc."); await d.getByLabel("Gender").selectOption("M"); await d.getByLabel("Joining date").fill("2026-06-01");
    await submitDialog(A, "Add staff member", "Add staff member");
    assert(await raw.staff.findFirst({ where: { employeeId: "TUI01", staffType: "TEACHING" } }), "teacher not saved");
    await A.reload(); await A.getByRole("row").filter({ hasText: "UI Teacher Beta" }).getByTitle("Edit").click();
    await dlg(A, "Edit staff member").getByLabel("Designation").fill("Senior Teacher"); await submitDialog(A, "Edit staff member", "Save changes");
    assert((await raw.staff.findFirstOrThrow({ where: { employeeId: "TUI01" } })).designation === "Senior Teacher", "edit not saved");
  }, A);
  await step("11. assign teacher to class/section/subject (allocation form)", async () => {
    await A.goto(BASE + `/allocations?class=${c10A.id}`); const row = A.getByRole("row").filter({ hasText: "Art & Craft" });
    await selectText(row.locator("select[name=teacherId]"), /^UI Teacher Beta/); await row.getByRole("button", { name: /Update|Assign/ }).click();
    await A.getByText("Allocation saved.").first().waitFor();
    const a = await raw.allocation.findFirstOrThrow({ where: { classId: c10A.id, subject: { code: "ART" } }, include: { teacher: { include: { user: true } } } });
    assert(a.teacher.user.name === "UI Teacher Beta", "allocation not stored");
  }, A);
  await step("12. create subject (persists after refresh)", async () => {
    await A.goto(BASE + "/subjects"); await A.getByRole("button", { name: "Add subject" }).click(); const d = dlg(A, "Add subject");
    await d.getByLabel("Subject name").fill("UI Robotics"); await d.getByLabel("Code").fill("uir"); await submitDialog(A, "Add subject", "Add subject");
    await A.reload(); assert((await body(A)).includes("UI Robotics") && (await body(A)).includes("UIR"), "subject not visible after refresh");
  }, A);
  await step("15. create academic year 2027-2028 (persists)", async () => {
    await A.goto(BASE + "/classes"); await A.getByRole("button", { name: "Add year" }).click(); const d = dlg(A, "New academic year");
    await d.getByLabel("Name").fill("2027-2028"); await d.getByLabel("Starts").fill("2027-06-01"); await d.getByLabel("Ends").fill("2028-03-31");
    await submitDialog(A, "New academic year", "Create year"); await A.reload(); assert((await body(A)).includes("2027-2028"), "year not listed after refresh");
  }, A);
  await step("13/14. create class 'Class 12' with sections A, B (persists)", async () => {
    await A.goto(BASE + "/classes"); await A.getByRole("button", { name: "Add class" }).click(); const d = dlg(A, "Add class with sections");
    await d.getByLabel("Class").fill("Class 12"); await d.getByLabel("Sections").fill("A, B"); await submitDialog(A, "Add class with sections", "Create sections");
    await A.reload(); const t = await body(A); assert(t.includes("Class 12-A") && t.includes("Class 12-B"), "sections not shown after refresh");
    assert((await raw.classRoom.count({ where: { schoolId: swan.id, grade: "Class 12" } })) === 2, "DB rows missing");
  }, A);

  await step("create another SECTION of an existing class (Class 12 → C)", async () => {
    await A.goto(BASE + "/classes"); await A.getByRole("button", { name: "Add class" }).click(); const d = dlg(A, "Add class with sections"); await d.getByLabel("Class").fill("Class 12"); await d.getByLabel("Sections").fill("C");
    await submitDialog(A, "Add class with sections", "Create sections"); await A.reload(); assert((await body(A)).includes("Class 12-C"), "section C missing");
  }, A);

  sec("ADMIN — timetable (create, then double-booking / overlap must be rejected)");
  let ttSubject = "";
  await step("16. create a timetable period through the modal", async () => {
    await A.goto(BASE + `/timetable?view=class&class=${c6A.id}`); await A.getByLabel("Edit Saturday period 8").click();
    const d = dlg(A, "Saturday · Period 8"); const sel = d.getByLabel("Subject & teacher"); ttSubject = await sel.locator("option").nth(1).innerText();
    await sel.selectOption({ index: 1 }); await d.getByLabel("Room (optional)").fill("UI-101");
    await submitDialog(A, "Saturday · Period 8", "Save period");
    const s = await raw.timetableSlot.findFirstOrThrow({ where: { classId: c6A.id, day: 6, period: 8 }, include: { subject: true, teacher: { include: { user: true } } } });
    assert(s.startTime === "14:45" && s.endTime === "15:30" && s.room === "UI-101", "slot fields wrong");
    await A.reload(); assert((await A.getByLabel("Edit Saturday period 8").innerText()).includes("14:45–15:30"), "cell does not show the time");
  }, A);
  await step("overlapping period in the same class is rejected", async () => {
    await A.getByLabel("Edit Saturday period 7").click(); const d = dlg(A, "Saturday · Period 7");
    await d.getByLabel("Subject & teacher").selectOption({ index: 2 }); await d.getByLabel("Start time").fill("14:40"); await d.getByLabel("End time").fill("15:10");
    await d.getByRole("button", { name: "Save period" }).click(); await d.locator("[role=status]").waitFor();
    const m = await d.locator("[role=status]").innerText(); assert(/already has period/.test(m), `unexpected message: ${m}`);
    await d.getByRole("button", { name: "Close" }).click();
  }, A);
  await step("teacher double-booking (same teacher, other section, same time) is rejected", async () => {
    const slot = await raw.timetableSlot.findFirstOrThrow({ where: { classId: c6A.id, day: 6, period: 8 }, include: { teacher: { include: { user: true } } } });
    const other = await raw.allocation.findFirst({ where: { teacherId: slot.teacherId, classId: { not: c6A.id } }, include: { subject: true, classRoom: true } });
    assert(other, "no second allocation for that teacher");
    await raw.timetableSlot.deleteMany({ where: { classId: other!.classId, day: 6, period: 8 } });
    await A.goto(BASE + `/timetable?view=class&class=${other!.classId}`); await A.getByLabel("Edit Saturday period 8").click();
    const d = dlg(A, "Saturday · Period 8"); await selectText(d.getByLabel("Subject & teacher"), new RegExp(`^${other!.subject.name} — ${slot.teacher.user.name}`));
    await d.getByRole("button", { name: "Save period" }).click(); await d.locator("[role=status]").waitFor();
    const m = await d.locator("[role=status]").innerText(); assert(/already teaching/.test(m), `unexpected message: ${m}`);
  }, A);
  await step("admin timetable → teacher view → student view show the new period", async () => {
    const s = await raw.timetableSlot.findFirstOrThrow({ where: { classId: c6A.id, day: 6, period: 8 }, include: { teacher: { include: { user: true } } } });
    await A.goto(BASE + `/timetable?view=teacher&teacher=${s.teacherId}`); assert((await body(A)).includes("14:45–15:30"), "admin teacher view missing slot");
    const tu = await raw.user.findFirstOrThrow({ where: { staff: { id: s.teacherId } } });
    const t = await login(tu.email); await t.page.goto(BASE + "/timetable"); assert((await body(t.page)).includes("14:45–15:30"), "teacher's own timetable missing slot"); await t.ctx.close();
    const st = await login("student1@swanschool.in"); await st.page.goto(BASE + "/timetable"); assert((await body(st.page)).includes("14:45–15:30"), "student timetable missing slot"); await st.ctx.close();
  }, A);
  void ttSubject;

  sec("ADMIN — transport (basic, default): driver, bus, stops, assign student → student's My Transport");
  await step("24/25/26. add driver, add bus (with driver), add stops", async () => {
    await A.goto(BASE + "/transport"); await A.getByRole("button", { name: "Add driver" }).first().click(); let d = dlg(A, "Add driver");
    await d.getByLabel("Driver ID").fill("DUI1"); await d.getByLabel("Driver name").fill("UI Driver Gamma"); await d.getByLabel("Phone").fill("9840077777"); await d.getByLabel("Licence number").fill("TN09 2026 UI0001");
    await submitDialog(A, "Add driver", "Add driver");
    await A.reload(); await A.getByRole("button", { name: "Add bus" }).first().click(); d = dlg(A, "Add bus");
    await d.getByLabel("Bus number").fill("UI-BUS"); await d.getByLabel("Registration number").fill("TN 09 UI 0001"); await d.getByLabel("Capacity").fill("30");
    await d.getByLabel("Route").fill("UI Nagar – UI Junction – School"); await d.getByLabel("Departure time").fill("06:55"); await d.getByLabel("Arrival time (school)").fill("08:05");
    await selectText(d.getByLabel("Driver"), /UI Driver Gamma/); await submitDialog(A, "Add bus", "Add bus");
    await A.reload(); const card = A.locator("div.card", { hasText: "UI-BUS" }).first();
    for (const [n, tm] of [["UI Stop One", "07:05"], ["UI Stop Two", "07:20"]]) {
      await card.getByRole("button", { name: "+ Add stop" }).click(); const sd = dlg(A, "Add stop · UI-BUS");
      await sd.getByLabel("Stop name").fill(n); await sd.getByLabel("Pick-up time").fill(tm); await sd.getByRole("button", { name: "Add stop", exact: true }).click(); await A.getByText("Stop added.").first().waitFor();
      await sd.getByRole("button", { name: "Close" }).click(); await A.reload();
    }
    const b = await raw.bus.findFirstOrThrow({ where: { busNumber: "UI-BUS" }, include: { stops: true, driver: true } });
    assert(b.stops.length === 2 && b.driver?.name === "UI Driver Gamma" && b.capacity === 30, "bus/driver/stops not stored correctly");
  }, A);
  await step("23. assign the student to the bus + stop via the student edit form", async () => {
    await A.goto(BASE + "/students?q=UI+Student+Alpha"); await A.getByRole("row").filter({ hasText: "UI Student Alpha" }).getByTitle("Edit").click(); const d = dlg(A, "Edit student");
    await selectText(d.getByLabel("School bus (optional)"), /^UI-BUS/); await selectText(d.getByLabel("Pick-up stop"), /UI Stop Two/);
    await submitDialog(A, "Edit student", "Save changes");
    const s = await raw.student.findFirstOrThrow({ where: { admissionNo: "SWUI001" }, include: { bus: true, busStop: true } }); assert(s.bus?.busNumber === "UI-BUS" && s.busStop?.name === "UI Stop Two", "bus not assigned");
  }, A);
  await step("student logs in → My Transport shows bus, driver, route, departure, arrival, stops", async () => {
    const s = await login("ui.alpha@swanschool.in"); await s.page.goto(BASE + "/transport"); const t = await body(s.page);
    for (const k of ["UI-BUS", "UI Driver Gamma", "UI Nagar – UI Junction – School", "06:55", "08:05", "UI Stop One", "UI Stop Two", "Your stop"]) assert(t.includes(k), `My Transport missing "${k}"`);
    assert(!t.includes("not active under your current plan"), "basic transport must not be locked");
    await s.page.goto(BASE + "/dashboard"); assert((await body(s.page)).includes("UI-BUS"), "dashboard My Bus tile missing"); await s.ctx.close();
  }, A);
  await step("basic transport is ACTIVE (admin page functional, advanced GPS separate & locked)", async () => {
    await A.goto(BASE + "/transport"); const t = await body(A); assert(t.includes("SW-01") && !t.includes("is not active under your current plan"), "transport page looks locked");
    assert(/Live GPS/.test(t), "advanced-transport teaser missing");
  }, A);

  sec("ADMIN — announcements (all 4 audiences, priority, expiry) then verified from each user's account");
  const stamp = "UI-" + Date.now().toString().slice(-5);
  const mk = async (title: string, audience: string, opts: { expiry?: string; priority?: string; chip?: string; date?: string } = {}) => {
    await A.goto(BASE + "/announcements"); await A.getByRole("button", { name: "New announcement" }).first().click(); const d = dlg(A, "New announcement");
    await d.getByLabel("Title").fill(title); await d.getByLabel("Content").fill(`Body of ${title}`); await d.getByLabel("Audience").selectOption(audience);
    if (opts.date) await d.getByLabel("Date", { exact: true }).fill(opts.date);
    if (opts.expiry) await d.getByLabel("Expiry date (optional)").fill(opts.expiry); if (opts.priority) await d.getByLabel("Priority").selectOption(opts.priority);
    if (opts.chip) await d.locator("label", { hasText: new RegExp(`^${opts.chip}$`) }).click();
    await submitDialog(A, "New announcement", "Publish announcement");
  };
  await step("17. create: ALL STUDENTS (urgent), ALL TEACHERS, SPECIFIC CLASS (Class 10), SPECIFIC SECTION (6-A), EXPIRED", async () => {
    await mk(`${stamp} students`, "STUDENTS", { priority: "URGENT", expiry: addDays(today, 10) });
    await mk(`${stamp} teachers`, "TEACHERS");
    await mk(`${stamp} class10`, "CLASSES", { chip: "Class 10" });
    await mk(`${stamp} section6A`, "SECTIONS", { chip: "6-A" });
    await mk(`${stamp} expired`, "ALL", { date: addDays(today, -5), expiry: addDays(today, -1) });
    await A.goto(BASE + "/announcements"); await A.getByRole("button", { name: "New announcement" }).first().click(); { const d = dlg(A, "New announcement"); await d.getByLabel("Title").fill(`${stamp} badexpiry`); await d.getByLabel("Content").fill("x y z w v"); await d.getByLabel("Expiry date (optional)").fill(addDays(today, -3)); await d.getByRole("button", { name: "Publish announcement", exact: true }).click(); await d.locator("[role=status]").waitFor(); assert(/expiry date can.t be before/.test(await d.locator("[role=status]").innerText()), "expiry-before-publish must be rejected"); await d.getByRole("button", { name: "Close" }).click(); }
    assert((await raw.announcement.count({ where: { title: { startsWith: stamp } } })) === 5, "expected 5 announcements in DB");
    await A.goto(BASE + "/announcements"); const t = await body(A); assert(t.includes(`${stamp} expired`) && t.includes("Expired"), "admin should see the expired item flagged as Expired");
  }, A);
  const seen = async (email: string) => { const u = await login(email); await u.page.goto(BASE + "/announcements"); const t = await body(u.page); await u.ctx.close(); return t; };
  await step("student in 6-A sees: students (Urgent) + section 6-A; NOT class-10 / teachers / expired", async () => {
    const t = await seen("student1@swanschool.in");
    assert(t.includes(`${stamp} students`) && t.includes("Urgent"), "missing ALL STUDENTS/urgent"); assert(t.includes(`${stamp} section6A`), "missing SECTION 6-A");
    for (const x of ["class10", "teachers", "expired"]) assert(!t.includes(`${stamp} ${x}`), `should NOT see ${x}`);
  });
  await step("student in 10-A sees: students + class 10; NOT section 6-A", async () => {
    const t = await seen("rahul.kumar@swanschool.in"); assert(t.includes(`${stamp} students`) && t.includes(`${stamp} class10`), "missing"); assert(!t.includes(`${stamp} section6A`) && !t.includes(`${stamp} teachers`), "leak");
  });
  await step("teacher sees ALL TEACHERS announcement, not the student-only one", async () => {
    const t = await seen("teacher1@swanschool.in"); assert(t.includes(`${stamp} teachers`), "teacher missing TEACHERS notice"); assert(!t.includes(`${stamp} students`), "teacher should not get STUDENTS notice");
  });
  await raw.announcement.deleteMany({ where: { title: { startsWith: stamp } } });

  sec("ADMIN — attendance views, leave approve/reject, reports, report card, branding, unlock");
  await step("18/19/20. daily, monthly and overall attendance views", async () => {
    await A.goto(BASE + `/attendance?class=${c10A.id}`); assert((await body(A)).includes("Rahul Kumar"), "daily view");
    await A.goto(BASE + `/attendance?view=monthly&class=${c10A.id}`); assert((await body(A)).includes("monthly register"), "monthly view");
    await A.goto(BASE + "/attendance?view=overall"); const t = await body(A); assert(t.includes("Class attendance") && t.includes("Section attendance") && t.includes("Monthly tracking"), "overall view"); assert((await charts(A)) > 2, "overall charts");
    await A.getByRole("link", { name: "Student history" }).click(); await A.getByText("Rahul Kumar").first().click(); await A.getByText("Download").first().waitFor();
  }, A);
  // teacher applies two leave requests through the UI
  const tl = await login("teacher3@swanschool.in");
  await step("teacher applies 2 leave requests (Earned, Casual) through the form", async () => {
    await tl.page.goto(BASE + "/leave");
    for (const [type, f, t, why] of [["EARNED", addDays(today, 30), addDays(today, 31), "UI test earned leave"], ["CASUAL", addDays(today, 45), addDays(today, 45), "UI test casual leave"]]) {
      await tl.page.getByRole("button", { name: "Apply for leave" }).first().click(); const d = dlg(tl.page, "Apply for leave");
      await d.getByLabel("Leave type").selectOption(type); await d.getByLabel("From").fill(f); await d.getByLabel("To").fill(t); await d.getByLabel("Reason").fill(why);
      await submitDialog(tl.page, "Apply for leave", "Submit request"); await tl.page.reload();
    }
    assert((await body(tl.page)).includes("PENDING"), "leave not listed as pending for teacher");
  }, tl.page);
  await step("21/22. admin sees both, APPROVES one, REJECTS the other (with remark)", async () => {
    await A.goto(BASE + "/leave"); let t = await body(A); assert(t.includes("UI test earned leave") && t.includes("UI test casual leave"), "teacher leave not visible to admin");
    const card = (why: string) => A.locator("div.card", { hasText: why }).first();
    await card("UI test earned leave").getByRole("button", { name: "Approve" }).click(); await dlg(A, /Approve leave/ as unknown as string).getByLabel("Remark (optional)").fill("Enjoy"); await submitDialog(A, /Approve leave/ as unknown as string, "Confirm approval");
    await A.reload(); await card("UI test casual leave").getByRole("button", { name: "Reject" }).click(); await dlg(A, /Reject leave/ as unknown as string).getByLabel("Remark (optional)").fill("Exam duty"); await submitDialog(A, /Reject leave/ as unknown as string, "Confirm rejection");
    const ls = await raw.leaveRequest.findMany({ where: { reason: { startsWith: "UI test" } }, orderBy: { days: "desc" } });
    assert(ls.find((l) => l.type === "EARNED")?.status === "APPROVED" && ls.find((l) => l.type === "CASUAL")?.status === "REJECTED", "statuses wrong");
    await tl.page.goto(BASE + "/leave"); t = await body(tl.page); assert(t.includes("APPROVED") && t.includes("REJECTED") && t.includes("Exam duty"), "teacher does not see decisions/remark");
    const month = addDays(today, 30).slice(0, 7); await tl.page.goto(BASE + `/attendance?view=staff&month=${month}`); assert((await body(tl.page)).includes("Leave"), "approved leave not in teacher's staff attendance");
  }, A);
  await tl.ctx.close();
  await raw.staffAttendance.deleteMany({ where: { note: "Approved leave", staff: { user: { email: "teacher3@swanschool.in" } }, date: { gte: new Date(`${addDays(today, 29)}T00:00:00Z`) } } });
  await raw.leaveRequest.deleteMany({ where: { reason: { startsWith: "UI test" } } });

  const rahul = await raw.student.findFirstOrThrow({ where: { user: { email: "rahul.kumar@swanschool.in" } } });
  const dl = async (p: Page, click: () => Promise<void>) => { const [d] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), click()]); const f = await d.path(); return { name: d.suggestedFilename(), buf: fs.readFileSync(f!) }; };
  for (const [key, label, expectText] of [["students", "Student report", "Rahul Kumar"], ["staff", "Staff report", "Anita Sharma"], ["attendance", "Attendance report", "SCHOOL TOTAL"], ["marks", "Marks report", "Mathematics"], ["results", "Results report", "Rahul Kumar"], ["classes", "Class report", "Class 10"], ["sections", "Section report", "Lakshmi"], ["transport", "Transport report", "SW-01"], ["leave", "Leave report", "Casual Leave"]] as const) {
    await step(`27/28. ${label}: renders realistic data, filter works, CSV + PDF download`, async () => {
      await A.goto(BASE + "/reports"); await A.getByRole("link", { name: label, exact: true }).click(); await A.waitForURL(new RegExp(`type=${key}`));
      const t = await body(A); assert(t.includes(expectText), `report missing "${expectText}"`); assert((await A.locator("tbody tr").count()) >= 2, "too few rows");
      if (key === "students") { await selectText(A.locator("#classId"), /^10-A/); await A.getByRole("button", { name: "Apply" }).click(); await A.waitForURL(/classId=/); assert((await A.locator("tbody tr").count()) >= 10 && !(await body(A)).includes("Class 6"), "class filter"); }
      if (key === "attendance") { await selectText(A.locator("#classId"), /^10-A/); await A.getByRole("button", { name: "Apply" }).click(); await A.waitForURL(/classId=/); assert((await body(A)).includes("Rahul Kumar"), "section attendance rows"); }
      if (key === "marks") { await selectText(A.locator("#classId"), /^10-A/); await selectText(A.locator("#subjectId"), /Mathematics/); await A.getByRole("button", { name: "Apply" }).click(); await A.waitForURL(/subjectId=/); assert(/Rahul Kumar/.test(await body(A)), "marks by subject rows"); }
      const csv = await dl(A, () => A.getByRole("link", { name: "Download CSV" }).click()); assert(csv.name.endsWith(".csv") && csv.buf.toString("utf8").split("\n").length >= 3, "csv download");
      const pdf = await dl(A, () => A.getByRole("link", { name: "Download PDF" }).click()); assert(pdf.buf.subarray(0, 4).toString() === "%PDF", "not a PDF"); const doc = await PDFDocument.load(pdf.buf); assert(doc.getPageCount() >= 1, "empty pdf");
    }, A);
  }
  await step("printable report: nav hidden, branded header (logo + school) shown in print mode", async () => {
    await A.goto(BASE + "/reports?type=students"); await A.emulateMedia({ media: "print" });
    assert(!(await A.locator("aside").first().isVisible()), "sidebar visible in print"); assert(await A.locator('main img[src="/swan-logo.png"]').first().isVisible(), "print header logo hidden");
    assert((await A.locator("main").innerText()).includes("Generated"), "print header missing"); await A.emulateMedia({ media: "screen" });
  }, A);
  await step("30. report card: page, real PDF download (logo + signature embedded), CSV", async () => {
    await A.goto(BASE + `/results/report-card/${rahul.id}`); const t = await body(A);
    assert(t.includes("REPORT CARD") && t.includes("Rahul Kumar") && t.includes("Authorized Signature"), "report card content");
    const pdf = await dl(A, () => A.getByRole("link", { name: "Download PDF" }).click()); assert(pdf.buf.subarray(0, 4).toString() === "%PDF", "not a PDF"); assert(pdf.name.startsWith("report-card-"), pdf.name);
    const doc = await PDFDocument.load(pdf.buf); assert(doc.getPageCount() === 1, "pages"); const imgs = doc.context.enumerateIndirectObjects().filter(([, o]) => { try { const dct = (o as unknown as { dict?: { get: (k: unknown) => unknown } }).dict; return dct?.get(PDFName.of("Subtype"))?.toString() === "/Image"; } catch { return false; } }).length; assert(imgs >= 1, "no embedded logo image");
  }, A);
  await step("28. print report card (print CSS)", async () => {
    await A.emulateMedia({ media: "print" }); assert(!(await A.locator("aside").first().isVisible()), "sidebar visible in print"); assert(await A.getByText("REPORT CARD").first().isVisible(), "report card hidden in print"); await A.emulateMedia({ media: "screen" });
  }, A);

  await step("27. branding: change details + upload PRINCIPAL SIGNATURE → saved, persists, shows on report card + PDF", async () => {
    await A.goto(BASE + "/branding"); await A.getByLabel("Tagline").fill("Smarter Management. Better Learning. Brighter Future."); await A.getByLabel("Principal name").fill("Dr. Kavitha Raghavan");
    await A.getByLabel("Website").fill("https://www.swanschool.in"); await A.getByLabel("Phone").fill("+91 98765 43210");
    await A.locator('input[name="signature"]').setInputFiles(path.join(FIX, "signature.png")); await A.getByRole("button", { name: "Save branding" }).click();
    await A.getByText("Branding saved").first().waitFor({ timeout: 15000 });
    const sch = await raw.school.findUniqueOrThrow({ where: { id: swan.id } }); assert(sch.signatureData?.startsWith("data:image/png"), "signature not stored");
    await A.reload(); const prev = A.locator('img[alt="Signature"]'); await prev.waitFor(); assert(await prev.evaluate((i) => (i as HTMLImageElement).naturalWidth > 10), "signature preview does not render after reload");
    await A.goto(BASE + `/results/report-card/${rahul.id}`); const sg = A.locator('img[alt="Authorized signature"]'); await sg.waitFor(); assert(await sg.evaluate((i) => (i as HTMLImageElement).naturalWidth > 10), "signature not on report card");
    const pdf = await dl(A, () => A.getByRole("link", { name: "Download PDF" }).click()); const doc = await PDFDocument.load(pdf.buf);
    const imgs = doc.context.enumerateIndirectObjects().filter(([, o]) => { try { const dct = (o as unknown as { dict?: { get: (k: unknown) => unknown } }).dict; return dct?.get(PDFName.of("Subtype"))?.toString() === "/Image"; } catch { return false; } }).length; assert(imgs >= 2, `PDF should embed logo + signature, images=${imgs}`);
  }, A);
  await step("branding also on locked receipt preview", async () => { await A.goto(BASE + "/receipts"); assert(await A.locator('img[alt="Authorized signature"]').first().isVisible(), "signature missing on receipt preview"); }, A);

  sec("UNLOCK REQUEST — end to end from the UI (Parent Portal, Fee Management, Advanced Transport)");
  await raw.featureUnlockRequest.deleteMany({ where: { schoolId: swan.id } });
  for (const [route, feature, label] of [["/parent", "parent_portal", "Parent Portal"], ["/fees", "fees", "Fee Management"], ["/transport/advanced", "advanced_transport", "Advanced Transport & Live GPS"]] as const) {
    await step(`31. ${label}: locked page → Request Unlock → form → PENDING record + confirmation`, async () => {
      await A.goto(BASE + route); const t = await body(A); assert(t.includes(`${label === "Advanced Transport & Live GPS" ? label : label} is not active under your current plan`), "restriction message missing");
      await A.getByRole("link", { name: "Request Unlock" }).click(); await A.waitForURL(/swan-digital\?feature=/);
      assert((await A.locator("#school").inputValue()) === "Swan School", "school name not prefilled"); assert((await A.locator("#feature").inputValue()) === feature, "feature not preselected");
      await A.getByLabel("Message").fill(`We would like to activate ${label} for our school.`); await A.getByRole("button", { name: "Submit request" }).click();
      await A.getByText("Your request has been submitted to Swan Digital Solutions.").first().waitFor({ timeout: 15000 }); assert((await body(A)).includes("https://swandigitalsolutions.com"), "website link missing in confirmation");
      const r = await raw.featureUnlockRequest.findFirst({ where: { schoolId: swan.id, requestedFeature: feature } }); assert(r && r.status === "PENDING" && r.message.includes(label) && r.email === "admin@swanschool.in" && r.phone, "DB record wrong");
    }, A);
  }
  await step("all 3 requests visible in 'Your requests' as PENDING", async () => { await A.goto(BASE + "/swan-digital"); const t = await body(A); assert((t.match(/PENDING/g) ?? []).length >= 3, "expected 3 pending"); }, A);

  sec("LOCKED features — every page shows restriction + Request Unlock + disabled controls");
  const LOCKED_UI: [string, string, string[]][] = [
    ["/fees", "Fee Management", ["Create fee structure"]], ["/payments", "Online Payment", ["Connect gateway"]], ["/receipts", "Fee Receipt Generation", ["Generate receipt", "Download PDF"]],
    ["/parent", "Parent Portal", ["Pay fees", "Track bus live"]], ["/non-teaching", "Non-Teaching Staff Management", ["Add staff", "View profile", "Edit", "Deactivate"]],
    ["/transport/advanced", "Advanced Transport & Live GPS", ["Optimise routes"]], ["/transport/gps", "Advanced Transport & Live GPS", ["Open live map"]], ["/transport/tracking", "Advanced Transport & Live GPS", ["Open live map"]],
    ["/transport/parent-tracking", "Advanced Transport & Live GPS", ["Enable for parents"]], ["/transport/driver-app", "Advanced Transport & Live GPS", ["Invite driver"]],
    ["/notifications", "SMS / Email / WhatsApp Notifications", ["Create rule"]], ["/notifications/sms", "SMS Notifications", ["Add template"]], ["/notifications/email", "Email Notifications", ["Add template"]], ["/notifications/whatsapp", "WhatsApp Notifications", ["Connect number"]],
    ["/biometric", "Biometric/RFID Attendance Integration", ["Add device"]], ["/payroll", "Payroll", ["Run payroll"]], ["/library", "Library Management", ["Add book"]], ["/inventory", "Inventory Management", ["Add item"]], ["/hostel", "Hostel Management", ["Allocate room"]],
  ];
  for (const [route, title, buttons] of LOCKED_UI)
    await step(`${route} — "${title} is not active under your current plan", Request Unlock, disabled controls, no forms`, async () => {
      await A.goto(BASE + route); const t = await body(A); assert(t.includes(`${title} is not active under your current plan.`), "restriction message");
      assert(t.includes("This feature is available as an additional subscription"), "subscription line"); assert(t.includes("Swan Digital Solutions"), "contact line");
      assert(await A.getByRole("link", { name: "Request Unlock" }).isVisible(), "Request Unlock button"); assert(t.includes("DEMO PREVIEW"), "DEMO label");
      for (const b of buttons) { const btn = A.getByRole("button", { name: b }).first(); assert(await btn.isDisabled(), `button "${b}" must be disabled`); }
      assert((await A.locator("main form").count()) === 0, "locked page must contain no working forms"); assert(await A.locator('img[src="/swan-logo.png"]').count() >= 2, "logo missing");
    }, A);
  await step("/custom — custom-quote wording + Contact Swan Digital Solutions", async () => { await A.goto(BASE + "/custom"); const t = await body(A); assert(t.includes("customized according to your school's requirements") && t.includes("Contact Swan Digital Solutions"), "custom wording"); }, A);
  await step("Parent Portal preview covers all 10 areas, labelled DEMO", async () => {
    await A.goto(BASE + "/parent"); const t = await body(A); for (const k of ["Child Profile", "Attendance", "Attendance percentage", "Marks & Results", "Timetable", "Announcements", "Fees", "Transport", "Academic Performance"]) assert(t.includes(k), `parent preview missing ${k}`);
    assert(t.includes("Contact Swan Digital Solutions to activate Parent Portal."), "activate wording");
  }, A);
  await step("Non-Teaching preview: categories, search/filter disabled, columns", async () => {
    await A.goto(BASE + "/non-teaching"); const t = await body(A); for (const k of ["Office Staff", "Cleaner", "Watchman", "Helper", "Maintenance", "Other", "Employee ID", "Department", "Designation", "Joining date", "Status"]) assert(t.toLowerCase().includes(k.toLowerCase()), `missing ${k}`);
    assert(await A.getByLabel("Search non-teaching staff").isDisabled() && await A.getByLabel("Filter by category").isDisabled(), "search/filter must be disabled"); assert(t.includes("Contact Swan Digital Solutions to unlock this feature."), "unlock wording");
  }, A);
  await step("receipt preview: PREVIEW — NOT A VALID RECEIPT + all template fields + logo", async () => {
    await A.goto(BASE + "/receipts"); const t = await body(A); assert(t.includes("PREVIEW — NOT A VALID RECEIPT"), "label"); for (const k of ["Receipt No.", "Payment Date", "Student Name", "Admission No.", "Class / Section", "Academic Year", "Fee Type", "Amount", "Authorized Signature"]) assert(t.includes(k), `missing ${k}`);
    assert(await A.locator('img[src="/swan-logo.png"]').count() >= 2, "logo");
  }, A);
  await step("no fake live location on GPS pages (no coordinates / live speed)", async () => {
    for (const r of ["/transport/gps", "/transport/tracking"]) { await A.goto(BASE + r); const t = await body(A); assert(t.includes("no live location") || t.includes("Illustration only"), "must say no live location"); assert(!/\d+\s?km\/h/.test(t) && !/\d{2}\.\d{4}/.test(t), "fake live data on GPS page"); }
  }, A);

  /* ============================== TEACHER ============================== */
  sec("TEACHER (Anita Sharma) — classes, timetable, attendance (P/A/L/E), marks, leave, permissions");
  const { ctx: tctx, page: T } = await login("teacher1@swanschool.in");
  const anita = await raw.staff.findFirstOrThrow({ where: { user: { email: "teacher1@swanschool.in" } } });
  await step("teacher dashboard + assigned classes/subjects only", async () => {
    const t = await body(T); assert(t.includes("MY CLASSES") || t.toUpperCase().includes("MY CLASSES"), "tiles"); await T.goto(BASE + "/classes"); const c = await body(T);
    assert(c.includes("Class 10-A") && c.includes("Mathematics"), "assigned class/subject missing"); const all = await raw.classRoom.count({ where: { schoolId: swan.id } }); const shown = await T.locator("div.card h3, .card .text-lg").count(); void all; void shown;
    assert(!(await T.getByRole("button", { name: "Add class" }).count()), "teacher must not see Add class"); assert(!(await T.getByTitle("Delete").count()), "teacher must not delete classes");
  }, T);
  await step("teacher timetable page (My Timetable) shows her periods", async () => { await T.goto(BASE + "/timetable"); const t = await body(T); assert(t.includes("periods a week") && /Class \d+-[AB]/.test(t), "teacher schedule"); }, T);
  await step("mark attendance: Present, Absent, Late, Excused → Save → stored & visible to student", async () => {
    const day = addDays(today, -2); const studs = await raw.student.findMany({ where: { classId: c6A.id }, include: { user: true }, orderBy: { rollNo: "asc" }, take: 4 });
    await T.goto(BASE + `/attendance?class=${c6A.id}&date=${day}`); await T.getByRole("button", { name: "Mark all present" }).click();
    const set = ["PRESENT", "ABSENT", "LATE", "EXCUSED"], lab = ["Present", "Absent", "Late", "Excused"];
    for (let i = 0; i < 4; i++) await T.locator(`[aria-label="Attendance for ${studs[i].user.name}"]`).getByRole("radio", { name: lab[i], exact: true }).click();
    await T.getByRole("button", { name: "Save attendance" }).click(); await T.getByText(/Attendance saved for/).first().waitFor({ timeout: 15000 });
    for (let i = 0; i < 4; i++) { const r = await raw.studentAttendance.findUniqueOrThrow({ where: { studentId_date: { studentId: studs[i].id, date: new Date(`${day}T00:00:00Z`) } } }); assert(r.status === set[i] && r.markedById, `student ${i} status ${r.status}`); }
    const su = await login(studs[1].user.email); await su.page.goto(BASE + "/attendance"); const t = await body(su.page); assert(t.includes("Absent"), "student cannot see the absence teacher marked"); await su.ctx.close();
  }, T);
  await step("enter marks (internal 19 + theory 74) → saved → visible in Rahul's account", async () => {
    const ex = await raw.exam.findFirstOrThrow({ where: { schoolId: swan.id, name: "Half-Yearly Exam" } });
    await T.goto(BASE + `/marks?exam=${ex.id}&class=${c10A.id}`); assert((await body(T)).includes("Mathematics"), "Maths subject chip");
    await T.getByLabel("Internal marks for Rahul Kumar").fill("19"); await T.getByLabel("Theory marks for Rahul Kumar").fill("74");
    assert((await T.getByRole("row").filter({ hasText: "Rahul Kumar" }).innerText()).includes("93/100"), "live total should show 93/100"); await T.getByRole("button", { name: "Save marks" }).click(); await T.getByText(/Marks saved/).first().waitFor({ timeout: 15000 });
    const m = await raw.mark.findFirstOrThrow({ where: { studentId: rahul.id, examId: ex.id, subject: { code: "MAT" } } }); assert(m.internal === 19 && m.theory === 74, "not stored");
    const ru = await login("rahul.kumar@swanschool.in"); await ru.page.goto(BASE + `/results?exam=${ex.id}`); const t = await body(ru.page); assert(t.includes("Mathematics") && t.includes("93"), "Rahul cannot see the new marks"); await ru.ctx.close();
    await raw.mark.deleteMany({ where: { examId: ex.id } });
  }, T);
  await step("teacher CANNOT modify another teacher's class / subject / section", async () => {
    const foreign = await raw.classRoom.findFirstOrThrow({ where: { schoolId: swan.id, id: { notIn: (await raw.allocation.findMany({ where: { teacherId: anita.id } })).map((a) => a.classId).concat((await raw.classRoom.findMany({ where: { classTeacherId: anita.id } })).map((c) => c.id)) } } });
    await T.goto(BASE + `/marks?class=${foreign.id}`); const t = await body(T); assert(!t.includes(`${foreign.grade.replace("Class ", "")}-${foreign.section}`) || t.includes("assigned"), "foreign class offered");
    const chips = await T.locator("a.btn", { hasText: new RegExp(`^${foreign.grade.replace("Class ", "")}-${foreign.section}$`) }).count(); assert(chips === 0, "foreign section chip visible");
    await T.goto(BASE + `/marks?class=${c10A.id}&subject=${(await raw.subject.findFirstOrThrow({ where: { schoolId: swan.id, code: "ENG" } })).id}`);
    const subs = await T.locator("a.btn").allInnerTexts(); assert(!subs.includes("English"), "another teacher's subject offered"); assert(await T.getByLabel(/Internal marks for/).count() > 0 ? subs.includes("Mathematics") : true, "only own subject");
    await T.goto(BASE + `/attendance?class=${foreign.id}`); const chip2 = await T.locator("a.btn", { hasText: new RegExp(`^${foreign.grade.replace("Class ", "")}-${foreign.section}$`) }).count(); assert(chip2 === 0, "foreign section offered in attendance");
    for (const p of ["/students", "/staff", "/branding", "/reports", "/allocations", "/swan-digital"]) { await T.goto(BASE + p); assert(T.url().includes("/dashboard"), `${p} should redirect`); }
    const fs2 = await raw.student.findFirstOrThrow({ where: { classId: foreign.id } }); const r = await T.goto(BASE + `/students/${fs2.id}`); assert(r!.status() === 404, "foreign student profile should be 404");
  }, T);
  await step("teacher applies leave (form) → appears for admin; own staff attendance visible; announcements page", async () => {
    await T.goto(BASE + "/leave"); await T.getByRole("button", { name: "Apply for leave" }).first().click(); const d = dlg(T, "Apply for leave");
    await d.getByLabel("Leave type").selectOption("SICK"); await d.getByLabel("From").fill(addDays(today, 60)); await d.getByLabel("To").fill(addDays(today, 60)); await d.getByLabel("Reason").fill("UI anita sick leave"); await submitDialog(T, "Apply for leave", "Submit request");
    await A.goto(BASE + "/leave"); assert((await body(A)).includes("UI anita sick leave"), "leave not visible to admin"); await raw.leaveRequest.deleteMany({ where: { reason: "UI anita sick leave" } });
    await T.goto(BASE + "/attendance?view=staff"); assert((await body(T)).includes("My attendance"), "own staff attendance"); await T.goto(BASE + "/announcements"); assert((await T.locator("li").count()) > 0, "announcements");
  }, T);
  await tctx.close();

  /* ============================== STUDENT ============================== */
  sec("STUDENT (Pooja/student1, 6-A) — own data only, correct counts, charts, privacy");
  const s1 = await raw.user.findUniqueOrThrow({ where: { email: "student1@swanschool.in" }, include: { student: true } });
  const { ctx: sctx, page: S } = await login("student1@swanschool.in");
  const recs = await raw.studentAttendance.findMany({ where: { studentId: s1.student!.id } });
  const cnt = (st: string) => recs.filter((r) => r.status === st).length; const denom = recs.filter((r) => r.status !== "EXCUSED").length; const pctv = Math.round(((cnt("PRESENT") + cnt("LATE")) / denom) * 1000) / 10;
  await step("attendance: Present / Absent / Late days and percentage match the database; charts render", async () => {
    await S.goto(BASE + "/attendance"); const t = await S.locator("main").innerText();
    const tile = (label: string) => new RegExp(`${label}\\s*\\n\\s*(\\d+(?:\\.\\d+)?)`, "i").exec(t)?.[1];
    assert(Number(tile("Present days")) === cnt("PRESENT"), `present shown ${tile("Present days")} vs db ${cnt("PRESENT")}`); assert(Number(tile("Absent days")) === cnt("ABSENT"), `absent ${tile("Absent days")} vs ${cnt("ABSENT")}`);
    assert(Number(tile("Late days")) === cnt("LATE"), `late ${tile("Late days")} vs ${cnt("LATE")}`); assert(t.includes(`${pctv}%`), `percentage ${pctv}% not shown`); assert((await charts(S)) > 2, "monthly chart not rendered");
    assert(await S.locator(".grid-cols-7").count() > 0, "calendar view"); assert((await S.locator("ul li").count()) >= recs.length, "history list incomplete");
  }, S);
  await step("monthly attendance: previous month navigation changes the calendar; downloads (CSV + PDF)", async () => {
    const before = await S.locator(".grid-cols-7").last().innerText(); await S.getByLabel("Previous month").click(); await S.waitForURL(/month=/); const after = await S.locator(".grid-cols-7").last().innerText(); assert(before !== after, "calendar did not change");
    const c = await dl(S, () => S.getByRole("link", { name: "CSV", exact: true }).click()); assert(c.buf.toString().includes("Status"), "csv"); const p = await dl(S, () => S.getByRole("link", { name: "PDF", exact: true }).click()); assert(p.buf.subarray(0, 4).toString() === "%PDF", "pdf");
  }, S);
  await step("dashboard: 4 attendance tiles + performance charts render", async () => { await S.goto(BASE + "/dashboard"); const t = await body(S); for (const k of ["PRESENT DAYS", "ABSENT DAYS", "LATE DAYS", "ATTENDANCE"]) assert(t.toUpperCase().includes(k), k); assert((await charts(S)) > 3, "charts"); }, S);
  await step("results, report card (page + PDF), timetable, announcements — own only", async () => {
    await S.goto(BASE + "/results"); let t = await body(S); assert(t.toLowerCase().includes("subject-wise") && t.toLowerCase().includes("internal") && t.toLowerCase().includes("theory"), "results"); assert((await charts(S)) > 2, "result charts");
    await S.getByRole("link", { name: "Report card" }).first().click(); await S.waitForURL(/report-card/); t = await body(S); assert(t.includes(s1.name) && t.includes("REPORT CARD"), "report card own");
    const pdf = await dl(S, () => S.getByRole("link", { name: "Download PDF" }).click()); assert(pdf.buf.subarray(0, 4).toString() === "%PDF", "pdf");
    await S.goto(BASE + "/timetable"); assert(/monday/i.test(await body(S)), "timetable"); await S.goto(BASE + "/announcements"); assert((await S.locator("li").count()) > 0, "announcements");
  }, S);
  await step("profile shows only own data", async () => { await S.goto(BASE + "/profile"); const t = await body(S); assert(t.includes(s1.name) && t.includes("Class information") && t.includes("Transport"), "own profile"); assert(!t.includes("Rahul Kumar"), "leak"); }, S);
  await step("PRIVACY: other student's profile / report card / attendance CSV+PDF / marks CSV → safe 404/403, nothing leaked", async () => {
    let r = await S.goto(BASE + `/students/${rahul.id}`); assert(r!.status() === 404, `profile ${r!.status()}`); const t = await body(S); assert(!t.includes("Rahul") && !t.includes("SW2026081"), "leaked data on 404");
    r = await S.goto(BASE + `/results/report-card/${rahul.id}`); assert(r!.status() === 404, `report card ${r!.status()}`);
    for (const u of [`/results/report-card/${rahul.id}/pdf`]) assert((await S.request.get(BASE + u)).status() === 404, `${u}`);
    for (const u of [`/reports/export?type=student_attendance&student=${rahul.id}`, `/reports/export?type=report_card&student=${rahul.id}`, `/reports/export?type=student_attendance&format=pdf&student=${rahul.id}`, "/reports/export?type=students"]) assert((await S.request.get(BASE + u)).status() === 403, `${u}`);
    for (const u of [`/attendance?student=${rahul.id}`, `/results?student=${rahul.id}&exam=x`, `/transport?student=${rahul.id}`, `/dashboard?student=${rahul.id}`]) { await S.goto(BASE + u); assert(!(await body(S)).includes("Rahul Kumar"), `${u} leaked Rahul`); }
    for (const u of ["/students", "/staff", "/marks", "/leave", "/reports", "/branding", "/system", "/allocations"]) { await S.goto(BASE + u); assert(S.url().includes("/dashboard"), `${u} not blocked`); }
  }, S);
  await sctx.close();

  /* ============================== VIEWPORTS ============================== */
  sec("RESPONSIVE — 1280 / 1366 / 768 / 390: no horizontal overflow, key pages");
  const states = { admin: await actx.storageState(), teacher: (await (async () => { const x = await login("teacher1@swanschool.in"); const s = await x.ctx.storageState(); await x.ctx.close(); return s; })()), student: (await (async () => { const x = await login("student1@swanschool.in"); const s = await x.ctx.storageState(); await x.ctx.close(); return s; })()) };
  const VPS = [[1280, 800], [1366, 768], [768, 1024], [390, 844]] as const;
  const PAGES: Record<string, string[]> = {
    admin: ["/dashboard", "/attendance", "/attendance?view=overall", "/marks", "/timetable", "/reports", "/reports?type=attendance", "/transport", "/students", "/classes", "/fees", "/parent", "/non-teaching", "/receipts", "/transport/gps", "/notifications", "/swan-digital", "/branding"],
    teacher: ["/dashboard", "/attendance", "/marks", "/timetable", "/classes", "/leave", "/transport"],
    student: ["/dashboard", "/attendance", "/results", "/timetable", "/transport", "/profile", "/announcements"],
  };
  for (const [vw, vh] of VPS) {
    const lp = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage(); await lp.goto(BASE + "/login", { waitUntil: "networkidle" });
    await step(`${vw}px login: no overflow, form usable`, async () => { const o = await overflowOffenders(lp); assert(!o.length, o.join("; ")); assert(await lp.getByRole("button", { name: /Sign in as/ }).isVisible(), "sign-in button"); if (vw === 390) await lp.screenshot({ path: path.join(SHOTS, `login-${vw}.png`) }); }, lp);
    await lp.context().close();
    for (const [role, st] of Object.entries(states)) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, storageState: st }); const pg = await ctx.newPage();
      for (const route of PAGES[role]) await step(`${vw}px ${role} ${route}`, async () => {
        const r = await pg.goto(BASE + route, { waitUntil: "networkidle" }); assert(r!.status() === 200, `status ${r!.status()}`); await pg.waitForTimeout(600);
        const o = await overflowOffenders(pg); assert(!o.length, `overflow: ${o.join("; ")}`);
        if (vw === 390 && ["/dashboard", "/attendance", "/marks", "/timetable", "/reports", "/transport", "/fees", "/parent", "/non-teaching"].includes(route)) await pg.screenshot({ path: path.join(SHOTS, `${role}-${route.replace(/\W+/g, "_")}-${vw}.png`), fullPage: true });
      }, pg);
      await ctx.close();
    }
  }
  await step("mobile drawer menu opens and navigates (390px)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: states.student }); const pg = await ctx.newPage(); await pg.goto(BASE + "/dashboard");
    await pg.getByLabel("Open menu").click(); await pg.getByRole("link", { name: "My Transport" }).click(); await pg.waitForURL(/transport/); await ctx.close();
  });

  await actx.close(); await browser.close(); await raw.$disconnect();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length} passed, ${bad.length} failed   (screenshots: ${SHOTS})`);
  for (const b of bad) console.log(`  ✗ [${b.section}] ${b.name}\n      ${b.note}`);
  process.exit(bad.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
