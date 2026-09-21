import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

const PRIORITY = {
  NORMAL: { label: "Update", color: "#0891b2" },
  IMPORTANT: { label: "Important", color: "#d97706" },
  URGENT: { label: "Urgent", color: "#e11d48" },
} as const;

export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  audience: string;
  priority: string;
  createdAt: Date;
  authorName: string;
  authorId: string;
  publishDate?: Date;
  expiryDate?: Date | null;
  expired?: boolean;
  classes: string[];
}

export function AnnouncementCards({ items, actions, compact }: { items: AnnouncementView[]; actions?: (a: AnnouncementView) => React.ReactNode; compact?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const p = PRIORITY[a.priority as keyof typeof PRIORITY] ?? PRIORITY.NORMAL;
        return (
          <li key={a.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-[color:var(--line)]" style={{ borderLeft: `5px solid ${p.color}` }}>
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: p.color }}>
              <Megaphone size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-bold">{a.title}</h3>
                <Badge color={p.color}>{p.label}</Badge>
                <Badge color="#7c3aed">
                  {a.audience === "CLASSES" || a.audience === "SECTIONS" ? a.classes.join(", ") : ({ ALL: "Everyone", STAFF: "All staff", STUDENTS: "All students", TEACHERS: "All teachers" } as Record<string, string>)[a.audience]}
                </Badge>
              </div>
              <p className={`mt-1 whitespace-pre-line text-sm leading-relaxed ${compact ? "line-clamp-2" : ""}`}>{a.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-[color:var(--ink-soft)]">
                <span>{a.authorName} · {fmtDateTime(a.createdAt)}</span>
                {a.expiryDate && <span>· expires {fmtDate(a.expiryDate)}</span>}
                {a.expired && <Badge color="#6b6ea6">Expired</Badge>}
              </div>
            </div>
            {actions && <div className="flex shrink-0 items-start gap-1">{actions(a)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
