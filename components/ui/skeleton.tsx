type SkeletonProps = { className?: string };

/** Base pulsing block used for all data-loading states. */
export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function SkeletonCircle({ className = "h-10 w-10" }: SkeletonProps) {
  return <div aria-hidden className={`animate-pulse rounded-full bg-slate-200/70 ${className}`} />;
}

export function SkeletonText({ lines = 1, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Placeholder for a StatTile while its metrics load. */
export function SkeletonStatCard() {
  return (
    <div
      aria-hidden
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <Skeleton className="h-11 w-11 rounded-xl" />
      <Skeleton className="mt-4 h-7 w-24" />
      <Skeleton className="mt-2 h-4 w-1/2" />
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

/** Placeholder for a content card (profile panel, detail section, etc.). */
export function SkeletonCard() {
  return (
    <div
      aria-hidden
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} className="mt-4" />
    </div>
  );
}

/** Placeholder for list/inbox style content while rows load. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <SkeletonCircle className="h-9 w-9" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a detail page split into header + two panels. */
export function SkeletonDetail() {
  return (
    <div className="space-y-4">
      <div
        aria-hidden
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div aria-hidden className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <SkeletonText lines={6} />
        </div>
        <div aria-hidden className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SkeletonText lines={4} />
        </div>
      </div>
    </div>
  );
}
