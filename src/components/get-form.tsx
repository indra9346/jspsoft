"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Filter/search form that navigates with a client-side route change (no full page reload).
 * Empty values are dropped from the URL; `replace` keeps the browser history clean.
 */
export function GetForm({
  action,
  children,
  className,
  replace = true,
}: {
  action?: string;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams();
        for (const [k, v] of new FormData(e.currentTarget).entries()) if (typeof v === "string" && v !== "") p.set(k, v);
        const url = `${action ?? path}${p.size ? `?${p}` : ""}`;
        start(() => (replace ? router.replace(url) : router.push(url)));
      }}
    >
      {children}
    </form>
  );
}
