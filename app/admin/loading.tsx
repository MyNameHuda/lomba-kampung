import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

// Admin dashboard skeleton — chrome + welcome card + quick tiles + stats + top lomba
export default function AdminDashboardLoading() {
  return (
    <AdminLoadingChrome>
      <div className="space-y-4">
          {/* Welcome gradient card */}
          <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-6 h-32">
            <div className="space-y-2">
              <Skeleton className="h-3 w-32 !bg-white/30" />
              <Skeleton className="h-5 w-48 !bg-white/30" />
              <Skeleton className="h-2.5 w-64 !bg-white/30" />
            </div>
          </div>

          {/* Quick action tiles (6) */}
          <div>
            <Skeleton className="h-4 w-24 mb-3.5" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex flex-col items-center gap-2">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>

          {/* Stats grid (4 cards) */}
          <div>
            <Skeleton className="h-4 w-24 mb-3.5" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top lomba list */}
          <div>
            <Skeleton className="h-4 w-32 mb-3.5" />
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 border-b border-[#E5E7EB] last:border-0">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              ))}
            </div>
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
