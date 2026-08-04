import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminPengaturanLoading() {
  return (
    <AdminLoadingChrome>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Tabs / sections */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 rounded-full flex-shrink-0"
              style={{ width: `${80 + i * 10}px` } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Settings card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20 mb-1.5" />
                <Skeleton className="h-11 w-full rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Color pickers card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg">
                <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="w-9 h-9 rounded" />
                  <Skeleton className="w-9 h-9 rounded" />
                  <Skeleton className="w-9 h-9 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <Skeleton className="h-12 w-full md:w-48 rounded ml-auto" />
      </div>
    </AdminLoadingChrome>
  );
}
