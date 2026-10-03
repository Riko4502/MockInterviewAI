"use client";

import { Skeleton } from "@packages/ui";

export function DashboardUpcomingSkeleton() {
  return (
    <section
      aria-label="upcoming-session-loading"
      className="min-h-72 rounded-xl border border-border bg-card p-6"
    >
      <div className="space-y-5">
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-5 w-3/5" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-1/2" />
        <div className="flex flex-wrap gap-3 pt-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
    </section>
  );
}
