"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X, Lock } from "lucide-react";
import { ICONS } from "@/components/icons";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/actions/auth";
import type { NavGroup } from "@/lib/nav";

interface Props {
  groups: NavGroup[];
  school: { name: string; logo: string | null };
  user: { name: string; role: string; initials: string; color: string };
  children: React.ReactNode;
}

export function AppShell({ groups, school, user, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // The item that owns the current page: exact href, a declared child page, else the longest matching prefix.
  const all = groups.flatMap((g) => g.items);
  const owner =
    all.find((it) => it.href === path || it.also?.includes(path)) ??
    [...all].filter((it) => path.startsWith(it.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-4">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="nav-label">{g.label}</div>
          <div className="space-y-1">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon] ?? ICONS.dashboard;
              const active = owner?.href === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`nav-link ${active ? "active" : ""}`}
                >
                  <Icon size={18} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.locked && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: active ? "var(--brand-soft)" : "rgba(255,255,255,.22)" }}
                      title="Not active under your plan"
                    >
                      <Lock size={10} /> Add-on
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <Logo src={school.logo} size={46} />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-extrabold leading-tight text-white">{school.name}</div>
        <div className="text-[11px] font-medium text-white/75">School Management</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-72">
      {/* desktop sidebar */}
      <aside className="sidebar no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col lg:flex">
        {brand}
        {nav}
        <div className="px-5 pb-4 text-[11px] text-white/70">
          Powered by <b className="text-white">Swan Digital Solutions</b>
        </div>
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-indigo-900/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="sidebar pop absolute inset-y-0 left-0 flex w-72 flex-col">
            <button
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-full bg-white/20 p-1.5"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
            {brand}
            {nav}
          </aside>
        </div>
      )}

      {/* top bar */}
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-8">
        <button
          className="btn btn-ghost btn-sm lg:hidden"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-soft)]" data-header-brand>
          <Logo src={school.logo} size={32} />
          <span className="hidden sm:block">{school.name} · <span className="text-[color:var(--brand)]">Smarter Management</span></span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-bold leading-tight text-[color:var(--ink-strong)]">{user.name}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
              {user.role}
            </div>
          </div>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
            style={{ background: user.color }}
          >
            {user.initials}
          </span>
          <form action={logoutAction}>
            <button className="btn btn-soft btn-sm" title="Sign out">
              <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
