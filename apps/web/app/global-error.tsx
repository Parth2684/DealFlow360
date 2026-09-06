"use client";

import { Button } from "@repo/ui";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <main className="grid min-h-dvh place-items-center bg-canvas px-page py-2xl">
          <div className="grid max-w-[36rem] gap-md">
            <p
              className="m-0 font-mono text-caption font-semibold text-brand"
              translate="no"
            >
              DealFlow360
            </p>
            <h1 className="m-0 text-balance text-heading font-semibold text-foreground-strong">
              The Application Could Not Start
            </h1>
            <p className="m-0 text-pretty text-body-sm text-foreground-muted">
              Reload the application. If the problem continues, check the web
              and API services.
            </p>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </main>
      </body>
    </html>
  );
}
