import { redirect } from "next/navigation";
import { CalendarCheck, Award, Megaphone, Clock, BarChart3, Palette } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { Logo } from "@/components/logo";
import { SWAN } from "@/lib/features";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const FEATURES = [
  { icon: CalendarCheck, label: "Attendance", color: "#3b82f6" },
  { icon: Award, label: "Marks & Results", color: "#f97316" },
  { icon: Clock, label: "Timetable", color: "#8b5cf6" },
  { icon: Megaphone, label: "Announcements", color: "#10b981" },
  { icon: BarChart3, label: "Reports", color: "#ec4899" },
  { icon: Palette, label: "School Branding", color: "#06b6d4" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  if (await getUser()) redirect("/dashboard");
  const school = await getSchool();
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO !== "false";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* colourful hero */}
      <section className="sidebar relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -left-16 bottom-10 h-64 w-64 rounded-full bg-amber-300/20" />
        <div className="absolute right-32 bottom-32 h-24 w-24 rounded-full bg-cyan-300/25" />
        <div className="relative flex items-center gap-4">
          <Logo src={school.logoData} size={64} />
          <div>
            <div className="text-2xl font-extrabold text-white">{school.name}</div>
            <div className="text-sm text-white/80">by {SWAN.name}</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-5xl font-extrabold leading-tight !text-white">
            One School.
            <br />
            One Complete Solution.
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/85">{school.tagline}</p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div key={f.label} className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow" style={{ background: f.color }}>
                  <f.icon size={18} />
                </span>
                <div className="mt-2 text-xs font-bold text-white">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-sm font-semibold text-white/80">{SWAN.tagline}</div>
      </section>

      {/* form */}
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="card w-full max-w-md bg-white p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo src={school.logoData} size={48} className="ring-1 ring-[color:var(--line)]" />
            <div className="text-lg font-extrabold">{school.name}</div>
          </div>
          <h2 className="text-2xl font-extrabold">Welcome back 👋</h2>
          <p className="mb-6 mt-1 text-sm text-[color:var(--ink-soft)]">Choose your portal and sign in to continue.</p>
          {expired && <div role="alert" className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">Your session has expired. Please sign in again.</div>}
          <LoginForm website={SWAN.website} showDemo={showDemo} />
        </div>
      </section>
    </div>
  );
}
