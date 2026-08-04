import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminLombaLoading() {
  return (
    <AdminLoadingChrome>
      <div className="space-y-4">
        {/* Filter / search bar */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex gap-2 items-center">
          <Skeleton className="h-10 flex-1 rounded" />
          <Skeleton className="h-10 w-28 rounded" />
        </div>

        {/* Lomba cards (5) — match lomba-card structure */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex gap-3.5"
            >
              <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-2.5 w-24" />
              </div>
              <div className="flex gap-1.5 items-start">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
