import { headers } from "next/headers";
import { CheckCircle2, CloudCog, Database, DatabaseBackup, Lock, Rocket, ShieldCheck, TriangleAlert } from "lucide-react";
import { db, rawDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUnlockedAddons } from "@/lib/features-server";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Database & Deployment" };
export const dynamic = "force-dynamic";

function Row({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--line)] py-2.5 text-sm last:border-0">
      {ok === undefined ? null : ok ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" /> : <TriangleAlert size={16} className="shrink-0 text-amber-500" />}
      <span className="w-44 shrink-0 font-semibold text-[color:var(--ink-soft)]">{label}</span>
      <span className="min-w-0 flex-1 break-words font-semibold text-[color:var(--ink-strong)]">{value}</span>
    </div>
  );
}

export default async function SystemPage() {
  await requireUser(["ADMIN"]);
  const unlocked = [...(await getUnlockedAddons())];
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "";

  const t0 = performance.now();
  let dbOk = true, version = "", sslOn = false, sizeMb = 0;
  try {
    const [v, ssl, size] = await Promise.all([
      rawDb.$queryRaw<{ v: string }[]>`SHOW server_version`,
      rawDb.$queryRaw<{ ssl: boolean }[]>`SELECT COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS ssl`,
      rawDb.$queryRaw<{ s: bigint }[]>`SELECT pg_database_size(current_database()) AS s`,
    ]);
    version = v[0]?.v ?? "";
    sslOn = !!ssl[0]?.ssl;
    sizeMb = Math.round((Number(size[0]?.s ?? 0) / 1048576) * 10) / 10;
  } catch {
    dbOk = false;
  }
  const latency = Math.round(performance.now() - t0);

  const counts = dbOk
    ? await Promise.all([db.user.count(), db.student.count(), db.staff.count(), db.studentAttendance.count(), db.mark.count(), db.announcement.count()])
    : [0, 0, 0, 0, 0, 0];

  let dbHost = "unknown";
  try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch {}
  const isRds = dbHost.endsWith(".rds.amazonaws.com");
  const region = isRds ? dbHost.split(".").slice(-4, -3)[0] : null;
  const onVercel = !!process.env.VERCEL;
  const secretOk = !!process.env.AUTH_SECRET && !process.env.AUTH_SECRET.includes("change-me");
  const retention = process.env.DB_BACKUP_RETENTION_DAYS;

  return (
    <div>
      <PageHeader title="Database & Deployment" subtitle="Live health of your AWS database, Vercel deployment, SSL/HTTPS and configuration" icon="system" color="linear-gradient(135deg,#6366f1,#06b6d4)" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white"><Database size={20} /></span>
            <h2 className="flex-1 text-lg font-extrabold">Database (AWS)</h2>
            {dbOk ? <Badge color="#059669">Healthy</Badge> : <Badge color="#e11d48">Unreachable</Badge>}
          </div>
          <Row label="Provider" value={isRds ? `Amazon RDS · PostgreSQL${region ? ` · ${region}` : ""}` : "PostgreSQL (local / non-RDS host)"} ok={isRds} />
          <Row label="Host" value={dbHost} />
          <Row label="Server version" value={version ? `PostgreSQL ${version}` : "—"} ok={dbOk} />
          <Row label="Query latency" value={`${latency} ms`} ok={latency < 400} />
          <Row label="Encrypted connection" value={sslOn ? "TLS/SSL active" : "Not encrypted (use sslmode=require on RDS)"} ok={sslOn} />
          <Row label="Database size" value={`${sizeMb} MB`} />
          <div className="mt-3 rounded-2xl bg-sky-50 p-3 text-xs text-sky-700">
            <b>Live record counts:</b> {counts[0]} users · {counts[1]} students · {counts[2]} staff · {counts[3]} attendance records · {counts[4]} marks · {counts[5]} announcements
          </div>
        </div>

        <div className="card card-pad">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><DatabaseBackup size={20} /></span>
            <h2 className="flex-1 text-lg font-extrabold">Backups & monitoring</h2>
          </div>
          <Row label="Automatic backups" value={isRds ? "Managed by AWS RDS automated backups" : "Enabled on AWS RDS in production"} />
          <Row label="Retention period" value={retention ? `${retention} days (configured in RDS)` : "Set in your RDS instance"} />
          <Row label="Point-in-time recovery" value="Available through RDS" />
          <Row label="Monitoring" value="Amazon CloudWatch metrics & alarms" />
          <Row label="This page" value="Live connectivity, latency and encryption checks run on every load" />
          <p className="mt-3 text-xs text-[color:var(--ink-soft)]">Backup schedules and alarms live in your AWS account and are set up by Swan Digital Solutions during implementation.</p>
        </div>

        <div className="card card-pad">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white"><Rocket size={20} /></span>
            <h2 className="flex-1 text-lg font-extrabold">Deployment</h2>
            {onVercel ? <Badge color="#059669">Production</Badge> : <Badge color="#d97706">Local / dev</Badge>}
          </div>
          <Row label="Platform" value={onVercel ? `Vercel · ${process.env.VERCEL_ENV ?? "production"}` : "Local development server"} ok={onVercel} />
          <Row label="Region" value={process.env.VERCEL_REGION ?? "—"} />
          <Row label="Domain" value={host} />
          <Row label="Runtime" value={`Node.js ${process.version} · Next.js`} />
          <Row label="Git commit" value={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "—"} />
        </div>

        <div className="card card-pad">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white"><ShieldCheck size={20} /></span>
            <h2 className="flex-1 text-lg font-extrabold">SSL / HTTPS & configuration</h2>
          </div>
          <Row label="HTTPS" value={proto === "https" ? "Active — this page is served over HTTPS" : "Not active (local http). Vercel provides SSL automatically."} ok={proto === "https"} />
          <Row label="Secure session cookie" value={process.env.NODE_ENV === "production" ? "Secure + HttpOnly" : "HttpOnly (Secure in production)"} ok />
          <Row label="DATABASE_URL" value={process.env.DATABASE_URL ? "Set" : "Missing"} ok={!!process.env.DATABASE_URL} />
          <Row label="AUTH_SECRET" value={secretOk ? "Set (custom secret)" : "Using a development secret — change it"} ok={secretOk} />
          <Row label="Add-ons unlocked" value={unlocked.length ? unlocked.join(", ") : "None (Default Package)"} />
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700"><CloudCog size={14} /> Environment variables are edited in Vercel → Project → Settings → Environment Variables.</div>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1 text-xs text-[color:var(--ink-soft)]"><Lock size={12} /> Only administrators can see this page.</p>
    </div>
  );
}
