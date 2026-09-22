"use client";

import { useActionState, useState } from "react";
import { GraduationCap, Lock, LogIn, ShieldCheck, UserRound, HeartHandshake, ExternalLink, Loader2 } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Feedback } from "@/components/form";

const ROLES = [
  { key: "ADMIN", label: "Admin", icon: ShieldCheck, email: "admin@jspublicschool.edu", color: "#0284c7" },
  { key: "TEACHER", label: "Teacher", icon: UserRound, email: "teacher1@jspublicschool.edu", color: "#059669" },
  { key: "STUDENT", label: "Student", icon: GraduationCap, email: "student1@jspublicschool.edu", color: "#7c3aed" },
  { key: "PARENT", label: "Parent", icon: HeartHandshake, email: "", color: "#f97316" },
] as const;

export function LoginForm({ website, showDemo }: { website: string; showDemo: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("ADMIN");
  const [email, setEmail] = useState(showDemo ? ROLES[0].email : "");
  const [password, setPassword] = useState(showDemo ? "Swan@123" : "");
  const active = ROLES.find((r) => r.key === role)!;

  function pick(k: (typeof ROLES)[number]["key"]) {
    setRole(k);
    const r = ROLES.find((x) => x.key === k)!;
    if (showDemo && r.email) {
      setEmail(r.email);
      setPassword("Swan@123");
    }
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-4 gap-2">
        {ROLES.map((r) => {
          const Icon = r.icon;
          const on = r.key === role;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => pick(r.key)}
              className="relative flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-xs font-bold transition"
              style={{
                borderColor: on ? r.color : "var(--line)",
                background: on ? `color-mix(in srgb, ${r.color} 10%, white)` : "#fff",
                color: on ? r.color : "var(--ink-soft)",
              }}
            >
              <Icon size={22} />
              {r.label}
              {r.key === "PARENT" && (
                <span className="absolute -right-1 -top-1 rounded-full bg-white p-1 shadow" style={{ color: r.color }}>
                  <Lock size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {role === "PARENT" ? (
        <div className="pop rounded-2xl bg-orange-50 p-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg">
            <HeartHandshake size={28} />
          </div>
          <h3 className="text-base font-extrabold text-orange-700">Parent Portal is not active under your current plan</h3>
          <p className="mt-2 text-sm text-orange-700/90">
            Parent Portal is an additional subscription feature (child attendance, marks, results, timetable, announcements, fees and transport). To unlock it, your school needs an extra subscription — contact Swan Digital Solutions.
          </p>
          <a href={website} target="_blank" rel="noreferrer" className="btn btn-primary mt-4">
            <ExternalLink size={16} /> Visit Swan Digital Solutions
          </a>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.in" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Feedback state={state} />
          <button className="btn btn-primary w-full py-3 text-base" disabled={pending} style={{ background: `linear-gradient(135deg, ${active.color}, var(--brand2))` }}>
            {pending ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />} Sign in as {active.label}
          </button>
          {showDemo && (
            <p className="text-center text-xs text-[color:var(--ink-soft)]">
              Demo accounts are pre-filled · password <b>Swan@123</b>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
