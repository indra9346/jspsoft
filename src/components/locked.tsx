/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, Lock, Send, Sparkles } from "lucide-react";
import { LOCKED, SWAN, type LockedFeature, type Preview } from "@/lib/features";
import { isFeatureEnabled } from "@/lib/features-server";
import { getSchool } from "@/lib/school";
import { requireUser } from "@/lib/auth";
import { ICONS } from "@/components/icons";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/ui";
import { DemoBadge, MapIllustration, NonTeachingPreview, ParentPreview } from "@/components/locked-previews";

/**
 * "Not active under your current plan" screen for an add-on (or one of its sub-pages).
 * The preview is read-only demo content: no data is read or written, every control is disabled.
 */
export async function LockedFeature({ feature, variant }: { feature: LockedFeature; variant?: string }) {
  const user = await requireUser();
  const m = LOCKED[feature];
  if (!["ADMIN", "TEACHER"].includes(user.role)) redirect("/dashboard");
  const v = variant ? m.variants?.[variant] : undefined;
  const page = v ? { title: v.title, icon: v.icon ?? m.icon, summary: v.summary, bullets: v.bullets, preview: v.preview, kind: v.kind } : { title: m.title, icon: m.icon, summary: m.summary, bullets: m.bullets, preview: m.preview, kind: m.kind };
  const Icon = ICONS[page.icon] ?? ICONS.lock;
  const isAdmin = user.role === "ADMIN";
  const active = await isFeatureEnabled(feature);
  const school = await getSchool();
  const tabs = m.variants ? [{ label: m.title, href: m.href }, ...Object.values(m.variants).map((x) => ({ label: x.title, href: x.href }))] : [];

  if (active) {
    return (
      <div>
        <PageHeader title={page.title} subtitle="Add-on feature · subscription active" icon={page.icon} color={m.color} />
        <div className="card card-pad mx-auto max-w-xl text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h2 className="mt-3 text-xl font-extrabold">{page.title} is unlocked for your school</h2>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Your subscription is active. {SWAN.name} will finish configuring this module — contact them if it is not ready yet.</p>
          <a href={SWAN.website} target="_blank" rel="noreferrer" className="btn btn-primary mt-5"><ExternalLink size={16} /> Contact {SWAN.name}</a>
        </div>
      </div>
    );
  }

  const heading = m.custom ? "This feature can be customized according to your school's requirements." : (m.heading ?? `${page.title} is not active under your current plan.`);
  const sub = m.custom ? "Tell us what your school needs and Swan Digital Solutions will prepare a custom quote." : "This feature is available as an additional subscription.";
  const contact = m.custom ? "" : (m.contact ?? `Contact ${SWAN.name} to unlock ${page.title}.`);

  return (
    <div data-locked-feature={feature}>
      <PageHeader title={page.title} subtitle="Additional subscription feature · Not Active Under Your Plan" icon={page.icon} color={m.color} />

      {tabs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => <Link key={t.href} href={t.href} className={`btn btn-sm ${t.href === (v?.href ?? m.href) ? "btn-primary" : "btn-ghost"}`}>{t.label}</Link>)}
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${m.color} 14%, white), color-mix(in srgb, ${m.color} 4%, white))` }}>
          <div className="floaty relative flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-white shadow-xl" style={{ background: m.color }}>
            <Icon size={30} />
            <span className="absolute -bottom-2 -right-2 rounded-full bg-white p-1.5 text-[color:var(--brand)] shadow-md"><Lock size={14} /></span>
          </div>
          <div className="min-w-64 flex-1">
            <div className="mb-1 flex items-center gap-2"><Logo src={school.logoData} size={28} /><span className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">{school.name}</span></div>
            <h2 className="text-xl font-extrabold">{heading}</h2>
            <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{sub}</p>
            {contact && <p className="text-sm text-[color:var(--ink-soft)]">{contact}</p>}
            {m.custom && <p className="text-sm text-[color:var(--ink-soft)]">Custom workflows, reports, fee structures, receipt designs and integrations are quoted per school.</p>}
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">{page.summary}</p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {page.bullets.map((b) => <li key={b} className="flex items-center gap-1.5"><Sparkles size={13} style={{ color: m.color }} /> {b}</li>)}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            {isAdmin ? (
              <Link href={`/swan-digital?feature=${m.key}#request`} className="btn btn-primary"><Send size={16} /> {m.custom ? "Contact Swan Digital Solutions" : "Request Unlock"}</Link>
            ) : (
              <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Ask your school admin to request this feature.</span>
            )}
            <a href={SWAN.website} target="_blank" rel="noreferrer" className="btn btn-ghost"><ExternalLink size={16} /> swandigitalsolutions.com</a>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">
        <Lock size={12} /> Preview — actions are disabled until this feature is unlocked <DemoBadge />
      </div>
      <div className="pointer-events-none select-none" aria-disabled data-preview>
        {feature === "receipts" ? <ReceiptPreview />
          : page.kind === "parent" ? <ParentPreview />
          : page.kind === "nonteaching" ? <NonTeachingPreview />
          : <GenericPreview p={page.preview} map={page.kind === "map"} />}
      </div>
    </div>
  );
}

