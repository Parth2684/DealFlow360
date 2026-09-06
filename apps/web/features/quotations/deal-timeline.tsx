"use client";

import {
  DealEventDtoSchema,
  createCursorPageSchema,
  formatDateTime,
  formatEnumLabel,
  planApiRoutes,
  type CursorPage,
  type DealEventDto,
} from "@repo/common";
import {
  Badge,
  Button,
  EmptyState,
  ErrorFeedback,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Timeline,
  TimelineItem,
} from "@repo/ui";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { browserApiRequest } from "../../lib/api/browser";

const DealEventPageSchema = createCursorPageSchema(DealEventDtoSchema);

function timelinePath(quoteId: string, cursor?: string): string {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return `${planApiRoutes.quotes.timeline(quoteId)}?${query.toString()}`;
}

function visibilityTone(visibility: DealEventDto["visibility"]) {
  return visibility === "INTERNAL" ? ("neutral" as const) : ("info" as const);
}

function entityLabel(value: string): string {
  return formatEnumLabel(value.replace(/([a-z\d])([A-Z])/gu, "$1_$2"));
}

export function DealTimeline({
  initialPage,
  quoteId,
  refreshRevision,
  timeZone,
}: {
  initialPage?: CursorPage<DealEventDto>;
  quoteId: string;
  refreshRevision: number;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const timeline = useInfiniteQuery({
    initialPageParam: undefined as string | undefined,
    ...(initialPage
      ? {
          initialData: {
            pageParams: [undefined],
            pages: [initialPage],
          },
        }
      : {}),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage
        ? (lastPage.pageInfo.nextCursor ?? undefined)
        : undefined,
    queryFn: ({ pageParam, signal }) =>
      browserApiRequest(timelinePath(quoteId, pageParam), {
        schema: DealEventPageSchema,
        scope: "internal",
        signal,
      }),
    queryKey: ["deal-timeline", quoteId, refreshRevision],
    refetchInterval: 30_000,
  });
  const events = timeline.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Panel aria-busy={timeline.isFetching}>
      <PanelHeader>
        <div>
          <PanelTitle>Unified Deal Timeline</PanelTitle>
          <PanelDescription>
            Commercial, approval, customer, fulfillment, billing, and payment
            activity in one auditable sequence.
          </PanelDescription>
        </div>
        <Button
          disabled={timeline.isFetching}
          onClick={() => void timeline.refetch()}
          size="compact"
          variant="secondary"
        >
          {timeline.isFetching ? "Refreshing…" : "Refresh Activity"}
        </Button>
      </PanelHeader>
      <PanelBody className="grid gap-sm">
        {timeline.isError ? (
          <div className="grid justify-items-start gap-xs">
            <ErrorFeedback title="Timeline Unavailable">
              Deal activity could not be loaded. The quotation remains
              available.
            </ErrorFeedback>
            <Button
              onClick={() => void timeline.refetch()}
              size="compact"
              variant="secondary"
            >
              Retry
            </Button>
          </div>
        ) : null}
        {!timeline.isError && events.length === 0 ? (
          <EmptyState
            description="Material quotation activity will appear here as it is recorded."
            headingLevel="h3"
            title="No Deal Activity"
          />
        ) : null}
        {events.length > 0 ? (
          <Timeline aria-label="Unified deal activity">
            {events.map((event) => (
              <TimelineItem
                description={event.message ?? undefined}
                key={event.id}
                metadata={
                  <span className="flex flex-wrap items-center gap-xs">
                    <Badge tone={visibilityTone(event.visibility)}>
                      {formatEnumLabel(event.visibility)}
                    </Badge>
                    <span>
                      {event.actorName ?? formatEnumLabel(event.actorType)}
                    </span>
                    {event.sourceEntityType ? (
                      <span>
                        {entityLabel(event.sourceEntityType)}
                        {event.sourceVersion === null
                          ? ""
                          : ` version ${event.sourceVersion}`}
                      </span>
                    ) : null}
                  </span>
                }
                time={formatDateTime(event.occurredAt, locale, timeZone)}
                timeProps={{ dateTime: event.occurredAt }}
                title={event.title}
              />
            ))}
          </Timeline>
        ) : null}
        {timeline.hasNextPage ? (
          <Button
            disabled={timeline.isFetchingNextPage}
            onClick={() => void timeline.fetchNextPage()}
            size="compact"
            variant="secondary"
          >
            {timeline.isFetchingNextPage ? "Loading…" : "Load Earlier Activity"}
          </Button>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
