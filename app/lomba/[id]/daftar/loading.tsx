import { Skeleton } from "@/components/skeleton";

export default function DaftarLoading() {
  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="app-header" aria-hidden="true">
        <Skeleton className="w-7 h-7 rounded" />
        <Skeleton className="h-4 w-28" />
        <div className="w-7" />
      </header>

      <main className="app-content">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <Skeleton
                className={`w-7 h-7 rounded-full flex-shrink-0 ${i === 0 ? "" : "opacity-40"}`}
              />
              {i < 2 && <Skeleton className="h-0.5 flex-1 opacity-40" />}
            </div>
          ))}
        </div>

        {/* Step title */}
        <div className="mb-4">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-3 w-64" />
        </div>

        {/* Form fields */}
        <div className="space-y-3.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24 mb-1.5" />
              <Skeleton className="h-11 w-full rounded" />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6">
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </main>
    </div>
  );
}
