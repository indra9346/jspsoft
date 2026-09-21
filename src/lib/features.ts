/**
 * Central feature-access registry (safe to import from client and server).
 *
 * DEFAULT features are always on. LOCKED features are off until Swan Digital
 * Solutions enables them for a school (school_features table). Every check goes
 * through lib/features-server.ts — never scatter ad-hoc checks in the code.
 */
export const DEFAULT_FEATURES = [
  "students", "staff", "classes", "subjects", "allocation", "attendance", "teacher_attendance",
  "marks", "results", "timetable", "announcements", "leave", "transport", "reports", "branding",
] as const;
export type DefaultFeature = (typeof DEFAULT_FEATURES)[number];

export const LOCKED_KEYS = [
  "fees", "payments", "receipts", "parent_portal", "non_teaching_staff", "advanced_transport", "gps",
  "notifications", "biometric", "payroll", "library", "inventory", "hostel", "custom_integrations",
] as const;
export type LockedFeature = (typeof LOCKED_KEYS)[number];
export type FeatureKey = DefaultFeature | LockedFeature;

export const SWAN = {
  name: "Swan Digital Solutions",
  website: "https://swandigitalsolutions.com",
  tagline: "Grow Smarter. Go Digital.",
};
export const PLAN_NAME = "Default Package";

export interface Preview {
  stats: { label: string; value: string }[];
  title: string;
  columns: string[];
  rows: string[][];
  actions: string[];
}

export interface Variant {
  title: string;
  href: string;
  icon?: string;
  summary: string;
  bullets: string[];
  preview: Preview;
  kind?: "map";
}

export interface LockedMeta {
  key: LockedFeature;
  title: string; // "Fee Management"
  href: string;
  color: string;
  icon: string;
  group: "Finance" | "People" | "Transport" | "Communication" | "Campus" | "Custom";
  summary: string;
  bullets: string[];
  preview: Preview;
  custom?: boolean; // custom quote wording
  roles: ("ADMIN" | "TEACHER" | "STUDENT")[];
  heading?: string; // overrides "<title> is not active under your current plan."
  contact?: string; // overrides the "Contact Swan Digital Solutions to unlock ..." line
  kind?: "receipt" | "parent" | "nonteaching" | "map";
  variants?: Record<string, Variant>; // extra locked pages that belong to the same add-on
}

