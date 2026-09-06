import type { Metadata } from "next";

import { StateScreen } from "../../components/foundation/state-screen";

export const metadata: Metadata = { title: "Access Restricted" };

export default function ForbiddenPage() {
  return (
    <StateScreen
      description="Your current role does not permit this workspace. Sign in with an authorized account or request access from an administrator."
      eyebrow="Access Restricted"
      title="This Workspace Is Not Available"
      tone="warning"
    />
  );
}