function GenericPreview({ p, map }: { p: Preview; map?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {p.stats.map((s, i) => (
          <div key={s.label} className={`tile tile-${(["blue", "green", "orange", "purple"] as const)[i % 4]} opacity-90`}>
            <div className="relative z-10"><div className="text-xs font-semibold uppercase tracking-wider text-white/85">{s.label}</div><div className="mt-1 text-2xl font-extrabold">{s.value}</div></div>
          </div>
        ))}
      </div>
      {map && <MapIllustration />}
      <div className="card table-wrap opacity-95">
        <div className="flex flex-wrap items-center gap-2 p-4 pb-0">
          <h3 className="section-title flex-1">{p.title}</h3>
          {p.actions.map((a) => <button key={a} disabled className="btn btn-soft btn-sm"><Lock size={12} /> {a}</button>)}
        </div>
        <table className="table mt-3">
          <thead><tr>{p.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{p.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

async function ReceiptPreview() {
  const school = await getSchool();
  const fields: [string, string][] = [
    ["Receipt No.", "SW/DEMO/0000 (sample)"], ["Payment Date", "DD MMM YYYY"], ["Student Name", "Sample Student"], ["Admission No.", "DEMO-0000"],
    ["Class / Section", "10 – A"], ["Academic Year", "2026-2027"], ["Fee Type", "Tuition Fee – Term 2"], ["Amount", "₹ 0.00"],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card relative overflow-hidden bg-white p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 whitespace-nowrap text-3xl font-extrabold tracking-widest text-rose-500/15 sm:text-5xl">PREVIEW — NOT A VALID RECEIPT</span>
        </div>
        <div className="relative mb-3 text-center"><span className="inline-block rounded-full bg-rose-50 px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-rose-600">PREVIEW — NOT A VALID RECEIPT</span></div>
        <div className="relative flex flex-wrap items-center gap-4 border-b-2 pb-4" style={{ borderColor: "var(--brand)" }}>
          <Logo src={school.logoData} size={64} className="ring-1 ring-[color:var(--line)]" />
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold">{school.name}</div>
            <div className="text-xs text-[color:var(--ink-soft)]">{school.address || "School address"} · {school.phone}</div>
          </div>
          <div className="rounded-xl px-3 py-1.5 text-sm font-extrabold text-white" style={{ background: "var(--grad)" }}>FEE RECEIPT</div>
        </div>
        <div className="relative mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-[color:var(--line)] pb-1.5 text-sm"><span className="font-semibold text-[color:var(--ink-soft)]">{k}</span><span className="text-right font-bold text-[color:var(--ink-strong)]">{v}</span></div>
          ))}
        </div>
        <div className="relative mt-10 flex flex-wrap items-end justify-between gap-4">
          <div className="text-xs text-[color:var(--ink-soft)]">This is a template preview. No payment has been recorded.</div>
          <div className="text-center">
            {school.signatureData ? <img src={school.signatureData} alt="Authorized signature" className="mx-auto h-10 object-contain" /> : <div className="h-10 w-40" />}
            <div className="border-t border-[color:var(--ink-soft)] pt-1 text-xs font-semibold text-[color:var(--ink-soft)]">Authorized Signature{school.principalName ? ` · ${school.principalName}` : ""}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button disabled className="btn btn-primary"><Lock size={14} /> Generate receipt</button>
        <button disabled className="btn btn-ghost"><Lock size={14} /> Download PDF</button>
      </div>
    </div>
  );
}
