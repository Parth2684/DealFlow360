"use client";

import {
  NotificationDtoSchema,
  RealtimeInvalidationEventDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  formatDateTime,
  planApiRoutes,
  type CursorPage,
  type NotificationDto,
  type RealtimeInvalidationTopic,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  Drawer,
  EmptyState,
  ErrorFeedback,
  LiveRegion,
  Skeleton,
} from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { browserApiRequest } from "../../lib/api/browser";
import { useOrganizationFormatting } from "../foundation/organization-formatting";

const NotificationPageSchema = createCursorPageSchema(NotificationDtoSchema);

const queryPrefixesByTopic = {
  QUOTATIONS: ["quote", "quotes", "deal-timeline", "global-search"],
  APPROVALS: ["approval", "approvals"],
  FULFILLMENT: ["order", "allocation", "shipments", "backorders"],
  INVENTORY: ["allocation-inventory", "inventory", "product-picker"],
  NEGOTIATION: ["negotiation", "deal-timeline"],
  BILLING: ["order-billing", "billing-ledger", "order", "subscriptions"],
  INSIGHTS: ["deal-health", "deal-health-alerts"],
  REPORTING: ["report-summary", "report-exports"],
} as const satisfies Record<RealtimeInvalidationTopic, readonly string[]>;

