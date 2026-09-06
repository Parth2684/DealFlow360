import { DealFlowBrand, Skeleton } from "@repo/ui";

export default function RootLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading DealFlow360"
      className="grid min-h-dvh place-items-center bg-canvas px-page"
      id="main-content"
    >
      <div className="grid w-full max-w-[28rem] gap-lg">
        <DealFlowBrand />
        <div className="grid gap-sm">
          <Skeleton className="w-3/4" />
          <Skeleton className="w-full" />
          <Skeleton className="w-2/3" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
