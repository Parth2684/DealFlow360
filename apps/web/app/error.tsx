"use client";

import { Button } from "@repo/ui";

import { StateScreen } from "../components/foundation/state-screen";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <StateScreen
      action={<Button onClick={reset}>Try Again</Button>}
      description="The page could not be loaded. Retry the request, or return to login if the problem continues."
      eyebrow="Unexpected Error"
      title="DealFlow360 Hit a Problem"
      tone="danger"
    />
  );
}
