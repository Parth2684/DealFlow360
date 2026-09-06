"use client";

import { Button, ErrorFeedback } from "@repo/ui";

export default function InternalError({ reset }: { reset: () => void }) {
  return (
    <div className="grid max-w-[42rem] gap-md">
      <h1 className="m-0 text-balance text-heading font-semibold text-foreground-strong">
        Workspace Data Could Not Load
      </h1>
      <ErrorFeedback title="Request Failed">
        Retry the workspace. If this continues, check the API status in the
        header.
      </ErrorFeedback>
      <Button onClick={reset}>Retry Workspace</Button>
    </div>
  );
}
