import { Skeleton, SkeletonText } from "@/components/skeleton";

export default function HomeLoading() {
  return (
    <div className="mobile-page">
      {/* Header (matches .app-header red gradient) */}
      <header className="app-header" aria-hidden="true">
        <div className="logo">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </header>

      {/* Hero (matches .mobile-hero red gradient) */}
      <div className="mobile-hero" aria-hidden="true">
        <Skeleton className="h-5 w-40 mx-auto rounded-full" />
        <div className="mt-3">
          <Skeleton className="h-7 w-64 mx-auto" />
        </div>
        <div className="mt-2">
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>

      <main className="app-content">
        {/* Info card */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4 mb-5 flex items-center gap-3.5">
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-44" />
          </div>
        </div>

        {/* Filter chips */}
        <div className="-mx-4 px-4 mb-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 rounded-full"
                style={{ width: `${80 + i * 12}px` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>

        {/* Section title */}
        <div className="my-3.5">
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Lomba card skeletons (3) */}
        <div className="space-y-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#E5E7EB] rounded p-4 flex gap-3.5 shadow-sm"
            >
              <Skeleton className="w-[60px] h-[60px] rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="w-3 h-3 rounded-full self-center" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
