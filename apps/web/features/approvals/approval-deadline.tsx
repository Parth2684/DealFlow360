"use client";

import { formatDateTime } from "@repo/common";
import { useEffect, useState } from "react";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";

function durationLabel(milliseconds: number): string {
  const absoluteMinutes = Math.max(
    1,
    Math.ceil(Math.abs(milliseconds) / 60_000),
  );
  const days = Math.floor(absoluteMinutes / (24 * 60));
  const hours = Math.floor((absoluteMinutes % (24 * 60)) / 60);
  const minutes = absoluteMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function ApprovalDeadline({
  dueAt,
  timeZone,
}: {
  dueAt: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, []);

  const dueTime = Date.parse(dueAt);
  const remaining = now === null ? null : dueTime - now;
  const countdown =
    remaining === null
      ? "Calculating remaining time…"
      : remaining <= 0
        ? `Overdue by ${durationLabel(remaining)}`
        : `${durationLabel(remaining)} remaining`;

  return (
    <span className="grid gap-xxs">
      <time dateTime={dueAt}>{formatDateTime(dueAt, locale, timeZone)}</time>
      <span
        className={
          remaining !== null && remaining <= 0
            ? "font-semibold text-danger"
            : "text-foreground-muted"
        }
      >
        {countdown}
      </span>
    </span>
  );
}
