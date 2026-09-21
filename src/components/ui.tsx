import Link from "next/link";
import { ICONS } from "@/components/icons";
import { avatarColor, initials } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  icon = "dashboard",
  color,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  actions?: React.ReactNode;
}) {
  const Icon = ICONS[icon] ?? ICONS.dashboard;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: color ?? "var(--grad)" }}
      >
        <Icon size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="text-sm text-[color:var(--ink-soft)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, seed, size = 36, photo }: { name: string; seed?: string; size?: number; photo?: string | null }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(seed ?? name) }}
    >
      {initials(name)}
    </span>
  );
}

export function Badge({ children, color = "#7c3aed", bg }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span
      className="badge"
      style={{ color, background: bg ?? `color-mix(in srgb, ${color} 13%, white)` }}
    >
      {children}
    </span>
  );
}

export function Tile({
  label,
  value,
  sub,
  tone,
  icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone: "blue" | "orange" | "green" | "purple" | "teal" | "pink";
  icon?: string;
  href?: string;
}) {
  const Icon = icon ? ICONS[icon] : null;
  const body = (
    <div className={`tile tile-${tone} ${href ? "transition hover:-translate-y-0.5 hover:shadow-xl" : ""}`}>
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-white/85">{label}</div>
          <div className="mt-1 text-3xl font-extrabold">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-white/85">{sub}</div>}
        </div>
        {Icon && (
          <span className="rounded-xl bg-white/25 p-2">
            <Icon size={20} />
          </span>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-[20px] focus-visible:ring-4 focus-visible:ring-[color:var(--brand-mid)]" data-tile-link>{body}</Link> : body;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-white/60 px-6 py-12 text-center">
      <div className="text-base font-bold text-[color:var(--ink-strong)]">{title}</div>
      {hint && <p className="mt-1 max-w-md text-sm text-[color:var(--ink-soft)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  className = "btn btn-primary",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function StatusPill({ ok, on = "Active", off = "Inactive" }: { ok: boolean; on?: string; off?: string }) {
  return ok ? <Badge color="#059669">{on}</Badge> : <Badge color="#e11d48">{off}</Badge>;
}
