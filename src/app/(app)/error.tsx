"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

/** Friendly page-level error. Never shows the error message, digest, stack, SQL or paths. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page error", error.digest ?? ""); // details stay in the server log
  }, [error]);
  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="card pop bg-white p-8 text-center" role="alert">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><TriangleAlert size={28} /></span>
        <h1 className="mt-4 text-xl font-extrabold">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Something went wrong while loading your data. Please try again. If it keeps happening, contact your school admin or Swan Digital Solutions.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={() => reset()}><RefreshCw size={16} /> Try again</button>
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