export const LOCKED: Record<LockedFeature, LockedMeta> = {
  fees: {
    key: "fees", title: "Fee Management", href: "/fees", color: "#ec4899", icon: "wallet", group: "Finance",
    summary: "Tuition and bus fee management with due dates, payment history and reminders.",
    bullets: ["Tuition & bus fee structure", "Pending / paid fee tracking", "Due dates & payment history", "Fee reminders"],
    roles: ["ADMIN", "STUDENT"],
    preview: {
      stats: [{ label: "Collected this month", value: "₹ 4,82,500" }, { label: "Pending fee", value: "₹ 1,36,000" }, { label: "Tuition fee", value: "₹ 3,90,000" }, { label: "Bus fee", value: "₹ 92,500" }],
      title: "Payment history", columns: ["Student", "Class", "Fee type", "Due date", "Amount", "Status"],
      rows: [["Sample Student A", "10-A", "Tuition Fee – Term 2", "10 Oct 2026", "₹ 18,000", "Paid"], ["Sample Student B", "9-B", "Bus Fee – Q2", "10 Oct 2026", "₹ 6,500", "Pending"], ["Sample Student C", "8-A", "Tuition Fee – Term 2", "10 Oct 2026", "₹ 16,000", "Paid"], ["Sample Student D", "7-B", "Tuition Fee – Term 2", "10 Oct 2026", "₹ 15,000", "Overdue"]],
      actions: ["Create fee structure", "Record payment", "Send reminder"],
    },
  },
  payments: {
    key: "payments", title: "Online Payment", href: "/payments", color: "#2563eb", icon: "card", group: "Finance",
    summary: "Accept fees online through UPI, Razorpay or another payment gateway.",
    bullets: ["UPI / Razorpay / other gateways", "Payment gateway setup", "Transaction reconciliation"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Online today", value: "₹ 62,000" }, { label: "UPI", value: "58%" }, { label: "Cards & netbanking", value: "42%" }, { label: "Unreconciled", value: "0" }],
      title: "Gateway settings", columns: ["Gateway", "Mode", "Settlement", "Status"],
      rows: [["UPI (QR / Intent)", "Live", "T+1", "Not connected"], ["Razorpay", "Test", "T+2", "Not connected"], ["Other gateway", "—", "—", "Not connected"]],
      actions: ["Connect gateway", "Reconcile transactions", "Download settlement report"],
    },
  },
  receipts: {
    key: "receipts", title: "Fee Receipt Generation", href: "/receipts", color: "#7c3aed", icon: "receipt", group: "Finance",
    summary: "Automatic, professionally formatted fee receipts (PDF) recorded against each payment.",
    bullets: ["Automatic receipt after fee payment", "Professional receipt template", "Downloadable PDF", "Logo, signature, receipt number"],
    roles: ["ADMIN", "STUDENT"],
    preview: {
      stats: [{ label: "Receipts this month", value: "214" }, { label: "Last receipt no.", value: "SW/DEMO/0001" }, { label: "Template", value: "Standard" }, { label: "PDF downloads", value: "198" }],
      title: "Recent receipts", columns: ["Receipt no.", "Student", "Fee type", "Date", "Amount"],
      rows: [["SW/DEMO/0001", "Sample Student A", "Tuition Fee", "05 Oct 2026", "₹ 18,000"], ["SW/DEMO/0002", "Sample Student C", "Tuition Fee", "04 Oct 2026", "₹ 16,000"]],
      actions: ["Generate receipt", "Download PDF"],
    },
  },
  parent_portal: {
    key: "parent_portal", title: "Parent Portal", href: "/parent", color: "#f97316", icon: "parent", group: "People",
    summary: "A dedicated login for parents to follow their child's progress.",
    bullets: ["Child profile", "Attendance, marks & results", "Timetable & announcements", "Fees & transport"],
    roles: ["ADMIN"], kind: "parent",
    contact: "Contact Swan Digital Solutions to activate Parent Portal.",
    preview: {
      stats: [{ label: "Linked children", value: "2" }, { label: "Attendance", value: "94%" }, { label: "Latest result", value: "86%" }, { label: "Fees due", value: "₹ 6,500" }],
      title: "My children", columns: ["Child", "Class", "Attendance", "Latest result", "Bus"],
      rows: [["Sample Student A", "10-A", "96%", "88% · A", "SW-03"], ["Sample Student A2", "7-B", "92%", "84% · A", "SW-03"]],
      actions: ["View attendance", "View results", "Pay fees"],
    },
  },
  non_teaching_staff: {
    key: "non_teaching_staff", title: "Non-Teaching Staff Management", href: "/non-teaching", color: "#0d9488", icon: "staff", group: "People",
    summary: "Manage office staff, cleaners, watchmen, helpers and maintenance staff.",
    bullets: ["Office staff, cleaner, watchman, helper, maintenance", "Duty roster & attendance", "Leave and records"],
    roles: ["ADMIN"], kind: "nonteaching",
    contact: "Contact Swan Digital Solutions to unlock this feature.",
    preview: {
      stats: [{ label: "Non-teaching staff", value: "18" }, { label: "Present today", value: "16" }, { label: "On leave", value: "1" }, { label: "Departments", value: "5" }],
      title: "Staff directory", columns: ["Name", "Role", "Shift", "Phone", "Status"],
      rows: [["Murugan S", "Watchman", "Night", "98xxxxxx10", "Active"], ["Kalyani R", "Office Staff", "Day", "97xxxxxx45", "Active"], ["Selvi P", "Cleaner", "Day", "96xxxxxx22", "Active"], ["Raja K", "Maintenance", "Day", "99xxxxxx31", "Active"]],
      actions: ["Add staff", "Duty roster", "Mark attendance"],
    },
  },
  advanced_transport: {
    key: "advanced_transport", title: "Advanced Transport & Live GPS", href: "/transport/advanced", color: "#0891b2", icon: "route", group: "Transport",
    summary: "Route optimisation, driver mobile application and route tracking on top of basic transport.",
    bullets: ["Route tracking & optimisation", "Driver mobile application", "Trip history & alerts"],
    roles: ["ADMIN"], heading: "Advanced Transport & Live GPS is not active under your current plan.",
    variants: {
      "driver-app": {
        title: "Driver Mobile App", href: "/transport/driver-app", icon: "bus",
        summary: "A mobile app for drivers: trip start/stop, student boarding list and route guidance.",
        bullets: ["Driver login & assigned trips", "Student boarding list", "Trip start / end reports"],
        preview: { stats: [{ label: "Drivers with app", value: "—" }, { label: "Trips logged", value: "—" }, { label: "App version", value: "—" }, { label: "Alerts", value: "—" }], title: "Driver app roster", columns: ["Driver", "Bus", "App status", "Last trip"], rows: [["Sample Driver A", "SW-DEMO-1", "Not installed", "—"], ["Sample Driver B", "SW-DEMO-2", "Not installed", "—"]], actions: ["Invite driver", "Download app link", "Trip report"] },
      },
    },
    preview: {
      stats: [{ label: "Trips today", value: "24" }, { label: "On time", value: "92%" }, { label: "Avg. route time", value: "38 min" }, { label: "Alerts", value: "2" }],
      title: "Route tracking", columns: ["Bus", "Route", "Driver app", "Last trip", "On time"],
      rows: [["SW-01", "Anna Nagar – School", "Connected", "07:12 → 08:21", "Yes"], ["SW-02", "T Nagar – School", "Connected", "07:05 → 08:30", "Delayed"]],
      actions: ["Optimise routes", "Invite driver app", "Trip history"],
    },
  },
  gps: {
    key: "gps", title: "Live GPS Tracking", href: "/transport/gps", color: "#059669", icon: "map", group: "Transport", kind: "map",
    summary: "Real-time bus tracking for school and parents.",
    bullets: ["Live GPS & real-time bus tracking", "Parent live tracking", "ETA and geofence alerts"],
    roles: ["ADMIN"], heading: "Advanced Transport & Live GPS is not active under your current plan.",
    variants: {
      tracking: {
        title: "Real-Time Tracking", href: "/transport/tracking", icon: "map", kind: "map",
        summary: "See every school bus on the map in real time, with speed, ETA and trip history.",
        bullets: ["Live bus positions", "ETA to school & stops", "Trip history & replay"],
        preview: { stats: [{ label: "Buses online", value: "—" }, { label: "Average speed", value: "—" }, { label: "Next ETA", value: "—" }, { label: "Geofence alerts", value: "—" }], title: "Fleet status", columns: ["Bus", "Position", "Speed", "ETA school"], rows: [["SW-DEMO-1", "— (no live location)", "—", "—"], ["SW-DEMO-2", "— (no live location)", "—", "—"]], actions: ["Open live map", "Trip replay", "Set geofence"] },
      },
      "parent-tracking": {
        title: "Parent Live Tracking", href: "/transport/parent-tracking", icon: "parent", kind: "map",
        summary: "Parents follow their child's bus live and get arrival alerts.",
        bullets: ["Live bus view for parents", "Pick-up / drop alerts", "Works with the Parent Portal"],
        preview: { stats: [{ label: "Parents subscribed", value: "—" }, { label: "Alerts sent", value: "—" }, { label: "Stops covered", value: "—" }, { label: "Requires", value: "Parent Portal" }], title: "Parent tracking access", columns: ["Parent", "Child's bus", "Stop", "Alert"], rows: [["Sample Parent A", "SW-DEMO-1", "Stop 2", "Not enabled"], ["Sample Parent B", "SW-DEMO-2", "Stop 1", "Not enabled"]], actions: ["Enable for parents", "Alert settings"] },
      },
    },
    preview: {
      stats: [{ label: "Buses live", value: "—" }, { label: "Avg. speed", value: "—" }, { label: "ETA school", value: "—" }, { label: "Geofence alerts", value: "—" }],
      title: "Live map (illustration only — no live location)", columns: ["Bus", "Location", "Speed", "ETA school"],
      rows: [["SW-DEMO-1", "— (available after activation)", "—", "—"], ["SW-DEMO-2", "— (available after activation)", "—", "—"]],
      actions: ["Open live map", "Share with parents"],
    },
  },
  notifications: {
    key: "notifications", title: "SMS / Email / WhatsApp Notifications", href: "/notifications", color: "#10b981", icon: "bell", group: "Communication",
    summary: "Automatic attendance, fee, result and leave notifications over SMS, email and WhatsApp.",
    bullets: ["Attendance notifications", "Fee reminders", "Result notifications", "Leave notifications", "WhatsApp · SMS · Email"],
    roles: ["ADMIN"],
    variants: {
      sms: { title: "SMS Notifications", href: "/notifications/sms", icon: "bell", summary: "Automatic SMS to parents and staff through a DLT-registered sender ID.", bullets: ["Sender ID & DLT templates", "Attendance / fee / result SMS", "Delivery reports"],
        preview: { stats: [{ label: "SMS credits", value: "—" }, { label: "Sender ID", value: "—" }, { label: "Delivered", value: "—" }, { label: "Failed", value: "—" }], title: "SMS templates", columns: ["Template", "Trigger", "Status"], rows: [["Absence alert", "Student absent", "Not active"], ["Fee reminder", "3 days before due", "Not active"]], actions: ["Add template", "Buy credits", "Send test SMS"] } },
      email: { title: "Email Notifications", href: "/notifications/email", icon: "bell", summary: "Automatic email for results, circulars, leave decisions and receipts.", bullets: ["Branded email templates", "Result & circular emails", "Delivery tracking"],
        preview: { stats: [{ label: "Sending domain", value: "—" }, { label: "Emails sent", value: "—" }, { label: "Bounced", value: "—" }, { label: "Templates", value: "—" }], title: "Email templates", columns: ["Template", "Audience", "Status"], rows: [["Result published", "Parents", "Not active"], ["Leave approved", "Staff", "Not active"]], actions: ["Verify domain", "Add template", "Send test email"] } },
      whatsapp: { title: "WhatsApp Notifications", href: "/notifications/whatsapp", icon: "bell", summary: "WhatsApp Business messages for attendance, fees and announcements.", bullets: ["WhatsApp Business number", "Approved message templates", "Two-way parent replies"],
        preview: { stats: [{ label: "Business number", value: "—" }, { label: "Messages", value: "—" }, { label: "Templates approved", value: "—" }, { label: "Opt-ins", value: "—" }], title: "WhatsApp templates", columns: ["Template", "Category", "Status"], rows: [["Attendance alert", "Utility", "Not active"], ["Fee reminder", "Utility", "Not active"]], actions: ["Connect number", "Submit template", "Send test message"] } },
    },
    preview: {
      stats: [{ label: "Messages this month", value: "3,420" }, { label: "Delivery rate", value: "98%" }, { label: "WhatsApp", value: "Off" }, { label: "SMS credits", value: "—" }],
      title: "Automation rules", columns: ["Trigger", "Channel", "Audience", "Enabled"],
      rows: [["Student absent", "WhatsApp + SMS", "Parent", "Off"], ["Fee due in 3 days", "SMS + Email", "Parent", "Off"], ["Result published", "Email", "Parent", "Off"], ["Leave approved", "Email", "Staff", "Off"]],
      actions: ["Create rule", "Connect WhatsApp", "Send test message"],
    },
  },
  biometric: {
    key: "biometric", title: "Biometric/RFID Attendance Integration", href: "/biometric", color: "#6366f1", icon: "fingerprint", group: "Campus",
    summary: "Automatic attendance from biometric devices and RFID cards.",
    bullets: ["Fingerprint / face devices", "RFID cards for students & staff", "Automatic sync to attendance"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Devices", value: "3" }, { label: "Punches today", value: "612" }, { label: "Last sync", value: "2 min ago" }, { label: "Unmapped cards", value: "0" }],
      title: "Devices", columns: ["Device", "Location", "Type", "Status"],
      rows: [["Main Gate", "Entrance", "Fingerprint", "Not connected"], ["Staff Room", "Block A", "RFID", "Not connected"], ["Bus Bay", "Ground", "RFID", "Not connected"]],
      actions: ["Add device", "Map cards", "Sync now"],
    },
  },
  payroll: {
    key: "payroll", title: "Payroll", href: "/payroll", color: "#d97706", icon: "banknote", group: "Finance",
    summary: "Salary structure, monthly payroll processing and payslips.",
    bullets: ["Salary structure & components", "Monthly payroll run", "Payslips & statutory reports"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Monthly payroll", value: "₹ 9,84,000" }, { label: "Employees", value: "34" }, { label: "Deductions", value: "₹ 96,400" }, { label: "Payslips", value: "34" }],
      title: "Payroll run – October 2026", columns: ["Employee", "Designation", "Gross", "Deductions", "Net"],
      rows: [["Sample Teacher A", "Senior Teacher", "₹ 52,000", "₹ 4,800", "₹ 47,200"], ["Sample Teacher B", "Teacher", "₹ 41,000", "₹ 3,900", "₹ 37,100"]],
      actions: ["Run payroll", "Generate payslips", "Export bank file"],
    },
  },
  library: {
    key: "library", title: "Library Management", href: "/library", color: "#8b5cf6", icon: "library", group: "Campus",
    summary: "Book catalogue, issue/return tracking, fines and reading history.",
    bullets: ["Catalogue & barcodes", "Issue / return", "Fines & reservations"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Books", value: "4,820" }, { label: "Issued", value: "312" }, { label: "Overdue", value: "18" }, { label: "Members", value: "540" }],
      title: "Recent issues", columns: ["Book", "Member", "Issued", "Due", "Status"],
      rows: [["Wings of Fire", "Sample Student A (10-A)", "02 Oct", "16 Oct", "Issued"], ["Discovery of India", "Sample Student E (9-B)", "28 Sep", "12 Oct", "Overdue"]],
      actions: ["Add book", "Issue book", "Return book"],
    },
  },
  inventory: {
    key: "inventory", title: "Inventory Management", href: "/inventory", color: "#f59e0b", icon: "boxes", group: "Campus",
    summary: "School assets and stock — uniforms, stationery, lab and sports equipment.",
    bullets: ["Item catalogue & stock levels", "Purchase & issue records", "Low-stock alerts"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Items", value: "612" }, { label: "Low stock", value: "14" }, { label: "Stock value", value: "₹ 6,20,000" }, { label: "Issued this month", value: "88" }],
      title: "Stock", columns: ["Item", "Category", "In stock", "Reorder level", "Status"],
      rows: [["Whiteboard markers", "Stationery", "120", "50", "OK"], ["Football", "Sports", "6", "10", "Low"], ["Lab beakers", "Laboratory", "42", "20", "OK"]],
      actions: ["Add item", "Issue stock", "Purchase order"],
    },
  },
  hostel: {
    key: "hostel", title: "Hostel Management", href: "/hostel", color: "#e11d48", icon: "building", group: "Campus",
    summary: "Hostel rooms, allocation, mess and boarder attendance.",
    bullets: ["Rooms & bed allocation", "Mess & visitors", "Boarder attendance & fees"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Rooms", value: "48" }, { label: "Boarders", value: "132" }, { label: "Vacant beds", value: "12" }, { label: "Visitors today", value: "7" }],
      title: "Room allocation", columns: ["Room", "Block", "Beds", "Occupied", "Warden"],
      rows: [["A-101", "Boys Block A", "4", "4", "R. Kumar"], ["B-204", "Girls Block B", "3", "2", "S. Devi"]],
      actions: ["Allocate room", "Mess menu", "Visitor log"],
    },
  },
  custom_integrations: {
    key: "custom_integrations", title: "School-Specific Custom Requirements", href: "/custom", color: "#0ea5e9", icon: "puzzle", group: "Custom", custom: true,
    summary: "Custom workflows, reports, fee structures, receipt designs, special and hardware integrations.",
    bullets: ["Custom workflows & reports", "Custom fee structure & receipt design", "Special integrations", "Hardware integrations"],
    roles: ["ADMIN"],
    preview: {
      stats: [{ label: "Custom workflows", value: "—" }, { label: "Custom reports", value: "—" }, { label: "Integrations", value: "—" }, { label: "Quote", value: "On request" }],
      title: "What we can build for your school", columns: ["Requirement", "Example", "Delivery"],
      rows: [["Custom workflow", "Admission approval chain", "Quoted"], ["Custom report", "Board-format progress card", "Quoted"], ["Integration", "Tally / ERP / smart boards", "Quoted"]],
      actions: ["Describe requirement"],
    },
  },
};

export const LOCKED_LIST = Object.values(LOCKED);
export const isLockedKey = (k: string): k is LockedFeature => k in LOCKED;
export const isDefaultFeature = (k: string): k is DefaultFeature => (DEFAULT_FEATURES as readonly string[]).includes(k);
