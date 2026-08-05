import { AdminLoadingChrome } from "@/components/admin-loading-chrome";
import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <AdminLoadingChrome>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </AdminLoadingChrome>
  );
}
