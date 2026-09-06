import { Skeleton } from "@repo/ui";

export default function InternalLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
      className="grid gap-lg"
    >
      <div className="grid gap-xs border-b border-border pb-md">
        <Skeleton className="w-2/5" />
        <Skeleton className="w-3/5" />
      </div>
      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton shape="block" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
      </div>
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
