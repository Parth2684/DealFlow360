import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { classNames } from "./class-names.js";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "compact" | "default";

const baseClassName =
  "ui:inline-flex ui:shrink-0 ui:touch-manipulation ui:items-center ui:justify-center ui:gap-xs ui:whitespace-nowrap ui:rounded-control ui:border ui:font-sans ui:font-semibold ui:transition-[background-color,border-color,color,box-shadow,transform] ui:duration-150 ui:ease-product ui:focus-visible:outline-2 ui:focus-visible:outline-offset-2 ui:focus-visible:outline-focus ui:active:translate-y-px ui:disabled:pointer-events-none ui:disabled:border-transparent ui:disabled:bg-surface-disabled ui:disabled:text-foreground-disabled ui:disabled:opacity-100 ui:disabled:shadow-none";

const variantClassNames: Record<ButtonVariant, string> = {
  danger:
    "ui:border-danger/60 ui:bg-danger-subtle ui:text-danger ui:shadow-sm ui:hover:border-danger ui:hover:bg-danger ui:hover:text-on-brand ui:active:bg-danger ui:active:shadow-none",
  primary:
    "ui:border-brand ui:bg-brand ui:text-on-brand ui:shadow-sm ui:hover:border-brand-hover ui:hover:bg-brand-hover ui:hover:shadow-panel ui:active:border-brand-active ui:active:bg-brand-active ui:active:shadow-none",
  quiet:
    "ui:border-transparent ui:bg-transparent ui:text-foreground-muted ui:hover:bg-surface-subtle ui:hover:text-foreground-strong ui:active:bg-surface-hover",
  secondary:
    "ui:border-border-strong ui:bg-surface ui:text-foreground-strong ui:shadow-sm ui:hover:border-foreground-muted ui:hover:bg-surface-subtle ui:active:bg-surface-hover ui:active:shadow-none",
};

const sizeClassNames: Record<ButtonSize, string> = {
  compact: "ui:min-h-control ui:px-sm ui:py-xxs ui:text-caption",
  default: "ui:min-h-touch ui:px-md ui:py-xs ui:text-body-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  fullWidth = false,
  size = "default",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames(
        baseClassName,
        variantClassNames[variant],
        sizeClassNames[size],
        fullWidth && "ui:w-full",
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  fullWidth?: boolean;
  href: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function ButtonLink({
  children,
  className,
  fullWidth = false,
  size = "default",
  variant = "secondary",
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={classNames(
        baseClassName,
        variantClassNames[variant],
        sizeClassNames[size],
        fullWidth && "ui:w-full",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  "aria-label": string;
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function IconButton({
  children,
  className,
  size = "default",
  type = "button",
  variant = "quiet",
  ...props
}: IconButtonProps) {
  return (
    <button
      className={classNames(
        baseClassName,
        variantClassNames[variant],
        size === "compact" ? "ui:size-control" : "ui:size-touch",
        "ui:p-0",
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
