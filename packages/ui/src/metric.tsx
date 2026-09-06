import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./class-names.js";

export type MetricTone = "neutral" | "success" | "warning" | "danger" | "info";

const detailClassNames: Record<MetricTone, string> = {
  danger: "ui:text-danger",
  info: "ui:text-info",
  neutral: "ui:text-foreground-muted",
  success: "ui:text-success",
  warning: "ui:text-warning",
};

export interface MetricProps extends HTMLAttributes<HTMLDListElement> {
  detail?: ReactNode;
  label: ReactNode;
  tone?: MetricTone;
  value: ReactNode;
}

export function Metric({
  className,
  detail,
  label,
  tone = "neutral",
  value,
  ...props
}: MetricProps) {
  return (
    <dl
      className={classNames(
        "ui:@container ui:m-0 ui:grid ui:min-w-0 ui:gap-xxs",
        className,
      )}
      {...props}
    >
      <dt className="ui:font-sans ui:text-caption ui:font-medium ui:text-foreground-muted">
        {label}
      </dt>
      {/* Currency values sit in columns as narrow as ~7rem inside side panels,
          so the figure scales with the metric rather than overflowing it. */}
      <dd className="ui:m-0 ui:min-w-0 ui:font-mono ui:text-[clamp(1rem,9cqi,1.5rem)] ui:font-semibold ui:leading-tight ui:tabular-nums ui:text-foreground-strong">
        {value}
      </dd>
      {detail ? (
        <dd
          className={classNames(
            "ui:m-0 ui:font-sans ui:text-caption ui:font-medium",
            detailClassNames[tone],
          )}
        >
          {detail}
        </dd>
      ) : null}
    </dl>
  );
}

export interface MetricGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label"
> {
  "aria-label": string;
}

export function MetricGroup({ className, ...props }: MetricGroupProps) {
  return (
    <div
      className={classNames(
        "ui:grid ui:gap-md ui:border-y ui:border-border ui:py-md ui:sm:grid-cols-2 ui:lg:grid-cols-4",
        className,
      )}
      role="group"
      {...props}
    />
  );
}
