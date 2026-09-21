import Link from "next/link";
import { CheckCircle2, ExternalLink, Globe, Lock, Send, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { getUnlockedAddons } from "@/lib/features-server";
import { LOCKED, LOCKED_LIST, PLAN_NAME, SWAN } from "@/lib/features";
import { ICONS } from "@/components/icons";
import { PageHeader, Badge } from "@/components/ui";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { requestUnlockAction } from "@/actions/requests";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Swan Digital Solutions" };

const STATUS_COLOR = { PENDING: "#2563eb", CONTACTED: "#d97706", APPROVED: "#059669", REJECTED: "#e11d48" } as const;

export default async function SwanDigitalPage({ searchParams }: { searchParams: Promise<{ feature?: string }> }) {
  const user = await requireUser(["ADMIN"]);
  const { feature } = await searchParams;
  const [school, unlocked, requests] = await Promise.all([
    getSchool(),
    getUnlockedAddons(),
    db.featureUnlockRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const options = LOCKED_LIST.filter((a) => !unlocked.has(a.key));

  return (
    <div>
      <PageHeader
        title="Swan Digital Solutions"
        subtitle="Your plan, add-on features and unlock requests"
        icon="swan"
        actions={<a href={SWAN.website} target="_blank" rel="noreferrer" className="btn btn-ghost"><Globe size={16} /> swandigitalsolutions.com <ExternalLink size={14} /></a>}
      />

      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-6" style={{ background: "var(--grad)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/swan-logo.png" alt="Swan Digital Solutions" className="h-16 rounded-2xl bg-white p-2 shadow-lg" />
          <div className="flex-1 text-white">
            <div className="text-xl font-extrabold text-white">{SWAN.name}</div>
            <div className="text-sm text-white/85">Websites, Software &amp; Digital Growth · {SWAN.tagline}</div>
          </div>
          <div className="rounded-2xl bg-white/20 px-5 py-3 text-white backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Current plan</div>
            <div className="text-lg font-extrabold">{PLAN_NAME}</div>
          </div>
        </div>
        <div className="grid gap-px bg-[color:var(--line)] sm:grid-cols-3">
          {[
            ["Admin, Teacher & Student portals", "Included"],
            ["Attendance, Marks, Results, Timetable, Transport, Leave, Reports", "Included"],
            ["AWS database · Vercel deployment · School branding", "Included"],
          ].map(([t, s]) => (
            <div key={t} className="flex items-start gap-2 bg-white p-4 text-sm">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
              <div><div className="font-semibold text-[color:var(--ink-strong)]">{t}</div><div className="text-xs text-emerald-600">{s}</div></div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-extrabold">Additional features</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LOCKED_LIST.map((a) => {
          const Icon = ICONS[a.icon] ?? ICONS.lock;
          const active = unlocked.has(a.key);
          return (
            <Link key={a.key} href={a.href} className="card card-pad transition hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: a.color }}><Icon size={22} /></span>
                <div className="flex-1 font-bold text-[color:var(--ink-strong)]">{a.title}</div>
                {active ? <Badge color="#059669">Active</Badge> : <Badge color="#d97706"><Lock size={11} /> Locked</Badge>}
              </div>
              <p className="mt-3 text-sm text-[color:var(--ink-soft)]">{a.summary}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]" id="request">
        <div className="card card-pad">
          <div className="mb-1 flex items-center gap-2 text-lg font-extrabold"><Send size={18} className="text-[color:var(--brand)]" /> Request Unlock</div>
          <p className="mb-4 text-sm text-[color:var(--ink-soft)]">
            Unlocking a feature needs an extra subscription. Send the request and {SWAN.name} will contact you.
          </p>
          <ActionForm action={requestUnlockAction} resetOnSuccess closeOnSuccess={false}>
            <Field label="School name" name="school"><input id="school" className="input" value={school.name} readOnly /></Field>
            <Field label="Feature requested" name="feature">
              <select id="feature" name="feature" className="select" defaultValue={feature && LOCKED[feature as keyof typeof LOCKED] ? feature : ""} required>
                <option value="" disabled>Select a feature…</option>
                {options.map((a) => <option key={a.key} value={a.key}>{a.title}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Administrator name" name="administratorName"><input id="administratorName" name="administratorName" className="input" defaultValue={user.name} required /></Field>
              <Field label="Phone" name="phone"><input id="phone" name="phone" className="input" defaultValue={user.phone ?? ""} required /></Field>
            </div>
            <Field label="Email" name="email"><input id="email" name="email" type="email" className="input" defaultValue={user.email} required /></Field>
            <Field label="Message" name="message"><textarea id="message" name="message" className="textarea" placeholder="e.g. We would like to activate Parent Portal for our school." /></Field>
            <SubmitButton><Send size={16} /> Submit request</SubmitButton>
          </ActionForm>
        </div>

        <div className="card card-pad">
          <div className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Sparkles size={18} className="text-[color:var(--brand2)]" /> Your requests</div>
          {requests.length === 0 ? <p className="text-sm text-[color:var(--ink-soft)]">No requests yet.</p> : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[color:var(--ink-strong)]">{LOCKED[r.requestedFeature as keyof typeof LOCKED]?.title ?? r.requestedFeature}</div>
                    <div className="text-xs text-[color:var(--ink-soft)]">{fmtDateTime(r.createdAt)} · {r.administratorName}</div>
                  </div>
                  <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
