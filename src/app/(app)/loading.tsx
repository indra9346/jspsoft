/** Shown instantly while a page's data loads (sidebar/header stay put, so there is no flash or layout jump). */
export default function Loading() {
  const bar = "animate-pulse rounded-2xl";
  return (
    <div role="status" aria-label="Loading" aria-busy="true" data-loading-skeleton>
      <div className="mb-6 flex items-center gap-4">
        <div className={`${bar} h-12 w-12`} style={{ background: "var(--brand-mid)" }} />
        <div className="space-y-2">
          <div className={`${bar} h-6 w-56`} style={{ background: "var(--brand2-soft)" }} />
          <div className={`${bar} h-4 w-80 max-w-full`} style={{ background: "var(--brand-soft)" }} />
        </div>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["#dbeafe", "#ffedd5", "#d1fae5", "#ede9fe"].map((c) => (
          <div key={c} className={`${bar} h-28`} style={{ background: c }} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className={`${bar} h-72 bg-white/80`} />
        <div className={`${bar} h-72 bg-white/80`} />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
