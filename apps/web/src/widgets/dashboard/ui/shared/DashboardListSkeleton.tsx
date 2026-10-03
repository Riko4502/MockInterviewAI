"use client";

import { Card, Skeleton, Typography } from "@packages/ui";

export function DashboardListSkeleton({
  title,
  rows = 3,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <Card aria-busy="true" aria-label={title} className="min-h-72 gap-4">
      <Typography as="h2" variant="large">
        {title}
      </Typography>
      {Array.from({ length: rows }, (_, index) => index).map((row) => (
        <div key={row} className="space-y-3 py-3">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </Card>
  );
}
