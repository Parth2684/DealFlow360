type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "coral";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-card text-body-strong",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-[#8a6b0f]",
  error: "bg-error/10 text-error",
  info: "bg-accent-teal/15 text-[#356a60]",
  coral: "bg-primary text-on-primary",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const STAGE_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  READY_TO_SEND: "info",
  SENT: "info",
  UNDER_NEGOTIATION: "warning",
  CUSTOMER_ACCEPTED: "success",
  CONFIRMED: "success",
  REVISION_REQUIRED: "error",
  EXPIRED: "error",
  CANCELLED: "error",
  PENDING: "warning",
  IN_PROGRESS: "info",
  APPROVED: "success",
  REJECTED: "error",
  REVISION_REQUESTED: "warning",
  SUPERSEDED: "neutral",
  ACTIVE: "success",
  PAST_DUE: "warning",
  PAUSED: "warning",
  CANCELLED_SUB: "error",
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
  VOID: "neutral",
  ALLOCATING: "warning",
  FULFILLING: "info",
  FULFILLED: "success",
  OPEN: "warning",
  PARTIALLY_FULFILLED: "warning",
  SHIPPED: "info",
  DELIVERED: "success",
  COMPLETED: "success",
  FAILED: "error",
  PROCESSING: "info",
  CRITICAL: "error",
  WARNING: "warning",
  INFO: "info",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STAGE_TONE[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Badge>;
}
