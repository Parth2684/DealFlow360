import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./class-names.js";

export interface PageHeaderProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "title"
> {
  actions?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  title: ReactNode;
}

export function PageHeader({
  actions,
  className,
  description,
  metadata,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={classNames(
        "ui:grid ui:gap-sm ui:border-b ui:border-border ui:pb-md ui:sm:grid-cols-2 ui:sm:items-end",
        className,
      )}
      {...props}
    >
      <div className="ui:grid ui:min-w-0 ui:gap-xs">
        <h1 className="ui:m-0 ui:scroll-mt-24 ui:text-balance ui:font-sans ui:text-heading ui:font-semibold ui:text-foreground-strong">
          {title}
        </h1>
        {description ? (
          <div className="ui:max-w-reading ui:text-pretty ui:font-sans ui:text-body-sm ui:text-foreground-muted">
            {description}
          </div>
        ) : null}
        {metadata ? (
          <div className="ui:font-sans ui:text-caption ui:text-foreground-muted">
            {metadata}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="ui:flex ui:flex-wrap ui:items-center ui:gap-xs ui:sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
