"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2, X, Sparkles } from "lucide-react";
import { Avatar, Badge, Empty, Tile } from "@/components/ui";
import { ConfirmButton } from "@/components/form";
import { deleteRemarkAction } from "@/actions/remarks";
import { className, fmtDate } from "@/lib/utils";

export interface SerializedRemark {
  id: string;
  studentId: string;
  classId: string;
  category: string;
  remark: string;
  date: string;
  authorId: string;
  author: {
    name: string;
  };
  student: {
    id: string;
    admissionNo: string;
    rollNo: number;
    user: {
      name: string;
      email: string;
    };
  };
  classRoom: {
    grade: string;
    section: string;
  };
}

export interface ClassOption {
  id: string;
  grade: string;
  section: string;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  ACADEMIC: { label: "Academic Progress", color: "#2563eb" },
  BEHAVIOUR: { label: "Behaviour", color: "#f97316" },
  PARTICIPATION: { label: "Class Participation", color: "#059669" },
  ATTENDANCE: { label: "Attendance Observation", color: "#0891b2" },
  ACTIVITIES: { label: "Activities & Play", color: "#8b5cf6" },
  STRENGTHS: { label: "Strengths", color: "#10b981" },
  IMPROVEMENT: { label: "Area for Improvement", color: "#e11d48" },
  PTM: { label: "PTM Discussion", color: "#7c3aed" },
  GENERAL: { label: "General Observation", color: "#64748b" },
};

export function RemarksClient({
  initialRemarks,
  classes,
  currentUserId,
  isAdmin,
}: {
  initialRemarks: SerializedRemark[];
  classes: ClassOption[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const filteredRemarks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialRemarks.filter((r) => {
      if (selectedClass && r.classId !== selectedClass) return false;
      if (selectedCategory && r.category !== selectedCategory) return false;
      if (q) {
        const studentName = r.student?.user?.name?.toLowerCase() ?? "";
        const admNo = r.student?.admissionNo?.toLowerCase() ?? "";
        const rollStr = String(r.student?.rollNo ?? "");
        const remarkText = r.remark?.toLowerCase() ?? "";
        const authorName = r.author?.name?.toLowerCase() ?? "";
        const catLabel = (CATEGORIES[r.category]?.label ?? "").toLowerCase();
        const matches =
          studentName.includes(q) ||
          admNo.includes(q) ||
          rollStr.includes(q) ||
          remarkText.includes(q) ||
          authorName.includes(q) ||
          catLabel.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [initialRemarks, query, selectedClass, selectedCategory]);

  const ptmCount = useMemo(
    () => filteredRemarks.filter((r) => r.category === "PTM").length,
    [filteredRemarks],
  );
  const academicCount = useMemo(
    () =>
      filteredRemarks.filter(
        (r) =>
          r.category === "ACADEMIC" ||
          r.category === "STRENGTHS" ||
          r.category === "IMPROVEMENT",
      ).length,
    [filteredRemarks],
  );
  const behaviourCount = useMemo(
    () =>
      filteredRemarks.filter(
        (r) =>
          r.category === "BEHAVIOUR" ||
          r.category === "PARTICIPATION" ||
          r.category === "ACTIVITIES",
      ).length,
    [filteredRemarks],
  );

  const hasFilter = Boolean(query || selectedClass || selectedCategory);

  const clearFilters = () => {
    setQuery("");
    setSelectedClass("");
    setSelectedCategory("");
  };

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Total Remarks"
          value={filteredRemarks.length}
          tone="purple"
          icon="announce"
          sub={hasFilter ? "Matching current filter" : "Recorded observations"}
        />
        <Tile
          label="PTM Discussions"
          value={ptmCount}
          tone="teal"
          icon="students"
          sub="Parent meeting notes"
        />
        <Tile
          label="Academic Notes"
          value={academicCount}
          tone="blue"
          icon="marks"
          sub="Progress & skills"
        />
        <Tile
          label="Behaviour & Activities"
          value={behaviourCount}
          tone="orange"
          icon="classes"
          sub="Social & active play"
        />
      </div>

      <div className="card card-pad mb-5 flex flex-wrap items-end gap-3 shadow-sm">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="live-search-remarks">
            Search
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3 text-[color:var(--ink-soft)]"
            />
            <input
              id="live-search-remarks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input !pl-9 !pr-8"
              placeholder="Type student name, admission no, or keyword…"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-2.5 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                aria-label="Clear search text"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="w-44">
          <label className="label" htmlFor="live-class-filter">
            Class & section
          </label>
          <select
            id="live-class-filter"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="select"
          >
            <option value="">All sections</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {className(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="w-52">
          <label className="label" htmlFor="live-category-filter">
            Category
          </label>
          <select
            id="live-category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="select"
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost flex items-center gap-1 text-[color:var(--ink-soft)]"
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {hasFilter && (
        <div className="mb-3 flex items-center justify-between px-1 text-xs text-[color:var(--ink-soft)]">
          <span>
            Showing <b>{filteredRemarks.length}</b> of{" "}
            <b>{initialRemarks.length}</b> remarks
          </span>
          <span className="flex items-center gap-1 font-semibold text-[color:var(--brand)]">
            <Sparkles size={12} /> Instant live search active
          </span>
        </div>
      )}

      {filteredRemarks.length === 0 ? (
        <Empty
          title={hasFilter ? "No matching remarks found" : "No remarks recorded"}
          hint={
            hasFilter
              ? "Try adjusting your search keyword or clearing the selected filter."
              : isAdmin
              ? "Teachers or Admin have not added any remarks yet."
              : "You have not added remarks for your students yet."
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRemarks.map((r) => {
            const cat = CATEGORIES[r.category] ?? CATEGORIES.GENERAL;
            const canDelete = isAdmin || r.authorId === currentUserId;
            return (
              <div
                key={r.id}
                className="card card-pad hover:bg-[color:var(--brand2-soft)] transition duration-150"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={r.student.user.name}
                      seed={r.student.user.email}
                      size={40}
                    />
                    <div>
                      <Link
                        href={`/students/${r.student.id}`}
                        className="font-bold text-[color:var(--ink-strong)] hover:underline flex items-center gap-2"
                      >
                        {r.student.user.name}
                        <span className="text-xs font-normal text-[color:var(--ink-soft)]">
                          ({className(r.classRoom)} · Roll {r.student.rollNo})
                        </span>
                      </Link>
                      <div className="text-xs text-[color:var(--ink-soft)]">
                        Entered by <b>{r.author.name}</b> on {fmtDate(r.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={cat.color}>{cat.label}</Badge>
                    {canDelete && (
                      <ConfirmButton
                        className="btn btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                        title="Delete remark"
                        confirm="Are you sure you want to delete this remark?"
                        action={deleteRemarkAction.bind(null, r.id)}
                      >
                        <Trash2 size={14} />
                      </ConfirmButton>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-sm text-[color:var(--ink-strong)] bg-white/70 p-3.5 rounded-xl border border-[color:var(--line)] whitespace-pre-wrap leading-relaxed">
                  {r.remark}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
