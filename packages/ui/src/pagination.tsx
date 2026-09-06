import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import type { HTMLAttributes, ReactNode } from "react";
import { ButtonLink } from "./button.js";
import { classNames } from "./class-names.js";
import { ICON_WEIGHT } from "./icons.js";

export interface PaginationProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label"
> {
  "aria-label"?: string;
  nextHref?: string;
  nextLabel?: string;
  previousHref?: string;
  previousLabel?: string;
  status: ReactNode;
}

const disabledLinkClassName =
  "ui:inline-flex ui:min-h-touch ui:items-center ui:gap-xs ui:rounded-control ui:border ui:border-border ui:bg-surface-disabled ui:px-sm ui:py-xs ui:font-sans ui:text-body-sm ui:font-semibold ui:text-foreground-disabled";

export function Pagination({
  "aria-label": label = "Pagination",
  className,
  nextHref,
  nextLabel = "Next",
  previousHref,
  previousLabel = "Previous",
  status,
  ...props
}: PaginationProps) {
  return (
    <nav
      aria-label={label}
      className={classNames(
        "ui:flex ui:flex-wrap ui:items-center ui:justify-between ui:gap-sm",
        className,
      )}
      {...props}
    >
      {previousHref ? (
        <ButtonLink href={previousHref} size="compact">
          <CaretLeftIcon
            aria-hidden="true"
            className="ui:size-md"
            weight={ICON_WEIGHT}
          />
          {previousLabel}
        </ButtonLink>
      ) : (
        <span aria-disabled="true" className={disabledLinkClassName}>
          <CaretLeftIcon
            aria-hidden="true"
            className="ui:size-md"
            weight={ICON_WEIGHT}
          />
          {previousLabel}
        </span>
      )}

      <span className="ui:font-mono ui:text-caption ui:tabular-nums ui:text-foreground-muted">
        {status}
      </span>

      {nextHref ? (
        <ButtonLink href={nextHref} size="compact">
          {nextLabel}
          <CaretRightIcon
            aria-hidden="true"
            className="ui:size-md"
            weight={ICON_WEIGHT}
          />
        </ButtonLink>
      ) : (
        <span aria-disabled="true" className={disabledLinkClassName}>
          {nextLabel}
          <CaretRightIcon
            aria-hidden="true"
            className="ui:size-md"
            weight={ICON_WEIGHT}
          />
        </span>
      )}
    </nav>
  );
}
