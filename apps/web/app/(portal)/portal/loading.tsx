import { Skeleton } from "@repo/ui";

export default function PortalLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading customer portal"
      className="grid gap-lg"
    >
      <div className="grid gap-xs border-b border-border pb-md">
        <Skeleton className="w-2/5" />
        <Skeleton className="w-3/5" />
      </div>
      <Skeleton shape="block" />
      <span className="sr-only">Loading customer portal…</span>
    </div>
  );
}