export function NotificationCenter({ cacheScope }: { cacheScope: string }) {
  const { locale, timezone } = useOrganizationFormatting();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const notificationQueryKey = useMemo(
    () => ["notifications", cacheScope] as const,
    [cacheScope],
  );
  const notifications = useQuery({
    queryFn: ({ signal }) =>
      browserApiRequest(`${apiRoutes.notifications.list}?limit=25`, {
        schema: NotificationPageSchema,
        signal,
      }),
    queryKey: notificationQueryKey,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const stream = new EventSource(planApiRoutes.events.stream, {
      withCredentials: true,
    });
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackAttempts = 0;

    function refreshAuthoritativeState(prefixes?: ReadonlySet<string>) {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          if (!prefixes) return true;
          const prefix = query.queryKey[0];
          return typeof prefix === "string" && prefixes.has(prefix);
        },
      });
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    }

    function scheduleFallbackRefresh() {
      if (fallbackTimer !== undefined || fallbackAttempts >= 8) return;
      fallbackTimer = setTimeout(() => {
        fallbackTimer = undefined;
        fallbackAttempts += 1;
        refreshAuthoritativeState();
        scheduleFallbackRefresh();
      }, 15_000);
    }

    function receive(event: MessageEvent<string>) {
      try {
        const parsed = NotificationDtoSchema.safeParse(
          JSON.parse(event.data) as unknown,
        );
        if (!parsed.success) return;

        queryClient.setQueryData<CursorPage<NotificationDto>>(
          notificationQueryKey,
          (current) => {
            if (!current) {
              return {
                items: [parsed.data],
                pageInfo: { hasNextPage: false, nextCursor: null },
              };
            }
            if (current.items.some((item) => item.id === parsed.data.id)) {
              return current;
            }
            return {
              ...current,
              items: [parsed.data, ...current.items].slice(0, 25),
            };
          },
        );
        setLiveMessage(`New notification: ${parsed.data.title}`);
      } catch {
        // The list query remains authoritative when an event cannot be decoded.
      }
    }

    function receiveDomainChange(event: MessageEvent<string>) {
      try {
        const parsed = RealtimeInvalidationEventDtoSchema.safeParse(
          JSON.parse(event.data) as unknown,
        );
        if (!parsed.success) return;
        const prefixes = new Set<string>(
          parsed.data.topics.flatMap((topic) => queryPrefixesByTopic[topic]),
        );
        refreshAuthoritativeState(prefixes);
      } catch {
        // The next server render and query refetch remain authoritative.
      }
    }

    function receiveOpen() {
      fallbackAttempts = 0;
      if (fallbackTimer !== undefined) {
        clearTimeout(fallbackTimer);
        fallbackTimer = undefined;
      }
      refreshAuthoritativeState();
    }

    function receiveError() {
      scheduleFallbackRefresh();
    }

    stream.addEventListener("notification", receive);
    stream.addEventListener("domain-change", receiveDomainChange);
    stream.addEventListener("open", receiveOpen);
    stream.addEventListener("error", receiveError);
    return () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
      stream.removeEventListener("notification", receive);
      stream.removeEventListener("domain-change", receiveDomainChange);
      stream.removeEventListener("open", receiveOpen);
      stream.removeEventListener("error", receiveError);
      stream.close();
    };
  }, [notificationQueryKey, queryClient, router]);

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      browserApiRequest(apiRoutes.notifications.read(notificationId), {
        json: {},
        method: "POST",
        schema: NotificationDtoSchema,
        scope: "internal",
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<CursorPage<NotificationDto>>(
        notificationQueryKey,
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              }
            : current,
      );
      setLiveMessage("Notification marked as read.");
    },
  });

  const unreadCount = useMemo(
    () =>
      notifications.data?.items.filter((item) => item.readAt === null).length ??
      0,
    [notifications.data],
  );

  return (
    <>
      <Button
        aria-label={`Notifications, ${unreadCount} unread`}
        onClick={() => setOpen(true)}
        size="compact"
        variant="quiet"
      >
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 sm:hidden"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M6.75 9.75a5.25 5.25 0 0 1 10.5 0c0 3.1.66 4.9 1.28 5.9a.75.75 0 0 1-.64 1.15H6.11a.75.75 0 0 1-.64-1.15c.62-1 1.28-2.8 1.28-5.9Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
          <path
            d="M10 19.5a2.25 2.25 0 0 0 4 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 ? <Badge tone="brand">{unreadCount}</Badge> : null}
      </Button>
      <Drawer
        closeLabel="Close Notifications"
        description="Approvals, customer responses, inventory changes, and billing events."
        onOpenChange={setOpen}
        open={open}
        title="Notifications"
      >
        <div className="grid gap-md">
          {notifications.isPending ? (
            <div aria-busy="true" className="grid gap-sm" role="status">
              <Skeleton className="w-full" />
              <Skeleton className="w-4/5" />
              <Skeleton className="w-3/4" />
              <span className="sr-only">Loading notifications…</span>
            </div>
          ) : null}
          {notifications.isError ? (
            <ErrorFeedback title="Notifications Unavailable">
              Check the API status, then reload notifications.
            </ErrorFeedback>
          ) : null}
          {markRead.isError ? (
            <ErrorFeedback title="Notification Not Updated">
              The read state could not be saved. Try again.
            </ErrorFeedback>
          ) : null}
          {notifications.data?.items.length === 0 ? (
            <EmptyState
              description="New approvals, customer responses, inventory changes, and billing events will appear here."
              headingLevel="h2"
              title="No Notifications"
            />
          ) : null}
          {notifications.data && notifications.data.items.length > 0 ? (
            <ol className="m-0 grid list-none gap-xxs p-0">
              {notifications.data.items.map((notification) => (
                <li
                  className={
                    notification.readAt === null
                      ? "grid gap-xs border-b border-border bg-brand-subtle px-sm py-sm last:border-b-0"
                      : "grid gap-xs border-b border-border px-sm py-sm last:border-b-0"
                  }
                  key={notification.id}
                >
                  <div className="flex min-w-0 items-start justify-between gap-xs">
                    <strong className="min-w-0 break-words text-body-sm text-foreground-strong">
                      {notification.title}
                    </strong>
                    <Badge
                      tone={notification.readAt === null ? "brand" : "neutral"}
                    >
                      {notification.readAt === null ? "Unread" : "Read"}
                    </Badge>
                  </div>
                  <p className="m-0 break-words text-body-sm text-foreground">
                    {notification.body}
                  </p>
                  {notification.type === "CUSTOMER_ACCESS_REQUESTED" ? (
                    <ButtonLink
                      href="/settings/customer-requests"
                      variant="quiet"
                      onClick={() => setOpen(false)}
                    >
                      Review Customer Requests
                    </ButtonLink>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-xs">
                    <time
                      className="font-mono text-caption tabular-nums text-foreground-muted"
                      dateTime={notification.createdAt}
                    >
                      {formatDateTime(notification.createdAt, locale, timezone)}
                    </time>
                    {notification.readAt === null ? (
                      <Button
                        disabled={
                          markRead.isPending &&
                          markRead.variables === notification.id
                        }
                        onClick={() => markRead.mutate(notification.id)}
                        size="compact"
                        variant="quiet"
                      >
                        {markRead.isPending &&
                        markRead.variables === notification.id
                          ? "Saving…"
                          : "Mark Read"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </Drawer>
      <LiveRegion message={liveMessage} />
    </>
  );
}
