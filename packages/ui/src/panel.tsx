import type { HTMLAttributes } from "react";
import { classNames } from "./class-names.js";

export type PanelTone = "default" | "subtle" | "raised";

const toneClassNames: Record<PanelTone, string> = {
  default: "ui:border-border ui:bg-surface ui:shadow-panel",
  raised: "ui:border-border ui:bg-surface-raised ui:shadow-raised",
  subtle: "ui:border-border ui:bg-surface-subtle",
};

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  tone?: PanelTone;
}

export function Panel({ className, tone = "default", ...props }: PanelProps) {
  return (
    <section
      className={classNames(
        "ui:overflow-hidden ui:rounded-panel ui:border ui:text-foreground",
        toneClassNames[tone],
        className,
      )}
      {...props}
    />
  );
}

export type PanelHeaderProps = HTMLAttributes<HTMLDivElement>;

export function PanelHeader({ className, ...props }: PanelHeaderProps) {
  return (
    <div
      className={classNames(
        "ui:flex ui:flex-col ui:gap-xxs ui:border-b ui:border-border ui:px-md ui:py-sm ui:sm:flex-row ui:sm:items-start ui:sm:justify-between ui:sm:gap-md",
        className,
      )}
      {...props}
    />
  );
}

export interface PanelTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: "h2" | "h3" | "h4";
}

export function PanelTitle({
  as: Heading = "h2",
  className,
  ...props
}: PanelTitleProps) {
  return (
    <Heading
      className={classNames(
        "ui:m-0 ui:scroll-mt-24 ui:text-balance ui:font-sans ui:text-title ui:font-semibold ui:text-foreground-strong",
        className,
      )}
      {...props}
    />
  );
}

export type PanelDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function PanelDescription({
  className,
  ...props
}: PanelDescriptionProps) {
  return (
    <p
      className={classNames(
        "ui:m-0 ui:max-w-reading ui:font-sans ui:text-body-sm ui:text-foreground-muted",
        className,
      )}
      {...props}
    />
  );
}

export type PanelBodyProps = HTMLAttributes<HTMLDivElement>;

export function PanelBody({ className, ...props }: PanelBodyProps) {
  return (
    <div className={classNames("ui:px-md ui:py-md", className)} {...props} />
  );
}

export type PanelFooterProps = HTMLAttributes<HTMLDivElement>;

export function PanelFooter({ className, ...props }: PanelFooterProps) {
  return (
    <div
      className={classNames(
        "ui:flex ui:flex-wrap ui:items-center ui:justify-end ui:gap-xs ui:border-t ui:border-border ui:bg-surface-subtle ui:px-md ui:py-sm",
        className,
      )}
      {...props}
    />
  );
}
