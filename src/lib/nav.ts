import { LOCKED_LIST, type LockedMeta } from "@/lib/features";

type Role = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  locked?: boolean;
  also?: string[]; // child pages that belong to this item (highlight it, not a parent item)
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

const lockedItem = (m: LockedMeta, unlocked: Set<string>, label?: string): NavItem => ({
  href: m.href, label: label ?? m.title, icon: m.icon, locked: !unlocked.has(m.key), also: Object.values(m.variants ?? {}).map((v) => v.href),
});

export function navFor(role: Role, unlocked: Set<string>): NavGroup[] {
  const addons = (roles: Role[]) => LOCKED_LIST.filter((m) => (m.roles as Role[]).some((r) => roles.includes(r) && r === role)).map((m) => lockedItem(m, unlocked));

  if (role === "ADMIN") {
    return [
      { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
      {
        label: "People & Classes",
        items: [
          { href: "/students", label: "Students", icon: "students" },
          { href: "/staff", label: "Teaching Staff", icon: "staff" },
          { href: "/classes", label: "Classes & Years", icon: "classes" },
          { href: "/subjects", label: "Subjects", icon: "subjects" },
          { href: "/allocations", label: "Class & Teacher Allocation", icon: "allocation" },
        ],
      },
      {
        label: "Academics",
        items: [
          { href: "/attendance", label: "Attendance", icon: "attendance" },
          { href: "/marks", label: "Marks & Exams", icon: "marks" },
          { href: "/results", label: "Results", icon: "results" },
          { href: "/remarks", label: "Remarks & Observations", icon: "announce" },
          { href: "/timetable", label: "Timetable", icon: "timetable" },
        ],
      },
      {
        label: "Operations",
        items: [
          { href: "/transport", label: "Transport", icon: "bus" },
          { href: "/announcements", label: "Announcements", icon: "announce" },
          { href: "/leave", label: "Staff Leave", icon: "leave" },
        ],
      },
      { label: "Insights", items: [{ href: "/reports", label: "Reports", icon: "reports" }] },
      {
        label: "School",
        items: [
          { href: "/branding", label: "Branding & Settings", icon: "branding" },
          { href: "/system", label: "Database & Deployment", icon: "system" },
        ],
      },
      { label: "Add-on Features", items: addons(["ADMIN"]) },
      { label: "Support", items: [{ href: "/swan-digital", label: "Swan Digital Solutions", icon: "swan" }] },
    ];
  }
  if (role === "TEACHER") {
    return [
      { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
      {
        label: "Teaching",
        items: [
          { href: "/classes", label: "My Classes & Subjects", icon: "classes" },
          { href: "/students", label: "My Students", icon: "students" },
          { href: "/attendance", label: "Attendance", icon: "attendance" },
          { href: "/marks", label: "Enter Marks", icon: "marks" },
          { href: "/remarks", label: "Student Remarks", icon: "announce" },
          { href: "/results", label: "Results", icon: "results" },
          { href: "/timetable", label: "My Timetable", icon: "timetable" },
        ],
      },
      {
        label: "School",
        items: [
          { href: "/transport", label: "Transport", icon: "bus" },
          { href: "/announcements", label: "Announcements", icon: "announce" },
          { href: "/leave", label: "My Leave", icon: "leave" },
        ],
      },
      { label: "Account", items: [{ href: "/profile", label: "My Profile", icon: "profile" }] },
    ];
  }
  return [
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
    {
      label: "My School",
      items: [
        { href: "/attendance", label: "My Attendance", icon: "attendance" },
        { href: "/results", label: "Marks & Results", icon: "results" },
        { href: "/timetable", label: "My Class Timetable", icon: "timetable" },
        { href: "/transport", label: "My Transport", icon: "bus" },
        { href: "/announcements", label: "Announcements", icon: "announce" },
      ],
    },
    { label: "Add-on Features", items: addons(["STUDENT"]) },
    { label: "Account", items: [{ href: "/profile", label: "My Profile", icon: "profile" }] },
  ];
}
