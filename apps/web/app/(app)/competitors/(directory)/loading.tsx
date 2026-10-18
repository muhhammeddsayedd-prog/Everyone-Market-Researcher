import { Skeleton } from '@/components/ui/states';

/** Card-shaped skeletons, shown only when loading takes more than 150 ms. */
export default function CompetitorsLoading() {
  return (
    <div className="skeleton-delay flex flex-col gap-6" aria-busy="true" aria-label="Loading competitors">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-28 w-full rounded-md" />
      <Skeleton className="h-9 w-full" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-52 rounded-md" />
        ))}
      </div>
    </div>
  );
}
