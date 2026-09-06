import type { HTMLAttributes } from "react";
import { classNames } from "./class-names.js";

export interface DealFlowBrandProps extends HTMLAttributes<HTMLSpanElement> {
  compact?: boolean;
  label?: string;
}

export function DealFlowBrand({
  className,
  compact = false,
  label = "DealFlow360",
  ...props
}: DealFlowBrandProps) {
  return (
    <span
      className={classNames(
        "ui:inline-flex ui:items-center ui:gap-xs ui:font-sans ui:text-title ui:font-semibold ui:text-foreground-strong",
        className,
      )}
      translate="no"
      {...props}
    >
      <span
        aria-hidden="true"
        className="ui:grid ui:size-touch ui:shrink-0 ui:place-items-center ui:rounded-control ui:bg-brand ui:font-mono ui:text-caption ui:font-semibold ui:text-on-brand"
      >
        DF
      </span>
      {compact ? (
        <span className="ui:sr-only">{label}</span>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}
