import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminInputManualLoading() {
  return (
    <AdminLoadingChrome>
      {/* Page intro callout */}
      <Skeleton className="h-16 w-full mb-5 rounded" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left: form card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
            <Skeleton className="h-4 w-40 mb-1" />
            <Skeleton className="h-3 w-56 mb-4" />

            {/* Lomba picker — chip row + grouped list */}
            <div>
              <Skeleton className="h-3 w-24 mb-2" />
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
              <div className="space-y-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>

            {/* Nama + gender */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Skeleton className="h-3 w-24 mb-1.5" />
                <Skeleton className="h-11 w-full rounded" />
              </div>
              <div>
                <Skeleton className="h-3 w-16 mb-1.5" />
                <Skeleton className="h-11 w-full rounded" />
              </div>
            </div>

            {/* Kategori */}
            <div>
              <Skeleton className="h-3 w-20 mb-1.5" />
              <div className="grid grid-cols-3 gap-1.5">
                <Skeleton className="h-14 rounded" />
                <Skeleton className="h-14 rounded" />
                <Skeleton className="h-14 rounded" />
              </div>
            </div>

            {/* Submit */}
            <Skeleton className="h-12 w-full rounded" />
          </div>
        </div>

        {/* Right: peserta CRUD list */}
        <div className="lg:col-span-3 space-y-5">
          {/* Lomba header */}
          <Skeleton className="h-16 w-full rounded-xl" />
          {/* CRUD list */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB]">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 border-b border-[#E5E7EB] last:border-0 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
