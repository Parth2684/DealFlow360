import {
  forwardRef,
  type FieldsetHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { classNames } from "./class-names.js";

const controlClassName =
  "ui:w-full ui:touch-manipulation ui:rounded-control ui:border ui:border-border-strong ui:bg-surface ui:px-sm ui:py-xs ui:font-sans ui:text-body-sm ui:text-foreground-strong ui:shadow-sm ui:placeholder:text-foreground-muted ui:transition-[border-color,box-shadow,background-color] ui:duration-150 ui:ease-product ui:hover:border-foreground-muted ui:focus:border-focus ui:focus:shadow-none ui:focus:ring-2 ui:focus:ring-focus/25 ui:focus:outline-none ui:focus-visible:outline-2 ui:focus-visible:outline-offset-2 ui:focus-visible:outline-focus ui:aria-invalid:border-danger ui:aria-invalid:ring-danger/25 ui:aria-invalid:outline-danger ui:disabled:cursor-not-allowed ui:disabled:border-border ui:disabled:bg-surface-disabled ui:disabled:text-foreground-disabled ui:disabled:shadow-none";

export type FieldProps = HTMLAttributes<HTMLDivElement>;

export function Field({ className, ...props }: FieldProps) {
  return (
    <div className={classNames("ui:grid ui:gap-xs", className)} {...props} />
  );
}

export type FieldGroupProps = FieldsetHTMLAttributes<HTMLFieldSetElement>;

export function FieldGroup({ className, ...props }: FieldGroupProps) {
  return (
    <fieldset
      className={classNames(
        "ui:grid ui:min-w-0 ui:gap-md ui:border-0 ui:p-0",
        className,
      )}
      {...props}
    />
  );
}

export type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <label
      className={classNames(
        "ui:font-sans ui:text-body-sm ui:font-semibold ui:text-foreground-strong",
        className,
      )}
      {...props}
    />
  );
}

export type FieldLegendProps = HTMLAttributes<HTMLLegendElement>;

export function FieldLegend({ className, ...props }: FieldLegendProps) {
  return (
    <legend
      className={classNames(
        "ui:mb-xs ui:font-sans ui:text-body-sm ui:font-semibold ui:text-foreground-strong",
        className,
      )}
      {...props}
    />
  );
}

export type FieldDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function FieldDescription({
  className,
  ...props
}: FieldDescriptionProps) {
  return (
    <p
      className={classNames(
        "ui:m-0 ui:font-sans ui:text-caption ui:text-foreground-muted",
        className,
      )}
      {...props}
    />
  );
}

export type FieldErrorProps = HTMLAttributes<HTMLParagraphElement>;

export function FieldError({ className, ...props }: FieldErrorProps) {
  return (
    <p
      className={classNames(
        "ui:m-0 ui:font-sans ui:text-caption ui:font-medium ui:text-danger",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      className={classNames(controlClassName, "ui:min-h-touch", className)}
      ref={ref}
      {...props}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        className={classNames(controlClassName, "ui:min-h-touch", className)}
        ref={ref}
        {...props}
      />
    );
  },
);

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return (
      <textarea
        className={classNames(
          controlClassName,
          "ui:min-h-24 ui:resize-y",
          className,
        )}
        ref={ref}
        rows={rows}
        {...props}
      />
    );
  },
);

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, type = "checkbox", ...props }, ref) {
    return (
      <input
        className={classNames(
          "ui:size-md ui:shrink-0 ui:touch-manipulation ui:rounded-control ui:border ui:border-border-strong ui:accent-brand ui:focus-visible:outline-2 ui:focus-visible:outline-offset-2 ui:focus-visible:outline-focus ui:disabled:cursor-not-allowed ui:disabled:opacity-60",
          className,
        )}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);

export interface CheckboxFieldProps extends Omit<
  HTMLAttributes<HTMLLabelElement>,
  "children"
> {
  checkbox: ReactNode;
  children: ReactNode;
  description?: ReactNode;
}

export function CheckboxField({
  checkbox,
  children,
  className,
  description,
  ...props
}: CheckboxFieldProps) {
  return (
    <label
      className={classNames(
        "ui:flex ui:min-h-touch ui:items-start ui:gap-sm ui:font-sans ui:text-body-sm ui:text-foreground-strong",
        className,
      )}
      {...props}
    >
      <span className="ui:pt-xxs">{checkbox}</span>
      <span className="ui:grid ui:gap-xxs">
        <span>{children}</span>
        {description ? (
          <span className="ui:text-caption ui:text-foreground-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
