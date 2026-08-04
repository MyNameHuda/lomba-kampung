import { Skeleton } from "@/components/skeleton";

export default function SuksesLoading() {
  return (
    <div className="mobile-page">
      <header className="app-header" aria-hidden="true">
        <Skeleton className="w-7 h-7 rounded" />
        <Skeleton className="h-4 w-24" />
        <div className="w-7" />
      </header>

      <main className="app-content">
        {/* Success check icon */}
        <div className="text-center mb-5">
          <Skeleton className="w-20 h-20 mx-auto rounded-full" />
          <div className="mt-3">
            <Skeleton className="h-5 w-40 mx-auto mb-2" />
            <Skeleton className="h-3 w-56 mx-auto" />
          </div>
        </div>

        {/* Kartu peserta card */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4 space-y-3">
          <div className="text-center pb-3 border-b border-[#E5E7EB]">
            <Skeleton className="h-2.5 w-24 mx-auto mb-2" />
            <Skeleton className="h-6 w-36 mx-auto" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-5 space-y-2.5">
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </main>
    </div>
  );
}
