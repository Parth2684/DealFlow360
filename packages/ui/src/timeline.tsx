import type { HTMLAttributes, ReactNode, TimeHTMLAttributes } from "react";
import { classNames } from "./class-names.js";

export interface TimelineProps extends Omit<
  HTMLAttributes<HTMLOListElement>,
  "aria-label"
> {
  "aria-label": string;
}

export function Timeline({ className, ...props }: TimelineProps) {
  return (
    <ol
      className={classNames("ui:m-0 ui:list-none ui:p-0", className)}
      {...props}
    />
  );
}

export interface TimelineItemProps extends Omit<
  HTMLAttributes<HTMLLIElement>,
  "title"
> {
  description?: ReactNode;
  metadata?: ReactNode;
  time: ReactNode;
  timeProps?: TimeHTMLAttributes<HTMLTimeElement>;
  title: ReactNode;
}

export function TimelineItem({
  className,
  description,
  metadata,
  time,
  timeProps,
  title,
  ...props
}: TimelineItemProps) {
  return (
    <li
      className={classNames(
        "ui:flex ui:flex-col ui:gap-xs ui:border-b ui:border-border ui:py-sm ui:last:border-b-0 ui:sm:flex-row ui:sm:gap-md",
        className,
      )}
      {...props}
    >
      <time
        className="ui:w-28 ui:shrink-0 ui:font-mono ui:text-caption ui:tabular-nums ui:text-foreground-muted"
        {...timeProps}
      >
        {time}
      </time>
      <div className="ui:grid ui:min-w-0 ui:flex-1 ui:gap-xxs">
        <div className="ui:font-sans ui:text-body-sm ui:font-semibold ui:text-foreground-strong">
          {title}
        </div>
        {description ? (
          <div className="ui:font-sans ui:text-body-sm ui:text-foreground">
            {description}
          </div>
        ) : null}
        {metadata ? (
          <div className="ui:font-sans ui:text-caption ui:text-foreground-muted">
            {metadata}
          </div>
        ) : null}
      </div>
    </li>
  );
}
