import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card pop w-full max-w-md bg-white p-8 text-center">
        <Logo size={64} className="mx-auto ring-1 ring-[color:var(--line)]" />
        <div className="mt-4 text-5xl font-extrabold" style={{ background: "var(--grad)", WebkitBackgroundClip: "text", color: "transparent" }}>404</div>
        <h1 className="mt-2 text-xl font-extrabold">This page isn&apos;t available</h1>
        <p className="mt-2 text-sm text-[color:var(--ink-soft)]">The page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
      </div>
    </div>
  );
}
