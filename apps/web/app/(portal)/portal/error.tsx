"use client";

import { Button, ErrorFeedback } from "@repo/ui";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <div className="grid max-w-[42rem] gap-md">
      <h1 className="m-0 text-balance text-heading font-semibold text-foreground-strong">
        Portal Data Could Not Load
      </h1>
      <ErrorFeedback title="Request Failed">
        Retry the customer portal. If the link expired, request a new one.
      </ErrorFeedback>
      <Button onClick={reset}>Retry Portal</Button>
    </div>
  );
}
