import { clsx, type ClassValue } from "clsx";

export const cn = (...v: ClassValue[]) => clsx(v);

/* ---------- dates (all date-only values are handled as YYYY-MM-DD in IST) ---------- */
const TZ = "Asia/Kolkata";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? toDate(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(date);
}

export function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function addDays(isoDate: string, n: number): string {
  const d = toDate(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function monthStr(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string; days: number } {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, "0")}`, days };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export function weekday(isoDate: string): number {
  // 0 = Sunday
  return toDate(isoDate).getUTCDay();
}

export function inclusiveDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000) + 1;
}

/* ---------- timetable ---------- */
export const DAYS = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
  { n: 6, short: "Sat", long: "Saturday" },
];

export const PERIODS = [
  { n: 1, time: "08:30 – 09:15" },
  { n: 2, time: "09:15 – 10:00" },
  { n: 3, time: "10:15 – 11:00" },
  { n: 4, time: "11:00 – 11:45" },
  { n: 5, time: "12:30 – 13:15" },
  { n: 6, time: "13:15 – 14:00" },
  { n: 7, time: "14:00 – 14:45" },
  { n: 8, time: "14:45 – 15:30" },
];

/* ---------- grades ---------- */
export const GRADE_SCALE = [
  { min: 90, grade: "A+", color: "#059669", label: "Outstanding" },
  { min: 80, grade: "A", color: "#16a34a", label: "Excellent" },
  { min: 70, grade: "B+", color: "#0891b2", label: "Very Good" },
  { min: 60, grade: "B", color: "#2563eb", label: "Good" },
  { min: 50, grade: "C", color: "#d97706", label: "Satisfactory" },
  { min: 35, grade: "D", color: "#ea580c", label: "Pass" },
  { min: 0, grade: "F", color: "#e11d48", label: "Needs Improvement" },
];

export const PASS_PERCENT = 35;

export function gradeFor(percent: number) {
  return GRADE_SCALE.find((g) => percent >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

/* ---------- attendance ---------- */
export const ATT_STATUS = {
  PRESENT: { label: "Present", short: "P", color: "#059669", bg: "#d1fae5" },
  ABSENT: { label: "Absent", short: "A", color: "#e11d48", bg: "#ffe4e6" },
  LATE: { label: "Late", short: "L", color: "#d97706", bg: "#fef3c7" },
  EXCUSED: { label: "Excused", short: "E", color: "#7c3aed", bg: "#ede9fe" },
  LEAVE: { label: "Leave", short: "LV", color: "#0284c7", bg: "#e0f2fe" },
} as const;

export type AttStatus = keyof typeof ATT_STATUS;
export const STUDENT_STATUSES: AttStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
export const STAFF_STATUSES: AttStatus[] = ["PRESENT", "ABSENT", "LATE", "LEAVE"];

/** Present + Late count as attended. Excused / approved-leave days are left out of the percentage. */
export function attendancePercent(rows: { status: string }[]): number {
  const counted = rows.filter((r) => r.status !== "EXCUSED" && r.status !== "LEAVE");
  if (!counted.length) return 0;
  const attended = counted.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  return Math.round((attended / counted.length) * 1000) / 10;
}

export function attendanceCounts(rows: { status: string }[]) {
  const c = (s: string) => rows.filter((r) => r.status === s).length;
  return { total: rows.length, present: c("PRESENT"), absent: c("ABSENT"), late: c("LATE"), excused: c("EXCUSED"), leave: c("LEAVE"), percent: attendancePercent(rows) };
}

/* ---------- leave ---------- */
export const LEAVE_TYPES = {
  CASUAL: { label: "Casual Leave", quota: 12, color: "#0891b2" },
  SICK: { label: "Sick Leave", quota: 10, color: "#ec4899" },
  EARNED: { label: "Earned Leave", quota: 15, color: "#f97316" },
} as const;

/* ---------- misc ---------- */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const AVATARS = ["#e11d48", "#7c3aed", "#0891b2", "#059669", "#ea580c", "#2563eb", "#db2777", "#0d9488"];
export function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

export function className(c: { grade: string; section: string }): string {
  return `${c.grade.replace(/^(Grade|Class)\s+/i, "")}-${c.section}`;
}

export const examMax = (e: { maxInternal: number; maxTheory: number }) => e.maxInternal + e.maxTheory;

/** Relative luminance 0..1 of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
