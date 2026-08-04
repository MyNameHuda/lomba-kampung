import { Skeleton } from "@/components/skeleton";

export default function LombaDetailLoading() {
  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="app-header" aria-hidden="true">
        <Skeleton className="w-7 h-7 rounded" />
        <Skeleton className="h-4 w-32" />
        <div className="w-7" />
      </header>

      {/* Hero */}
      <div className="mobile-hero" aria-hidden="true">
        <Skeleton className="w-20 h-20 mx-auto rounded-2xl" />
        <div className="mt-3">
          <Skeleton className="h-7 w-56 mx-auto" />
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      <main className="app-content space-y-4">
        {/* Description card */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4">
          <Skeleton className="h-3.5 w-24 mb-2" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-10/12" />
          </div>
        </div>

        {/* Syarat card */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4">
          <Skeleton className="h-3.5 w-28 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
                <Skeleton className="h-3 flex-1" style={{ width: `${70 + i * 8}%` } as React.CSSProperties} />
              </div>
            ))}
          </div>
        </div>

        {/* PJ card */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4">
          <Skeleton className="h-3.5 w-32 mb-3" />
          <div className="space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA button */}
        <div className="pt-2">
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </main>
    </div>
  );
}
