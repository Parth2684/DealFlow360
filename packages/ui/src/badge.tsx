import type { HTMLAttributes } from "react";
import { classNames } from "./class-names.js";

export type BadgeTone =
  "neutral" | "brand" | "info" | "success" | "warning" | "danger";

const toneClassNames: Record<BadgeTone, string> = {
  brand: "ui:border-brand/35 ui:bg-brand-subtle ui:text-brand",
  danger: "ui:border-danger/35 ui:bg-danger-subtle ui:text-danger",
  info: "ui:border-info/35 ui:bg-info-subtle ui:text-info",
  neutral: "ui:border-border ui:bg-surface-subtle ui:text-foreground-muted",
  success: "ui:border-success/35 ui:bg-success-subtle ui:text-success",
  warning: "ui:border-warning/35 ui:bg-warning-subtle ui:text-warning",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={classNames(
        "ui:inline-flex ui:w-fit ui:items-center ui:gap-xxs ui:whitespace-nowrap ui:rounded-pill ui:border ui:px-xs ui:py-xxs ui:font-sans ui:text-caption ui:font-semibold",
        toneClassNames[tone],
        className,
      )}
      {...props}
    />
  );
}

export const StatusBadge = Badge;
