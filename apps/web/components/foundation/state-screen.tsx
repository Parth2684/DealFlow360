import { ButtonLink, DealFlowBrand, InlineFeedback } from "@repo/ui";
import type { ReactNode } from "react";

export interface StateScreenProps {
  action?: ReactNode;
  description: ReactNode;
  eyebrow?: string;
  title: string;
  tone?: "neutral" | "info" | "warning" | "danger";
}

export function StateScreen({
  action,
  description,
  eyebrow,
  title,
  tone = "neutral",
}: StateScreenProps) {
  return (
    <main
      className="grid min-h-dvh place-items-center bg-canvas px-page py-2xl"
      id="main-content"
    >
      <div className="grid w-full max-w-[36rem] gap-lg">
        <DealFlowBrand />
        <div className="grid gap-sm">
          {eyebrow ? (
            <p className="m-0 text-caption font-semibold text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="m-0 scroll-mt-24 text-balance text-heading font-semibold text-foreground-strong">
            {title}
          </h1>
        </div>
        <InlineFeedback tone={tone}>{description}</InlineFeedback>
        {action ?? (
          <ButtonLink href="/login" variant="secondary">
            Return to Login
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
