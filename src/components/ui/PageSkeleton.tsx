/** Gray placeholder shown instantly while a page loads */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-zinc-800" />
        <div className="h-4 w-64 max-w-full rounded bg-zinc-900" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-zinc-900 border border-zinc-800" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-900 border border-zinc-800" />
        ))}
      </div>
    </div>
  )
}
