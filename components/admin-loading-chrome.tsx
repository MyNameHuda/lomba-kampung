import { Skeleton } from "@/components/skeleton";

// Shared admin loading chrome — sidebar + topbar skeleton.
// Reused by all admin/*/loading.tsx files so we don't duplicate the chrome.

export function AdminLoadingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="diffuse-bg">
      {/* Sidebar */}
      <aside className="admin-sidebar" aria-hidden="true">
        <div className="p-5 pr-12 border-b border-[#E5E7EB] mb-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-9 h-9 rounded" />
            <div>
              <Skeleton className="h-3.5 w-24 mb-1.5" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        </div>
        <nav className="flex-1 py-2 space-y-1 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton
                className="h-3 flex-1"
                style={{ width: `${60 + (i % 3) * 15}%` } as React.CSSProperties}
              />
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="w-7 h-7 rounded md:hidden" />
            <div>
              <Skeleton className="h-2.5 w-32 mb-1" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded" />
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
