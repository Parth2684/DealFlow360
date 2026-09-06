import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./class-names.js";
import { ICON_WEIGHT } from "./icons.js";

export type FeedbackTone =
  "neutral" | "info" | "success" | "warning" | "danger";

const feedbackClassNames: Record<FeedbackTone, string> = {
  danger: "ui:border-danger ui:bg-danger-subtle ui:text-danger",
  info: "ui:border-info ui:bg-info-subtle ui:text-info",
  neutral: "ui:border-border-strong ui:bg-surface-subtle ui:text-foreground",
  success: "ui:border-success ui:bg-success-subtle ui:text-success",
  warning: "ui:border-warning ui:bg-warning-subtle ui:text-warning",
};

function FeedbackIcon({ tone }: { tone: FeedbackTone }) {
  const iconProps = {
    "aria-hidden": true,
    className: "ui:size-md ui:shrink-0",
    weight: ICON_WEIGHT,
  } as const;

  switch (tone) {
    case "danger":
      return <WarningCircleIcon {...iconProps} />;
    case "info":
      return <InfoIcon {...iconProps} />;
    case "success":
      return <CheckCircleIcon {...iconProps} />;
    case "warning":
      return <WarningIcon {...iconProps} />;
    default:
      return <InfoIcon {...iconProps} />;
  }
}

export interface InlineFeedbackProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: ReactNode;
  tone?: FeedbackTone;
}

export function InlineFeedback({
  children,
  className,
  title,
  tone = "neutral",
  ...props
}: InlineFeedbackProps) {
  return (
    <div
      className={classNames(
        "ui:flex ui:items-start ui:gap-sm ui:rounded-control ui:border ui:px-sm ui:py-xs ui:font-sans ui:text-body-sm",
        feedbackClassNames[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
      {...props}
    >
      <FeedbackIcon tone={tone} />
      <div className="ui:grid ui:min-w-0 ui:gap-xxs ui:break-words">
        {title ? <strong className="ui:font-semibold">{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  action?: ReactNode;
  description: ReactNode;
  headingLevel?: "h2" | "h3" | "h4";
  icon?: ReactNode;
  title: ReactNode;
}

export function EmptyState({
  action,
  className,
  description,
  headingLevel: Heading = "h2",
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={classNames(
        "ui:grid ui:justify-items-start ui:gap-sm ui:rounded-panel ui:border ui:border-dashed ui:border-border-strong ui:bg-surface ui:px-lg ui:py-xl ui:text-left",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="ui:text-brand" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="ui:grid ui:gap-xxs">
        <Heading className="ui:m-0 ui:scroll-mt-24 ui:text-balance ui:font-sans ui:text-title ui:font-semibold ui:text-foreground-strong">
          {title}
        </Heading>
        <div className="ui:max-w-reading ui:text-pretty ui:font-sans ui:text-body-sm ui:text-foreground-muted">
          {description}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export type SkeletonShape = "line" | "block" | "avatar";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: SkeletonShape;
}

const skeletonShapeClassNames: Record<SkeletonShape, string> = {
  avatar: "ui:size-touch ui:rounded-pill",
  block: "ui:h-24 ui:w-full ui:rounded-panel",
  line: "ui:h-sm ui:w-full ui:rounded-control",
};

export function Skeleton({
  className,
  shape = "line",
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={classNames(
        "ui:animate-pulse ui:bg-surface-disabled ui:motion-reduce:animate-none",
        skeletonShapeClassNames[shape],
        className,
      )}
      {...props}
    />
  );
}

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  rows?: number;
}

const lineWidthClassNames = ["ui:w-full", "ui:w-5/6", "ui:w-2/3"] as const;

export function LoadingState({
  className,
  label = "Loading Content…",
  rows = 3,
  ...props
}: LoadingStateProps) {
  return (
    <div
      aria-busy="true"
      className={classNames("ui:grid ui:gap-sm", className)}
      role="status"
      {...props}
    >
      <span className="ui:sr-only">{label}</span>
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <div className="ui:grid ui:gap-xs" key={index}>
          <Skeleton
            className={lineWidthClassNames[index % lineWidthClassNames.length]}
          />
          <Skeleton className="ui:w-full" />
        </div>
      ))}
    </div>
  );
}

export interface LiveRegionProps extends HTMLAttributes<HTMLDivElement> {
  message: ReactNode;
  politeness?: "polite" | "assertive";
}

export function LiveRegion({
  className,
  message,
  politeness = "polite",
  ...props
}: LiveRegionProps) {
  return (
    <div
      aria-atomic="true"
      aria-live={politeness}
      className={classNames("ui:sr-only", className)}
      {...props}
    >
      {message}
    </div>
  );
}

export type ErrorFeedbackProps = Omit<InlineFeedbackProps, "tone">;

export function ErrorFeedback(props: ErrorFeedbackProps) {
  return <InlineFeedback tone="danger" {...props} />;
}
