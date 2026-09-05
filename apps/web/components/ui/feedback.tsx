import { Loader2, Inbox, AlertTriangle } from "lucide-react";

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-muted" />;
}

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Spinner size={16} />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Inbox size={28} className="mb-1 text-muted-soft" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <AlertTriangle size={28} className="mb-1 text-error" />
      <p className="text-sm font-medium text-ink">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {retry ? (
        <button onClick={retry} className="mt-2 text-sm font-medium text-primary hover:underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}
