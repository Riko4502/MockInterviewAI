import { Skeleton } from "@packages/ui";
import { ShowcaseCardSkeleton } from "@/entities/showcase-card";

const keys = [
  "page-sk-1",
  "page-sk-2",
  "page-sk-3",
  "page-sk-4",
  "page-sk-5",
  "page-sk-6",
];

export default function PartnersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-5 w-24 rounded-md" />
      </div>

      <Skeleton className="h-20 w-full rounded-2xl" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {keys.map((skKey) => (
          <ShowcaseCardSkeleton key={skKey} />
        ))}
      </div>
    </div>
  );
}
