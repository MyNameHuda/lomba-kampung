import { Skeleton } from "@/components/skeleton";
import { AdminLoadingChrome } from "@/components/admin-loading-chrome";

export default function AdminInputManualLoading() {
  return (
    <AdminLoadingChrome>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Page intro */}
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full max-w-md" />
        </div>

        {/* Form card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          {/* Lomba select */}
          <div>
            <Skeleton className="h-3 w-24 mb-1.5" />
            <Skeleton className="h-11 w-full rounded" />
          </div>

          {/* Kategori + umur row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Skeleton className="h-3 w-20 mb-1.5" />
              <Skeleton className="h-11 w-full rounded" />
            </div>
            <div>
              <Skeleton className="h-3 w-16 mb-1.5" />
              <Skeleton className="h-11 w-full rounded" />
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

          {/* Alamat */}
          <div>
            <Skeleton className="h-3 w-20 mb-1.5" />
            <Skeleton className="h-11 w-full rounded" />
          </div>

          {/* Submit */}
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
