import { ButtonLink } from "@repo/ui";

import { StateScreen } from "../components/foundation/state-screen";

export default function NotFound() {
  return (
    <StateScreen
      action={
        <ButtonLink href="/" variant="secondary">
          Return Home
        </ButtonLink>
      }
      description="This address does not match an available DealFlow360 page. Check the link or return home."
      eyebrow="Page Not Found"
      title="There Is Nothing Here"
      tone="warning"
    />
  );
}
