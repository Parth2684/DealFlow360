import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { classNames } from "./class-names.js";

export interface DataTableProps extends Omit<
  TableHTMLAttributes<HTMLTableElement>,
  "aria-label"
> {
  "aria-label": string;
  containerClassName?: string;
}

export function DataTable({
  className,
  containerClassName,
  ...props
}: DataTableProps) {
  return (
    <div
      aria-label={props["aria-label"]}
      className={classNames(
        "ui:w-full ui:overflow-x-auto ui:overscroll-x-contain ui:rounded-panel ui:border ui:border-border ui:bg-surface ui:shadow-panel ui:focus-visible:outline-2 ui:focus-visible:outline-offset-2 ui:focus-visible:outline-focus",
        containerClassName,
      )}
      role="region"
      tabIndex={0}
    >
      <table
        className={classNames(
          "ui:w-full ui:border-collapse ui:font-sans ui:text-body-sm ui:text-foreground",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export type DataTableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;

export function DataTableHeader({ className, ...props }: DataTableHeaderProps) {
  return (
    <thead
      className={classNames(
        "ui:border-b ui:border-border ui:bg-surface-subtle",
        className,
      )}
      {...props}
    />
  );
}

export type DataTableBodyProps = HTMLAttributes<HTMLTableSectionElement>;

export function DataTableBody({ className, ...props }: DataTableBodyProps) {
  return (
    <tbody
      className={classNames("ui:divide-y ui:divide-border", className)}
      {...props}
    />
  );
}

export type DataTableRowProps = HTMLAttributes<HTMLTableRowElement>;

export function DataTableRow({ className, ...props }: DataTableRowProps) {
  return (
    <tr
      className={classNames(
        "ui:transition-colors ui:duration-150 ui:ease-product ui:hover:bg-surface-subtle",
        className,
      )}
      {...props}
    />
  );
}

export interface DataTableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function DataTableHead({
  className,
  numeric = false,
  scope = "col",
  ...props
}: DataTableHeadProps) {
  return (
    <th
      className={classNames(
        "ui:px-sm ui:py-sm ui:text-left ui:text-caption ui:font-semibold ui:uppercase ui:tracking-wide ui:text-foreground-muted",
        numeric && "ui:text-right ui:font-mono ui:tabular-nums",
        className,
      )}
      scope={scope}
      {...props}
    />
  );
}

export interface DataTableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function DataTableCell({
  className,
  numeric = false,
  ...props
}: DataTableCellProps) {
  return (
    <td
      className={classNames(
        "ui:px-sm ui:py-sm ui:align-middle ui:break-words",
        numeric && "ui:text-right ui:font-mono ui:tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export interface DataTableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {
  visuallyHidden?: boolean;
}

export function DataTableCaption({
  className,
  visuallyHidden = false,
  ...props
}: DataTableCaptionProps) {
  return (
    <caption
      className={classNames(
        "ui:px-sm ui:py-xs ui:text-left ui:text-caption ui:text-foreground-muted",
        visuallyHidden && "ui:sr-only",
        className,
      )}
      {...props}
    />
  );
}

export interface DataTableEmptyRowProps extends TdHTMLAttributes<HTMLTableCellElement> {
  colSpan: number;
}

export function DataTableEmptyRow({
  children,
  className,
  ...props
}: DataTableEmptyRowProps) {
  return (
    <tr>
      <td
        className={classNames(
          "ui:px-md ui:py-xl ui:text-center ui:text-body-sm ui:text-foreground-muted",
          className,
        )}
        {...props}
      >
        {children}
      </td>
    </tr>
  );
}
