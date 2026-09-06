"use client";

import {
  CreateQuoteSavedFilterRequestSchema,
  QuoteSavedFilterValueSchema,
  SavedReportFilterDtoSchema,
  SavedReportFilterPageDtoSchema,
  UpdateQuoteSavedFilterRequestSchema,
  planApiRoutes,
  type CursorPage,
  type QuoteSavedFilterValue,
  type SavedReportFilterDto,
} from "@repo/common";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
  Skeleton,
} from "@repo/ui";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

function savedFiltersPath(cursor?: string): string {
  const parameters = new URLSearchParams({ limit: "25" });
  if (cursor) parameters.set("cursor", cursor);
  return `${planApiRoutes.quotes.savedFilters}?${parameters.toString()}`;
}

function quotationListPath(
  filters: QuoteSavedFilterValue,
  destinationPath: string,
): string {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value) parameters.set(name, value);
  }
  const query = parameters.toString();
  return query ? `${destinationPath}?${query}` : destinationPath;
}

function problemMessage(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError
    ? (error.problem.detail ?? error.problem.title)
    : fallback;
}

export function QuoteSavedFilters({
  currentFilters,
  destinationPath = "/quotations",
  initialPage,
}: {
  currentFilters: QuoteSavedFilterValue;
  destinationPath?: "/pipeline" | "/quotations";
  initialPage?: CursorPage<SavedReportFilterDto>;
}) {
  const { locale } = useOrganizationFormatting();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "danger" | "info" | "success" | "warning"
  >("info");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const savedFilters = useInfiniteQuery({
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
      browserApiRequest(savedFiltersPath(pageParam), {
        schema: SavedReportFilterPageDtoSchema,
        scope: "internal",
        signal,
      }),
    queryKey: ["quote-saved-filters"],
  });
  const filters = savedFilters.data?.pages.flatMap((page) => page.items) ?? [];
  const selected = filters.find((filter) => filter.id === selectedId);

  const createFilter = useMutation({
    mutationFn: (input: z.infer<typeof CreateQuoteSavedFilterRequestSchema>) =>
      browserApiRequest(planApiRoutes.quotes.savedFilters, {
        json: input,
        method: "POST",
        schema: SavedReportFilterDtoSchema,
        scope: "internal",
      }),
    onError: (error) => {
      setMessageTone("danger");
      setMessage(
        problemMessage(error, "The quotation filter could not be saved."),
      );
    },
    onSuccess: async (created) => {
      setSelectedId(created.id);
      setName(created.name);
      setReviewRequired(false);
      setMessageTone("success");
      setMessage(`Saved quotation filter ${created.name}.`);
      await queryClient.invalidateQueries({
        queryKey: ["quote-saved-filters"],
      });
    },
  });

  const updateFilter = useMutation({
    mutationFn: ({
      filter,
      input,
    }: {
      filter: SavedReportFilterDto;
      input: z.infer<typeof UpdateQuoteSavedFilterRequestSchema>;
    }) =>
      browserApiRequest(planApiRoutes.quotes.savedFilter(filter.id), {
        json: input,
        method: "PATCH",
        schema: SavedReportFilterDtoSchema,
        scope: "internal",
      }),
    onError: async (error) => {
      setMessageTone("danger");
      if (
        error instanceof ApiProblemError &&
        error.problem.code === "STALE_SAVED_FILTER"
      ) {
        const refreshed = await savedFilters.refetch();
        const latest = refreshed.data?.pages
          .flatMap((page) => page.items)
          .find((filter) => filter.id === selectedId);
        if (latest) setName(latest.name);
        setReviewRequired(true);
        setMessageTone("warning");
        setMessage(
          refreshed.isError
            ? "This saved filter changed elsewhere, but the latest copy could not be reloaded. Refresh the page before updating."
            : "This saved filter changed elsewhere. Load the refreshed copy and review it before updating.",
        );
        return;
      }
      setMessage(
        problemMessage(error, "The quotation filter could not be updated."),
      );
    },
    onSuccess: async (updated) => {
      setName(updated.name);
      setReviewRequired(false);
      setMessageTone("success");
      setMessage(`Updated quotation filter ${updated.name}.`);
      await queryClient.invalidateQueries({
        queryKey: ["quote-saved-filters"],
      });
    },
  });

  const deleteFilter = useMutation({
    mutationFn: (filter: SavedReportFilterDto) =>
      browserApiRequest(planApiRoutes.quotes.savedFilter(filter.id), {
        method: "DELETE",
        schema: z.undefined(),
        scope: "internal",
      }),
    onError: (error) => {
      setMessageTone("danger");
      setMessage(
        problemMessage(error, "The quotation filter could not be deleted."),
      );
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      setSelectedId("");
      setName("");
      setReviewRequired(false);
      setMessageTone("success");
      setMessage("Deleted the saved quotation filter.");
      await queryClient.invalidateQueries({
        queryKey: ["quote-saved-filters"],
      });
    },
  });

  const busy =
    createFilter.isPending || updateFilter.isPending || deleteFilter.isPending;

  function saveNew() {
    const parsed = CreateQuoteSavedFilterRequestSchema.safeParse({
      filters: currentFilters,
      name,
    });
    if (!parsed.success) {
      setMessageTone("danger");
      setMessage(parsed.error.issues[0]?.message ?? "Enter a filter name.");
      return;
    }
    createFilter.mutate(parsed.data);
  }

  function loadSelected() {
    if (!selected) return;
    const parsed = QuoteSavedFilterValueSchema.safeParse(selected.filters);
    if (!parsed.success) {
      setMessageTone("danger");
      setMessage(
        "This saved filter is no longer valid. Delete it or update it with the current filters.",
      );
      return;
    }
    setName(selected.name);
    setReviewRequired(false);
    setMessageTone("success");
    setMessage(`Loaded quotation filter ${selected.name}.`);
    router.push(quotationListPath(parsed.data, destinationPath));
  }

  function updateSelected() {
    if (!selected) return;
    if (reviewRequired) {
      setMessageTone("warning");
      setMessage("Load and review the refreshed filter before updating it.");
      return;
    }
    const parsed = UpdateQuoteSavedFilterRequestSchema.safeParse({
      filters: currentFilters,
      name: name || selected.name,
      updatedAt: selected.updatedAt,
    });
    if (!parsed.success) {
      setMessageTone("danger");
      setMessage(
        parsed.error.issues[0]?.message ??
          "The current quotation filters are invalid.",
      );
      return;
    }
    updateFilter.mutate({ filter: selected, input: parsed.data });
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Saved Quotation Filters</PanelTitle>
          <PanelDescription>
            Store personal list views on the server and restore them from any
            signed-in browser.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-sm">
        <LiveRegion message={message} />
        {message ? (
          <InlineFeedback tone={messageTone}>{message}</InlineFeedback>
        ) : null}
        {savedFilters.isPending ? (
          <div aria-busy="true" className="grid gap-xs" role="status">
            <Skeleton className="w-2/5" />
            <Skeleton className="w-full" />
            <span className="sr-only">Loading saved quotation filters…</span>
          </div>
        ) : null}
        {savedFilters.isError ? (
          <ErrorFeedback title="Saved Filters Are Unavailable">
            Refresh after the quotation service recovers.
          </ErrorFeedback>
        ) : null}
        <div className="grid gap-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <Field>
            <FieldLabel htmlFor="quote-saved-filter">Saved Filter</FieldLabel>
            <Select
              id="quote-saved-filter"
              name="quoteSavedFilter"
              onChange={(event) => {
                const nextId = event.target.value;
                const next = filters.find((filter) => filter.id === nextId);
                setSelectedId(nextId);
                setName(next?.name ?? "");
                setReviewRequired(false);
              }}
              value={selectedId}
            >
              <option value="">Select a Saved Filter</option>
              {filters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="quote-saved-filter-name">
              Filter Name
            </FieldLabel>
            <Input
              autoComplete="off"
              id="quote-saved-filter-name"
              maxLength={120}
              name="quoteSavedFilterName"
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Active enterprise renewals…"
              value={name}
            />
          </Field>
          <div className="flex flex-wrap gap-xs">
            <Button
              disabled={!selected || busy}
              onClick={loadSelected}
              variant="secondary"
            >
              Load
            </Button>
            <Button disabled={!name.trim() || busy} onClick={saveNew}>
              {createFilter.isPending ? "Saving…" : "Save New"}
            </Button>
            <Button
              disabled={!selected || busy || reviewRequired}
              onClick={updateSelected}
              variant="secondary"
            >
              {updateFilter.isPending ? "Updating…" : "Update"}
            </Button>
            <Button
              disabled={!selected || busy}
              onClick={() => setDeleteOpen(true)}
              variant="danger"
            >
              Delete
            </Button>
          </div>
        </div>
        {filters.length === 0 && !savedFilters.isPending ? (
          <EmptyState
            description="Choose quotation filters above, enter a name, then save this view."
            headingLevel="h3"
            title="No Saved Quotation Filters"
          />
        ) : null}
        {filters.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-xs border-t border-border pt-sm">
            <span className="font-mono text-caption tabular-nums text-foreground-muted">
              {filters.length.toLocaleString(locale)} filters loaded
            </span>
            {savedFilters.hasNextPage ? (
              <Button
                disabled={savedFilters.isFetchingNextPage}
                onClick={() => void savedFilters.fetchNextPage()}
                size="compact"
                variant="secondary"
              >
                {savedFilters.isFetchingNextPage
                  ? "Loading More…"
                  : "Load More Filters"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </PanelBody>

      <Dialog
        closeLabel="Close Delete Filter Confirmation"
        description="This permanently removes only your personal quotation filter."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={!selected || deleteFilter.isPending}
              onClick={() => {
                if (selected) deleteFilter.mutate(selected);
              }}
              variant="danger"
            >
              {deleteFilter.isPending ? "Deleting…" : "Delete Filter"}
            </Button>
          </>
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        size="compact"
        title="Delete This Saved Filter?"
      >
        <p className="m-0 break-words text-body-sm text-foreground">
          {selected
            ? `${selected.name} will no longer be available.`
            : "Select a saved filter first."}
        </p>
      </Dialog>
    </Panel>
  );
}
