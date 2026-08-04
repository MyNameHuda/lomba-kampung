import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminPesertaLoading() {
  return (
    <AdminLoadingChrome>
      <div className="space-y-4">
        {/* Filter / search bar */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex gap-2 items-center flex-wrap">
          <Skeleton className="h-10 flex-1 min-w-[160px] rounded" />
          <Skeleton className="h-10 w-40 rounded" />
          <Skeleton className="h-10 w-40 rounded" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Peserta list rows */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3.5 border-b border-[#E5E7EB] last:border-0"
            >
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
