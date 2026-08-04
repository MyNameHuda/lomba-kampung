import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminApprovalLoading() {
  return (
    <AdminLoadingChrome>
      <div className="space-y-4">
        {/* Stats row — matches approval page stat cards (Menunggu/Disetujui/Ditolak/Total) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex gap-2 items-center flex-wrap">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>

        {/* Pending rows — each shows avatar, name, lomba, action buttons */}
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex items-center gap-3"
            >
              <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-4 w-14 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <Skeleton className="h-8 w-20 rounded" />
                <Skeleton className="h-8 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
