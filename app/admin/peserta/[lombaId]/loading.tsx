import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminPesertaByLombaLoading() {
  return (
    <AdminLoadingChrome>
      <div className="space-y-4">
        {/* Lomba header card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center gap-3.5">
          <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-5 w-10" />
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5">
          <Skeleton className="h-10 w-full rounded" />
        </div>

        {/* Peserta rows */}
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="w-7 h-7 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
