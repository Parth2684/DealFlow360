"use client";

import type { OrganizationFormatting } from "@repo/common";
import { Badge, Button, LiveRegion } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { SystemHealthState } from "../../lib/auth/session";

const statusLabels: Record<SystemHealthState["status"], string> = {
  degraded: "API Degraded",
  offline: "API Offline",
  ok: "API Available",
};

function checkedAtLabel(
  value: string,
  formatting: OrganizationFormatting,
): string {
  return new Intl.DateTimeFormat(formatting.locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: formatting.timezone,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function SystemStatus({
  formatting,
  health,
}: {
  formatting?: OrganizationFormatting;
  health: SystemHealthState;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const tone =
    health.status === "ok"
      ? "success"
      : health.status === "degraded"
        ? "warning"
        : "danger";

  return (
    <div className="flex min-w-0 items-center gap-xs">
      <div className="min-w-0 text-right">
        <Badge tone={tone}>{statusLabels[health.status]}</Badge>
        {formatting ? (
          <p className="m-0 hidden truncate font-mono text-caption tabular-nums text-foreground-muted xl:block">
            Checked {checkedAtLabel(health.checkedAt, formatting)}
          </p>
        ) : null}
      </div>
      <Button
        disabled={isRefreshing}
        onClick={() => startRefresh(() => router.refresh())}
        size="compact"
        variant="quiet"
      >
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </Button>
      <LiveRegion message={isRefreshing ? "Refreshing workspace…" : ""} />
    </div>
  );
}
