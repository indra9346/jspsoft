"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";
import type { ActionState } from "@/lib/action";

/* ---------- modal ---------- */
const ModalCtx = createContext<{ close: () => void } | null>(null);

export function Modal({
  trigger,
  title,
  children,
  wide,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <div className="fixed inset-0 bg-indigo-900/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className={`card pop relative my-8 w-full ${wide ? "max-w-3xl" : "max-w-xl"} bg-white p-6`}
            role="dialog"
            aria-label={title}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <ModalCtx.Provider value={{ close: () => setOpen(false) }}>{children}</ModalCtx.Provider>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- form with server action ---------- */
export function SubmitButton({
  children,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Feedback({ state }: { state: ActionState }) {
  const router = useRouter();
  const expired = !!state && !state.ok && /session has expired/i.test(state.message);
  useEffect(() => {
    if (expired) router.push("/login?expired=1");
  }, [expired, router]);
  if (!state) return null;
  return (
    <div
      role="status"
      className={`pop flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
        state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {state.ok ? <CheckCircle2 size={16} className="mt-0.5" /> : <TriangleAlert size={16} className="mt-0.5" />}
      {state.message}
    </div>
  );
}

export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess,
  closeOnSuccess = true,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  closeOnSuccess?: boolean;
}) {
  const busy = useRef(false);
  // In-flight guard: a second submit fired in the same instant (rapid double-click / Enter) is ignored.
  const guarded = async (prev: ActionState, fd: FormData): Promise<ActionState> => {
    if (busy.current) return prev;
    busy.current = true;
    try {
      return await action(prev, fd);
    } finally {
      busy.current = false;
    }
  };
  const [state, formAction] = useActionState(guarded, null);
  const modal = useContext(ModalCtx);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      if (closeOnSuccess && modal) {
        const t = setTimeout(modal.close, 350);
        return () => clearTimeout(t);
      }
    }
  }, [state, modal, resetOnSuccess, closeOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <Feedback state={state} />
    </form>
  );
}

/** Small inline confirm-and-run button (delete, approve, etc.). */
export function ConfirmButton({
  action,
  confirm,
  children,
  className = "btn btn-danger btn-sm",
  title,
}: {
  action: () => Promise<ActionState>;
  confirm?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const busyRef = useRef(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        title={title}
        className={className}
        disabled={pending}
        onClick={() => {
          if (busyRef.current) return;
          if (confirm && !window.confirm(confirm)) return;
          busyRef.current = true;
          start(async () => {
            try {
              const r = await action();
              setErr(r && !r.ok ? r.message : null);
              if (r && !r.ok) {
                if (/session has expired/i.test(r.message)) router.push("/login?expired=1");
                else window.alert(r.message);
              }
            } finally {
              busyRef.current = false;
            }
          });
        }}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : children}
      </button>
      {err && <span className="sr-only">{err}</span>}
    </>
  );
}

export function Field({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{hint}</p>}
    </div>
  );
}
