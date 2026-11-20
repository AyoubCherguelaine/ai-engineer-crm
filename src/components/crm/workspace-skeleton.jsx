import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#f7f9f8] p-6 md:pl-72"
      role="status"
      aria-label="Loading your workspace"
    >
      <span className="sr-only">Loading your saved connections…</span>
      <div className="mx-auto max-w-7xl space-y-8 pt-14">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-36 rounded-lg" key={i} />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  );
}
