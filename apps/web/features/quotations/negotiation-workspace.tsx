"use client";
import {
  ChangeRequestDtoSchema,
  CounterofferDtoSchema,
  CreateCounterofferRequestSchema,
  InternalNegotiationDtoSchema,
  NegotiationMessageDtoSchema,
  QuoteDtoSchema,
  apiRoutes,
  formatEnumLabel,
  type ChangeRequestDto,
} from "@repo/common";
import {
  Badge,
  Button,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldLabel,
  Input,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Select,
  Textarea,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApiRequest } from "../../lib/api/browser";

export function NegotiationWorkspace({
  quoteId,
  canRespond,
}: {
  quoteId: string;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<ChangeRequestDto>();
  const query = useQuery({
    queryKey: ["negotiation", quoteId],
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      const [quote, negotiation] = await Promise.all([
        browserApiRequest(apiRoutes.quotes.detail(quoteId), {
          schema: QuoteDtoSchema,
          signal,
        }),
        browserApiRequest(apiRoutes.negotiation.workspace(quoteId), {
          schema: InternalNegotiationDtoSchema,
          signal,
        }),
      ]);
      return { quote, ...negotiation };
    },
  });
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setSelected(undefined);
      setMessage("");
      await query.refetch();
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save your response",
      );
    } finally {
      setBusy(false);
    }
  }
  const lines = query.data?.quote.currentVersion.lines ?? [];
  const lineName = (id: string | null | undefined) =>
    lines.find((line) => line.id === id)?.productName ??
    (id ? "Previous quotation line" : "Payment terms");
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Customer Conversation</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <div className="grid gap-md">
          {error || query.isError ? (
            <ErrorFeedback title="Conversation needs attention">
              {error || query.error?.message}
            </ErrorFeedback>
          ) : null}
          {query.isPending ? <p>Loading conversation…</p> : null}
          {query.data?.messages.map((item) => (
            <article key={item.id} className="border-b border-border pb-sm">
              <strong>{item.authorName}</strong>
              <p className="whitespace-pre-wrap">{item.body}</p>
            </article>
          ))}
          {query.data?.changeRequests.map((change) => (
            <article
              key={change.id}
              className="grid gap-sm rounded-control border border-border p-md"
            >
              <div className="flex justify-between gap-sm">
                <strong>{change.requestedByName} requested changes</strong>
                <Badge>{formatEnumLabel(change.status)}</Badge>
              </div>
              {change.message ? <p>{change.message}</p> : null}
              {change.items.map((item) => (
                <p key={item.id} className="m-0 text-body-sm">
                  {lineName(item.quoteLineId)}: {formatEnumLabel(item.action)}
                  {item.quantity ? ` to ${item.quantity}` : ""}
                  {item.unitPrice ? ` to ${item.unitPrice}` : ""}
                  {item.discountPercent ? ` to ${item.discountPercent}%` : ""}
                  {item.terms?.paymentTermsDays !== undefined
                    ? ` to ${String(item.terms.paymentTermsDays)} days`
                    : ""}
                </p>
              ))}
              {change.resolutionReason ? (
                <p>{change.resolutionReason}</p>
              ) : null}
              {query.data.counteroffers
                .filter((offer) => offer.changeRequestId === change.id)
                .map((offer) => (
                  <div key={offer.id}>
                    <Badge>{formatEnumLabel(offer.status)}</Badge>
                    <p>
                      {offer.offeredByName}:{" "}
                      {offer.message ?? "Alternative commercial terms offered"}
                    </p>
                  </div>
                ))}
              {canRespond &&
              change.status === "PENDING" &&
              change.sourceQuoteVersionId ===
                query.data.quote.currentVersion.id ? (
                <div className="flex flex-wrap gap-sm">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        browserApiRequest(
                          apiRoutes.negotiation.acceptChangeRequest(change.id),
                          {
                            method: "POST",
                            json: {},
                            schema: ChangeRequestDtoSchema,
                          },
                        ),
                      )
                    }
                  >
                    Accept Requested Changes
                  </Button>
                  <Button
                    disabled={busy}
                    variant="secondary"
                    onClick={() => setSelected(change)}
                  >
                    Offer Alternative or Decline
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
          {selected ? (
            <form
              className="grid gap-sm"
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                void act(async () => {
                  const reason = String(values.get("reason") ?? "").trim();
                  if (values.get("decision") === "reject")
                    return browserApiRequest(
                      apiRoutes.negotiation.rejectChangeRequest(selected.id),
                      {
                        method: "POST",
                        json: { reason },
                        schema: ChangeRequestDtoSchema,
                      },
                    );
                  const body = CreateCounterofferRequestSchema.parse({
                    message: reason,
                    proposedChanges: [
                      {
                        quoteLineId: values.get("line"),
                        discountPercent: values.get("discount"),
                      },
                    ],
                  });
                  return browserApiRequest(
                    apiRoutes.negotiation.counteroffer(selected.id),
                    {
                      method: "POST",
                      json: body,
                      schema: CounterofferDtoSchema,
                    },
                  );
                });
              }}
            >
              <Field>
                <FieldLabel htmlFor="negotiation-decision">Response</FieldLabel>
                <Select id="negotiation-decision" name="decision">
                  <option value="counter">Offer an alternative discount</option>
                  <option value="reject">Decline the request</option>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="negotiation-line">Product</FieldLabel>
                <Select id="negotiation-line" name="line">
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.productName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="negotiation-discount">
                  Alternative discount (%)
                </FieldLabel>
                <Input
                  id="negotiation-discount"
                  name="discount"
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  defaultValue="0"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="negotiation-reason">
                  Message to customer
                </FieldLabel>
                <Textarea
                  id="negotiation-reason"
                  name="reason"
                  required
                  maxLength={1000}
                />
              </Field>
              <div className="flex gap-sm">
                <Button type="submit" disabled={busy}>
                  Send Response
                </Button>
                <Button variant="quiet" onClick={() => setSelected(undefined)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          {query.data &&
          !query.data.messages.length &&
          !query.data.changeRequests.length ? (
            <EmptyState
              title="No conversation yet"
              description="Customer messages and requested changes will appear here."
            />
          ) : null}
          {canRespond &&
          query.data &&
          [
            "SENT",
            "UNDER_NEGOTIATION",
            "CUSTOMER_ACCEPTED",
            "CONFIRMED",
          ].includes(query.data.quote.stage) ? (
            <form
              className="grid gap-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void act(() =>
                  browserApiRequest(apiRoutes.negotiation.comments(quoteId), {
                    method: "POST",
                    json: {
                      body: message,
                      quoteRevision: query.data!.quote.revision,
                    },
                    schema: NegotiationMessageDtoSchema,
                  }),
                );
              }}
            >
              <Field>
                <FieldLabel htmlFor="sales-reply">Reply to customer</FieldLabel>
                <Textarea
                  id="sales-reply"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  maxLength={4000}
                />
              </Field>
              <Button type="submit" disabled={busy || !message.trim()}>
                Send Reply
              </Button>
            </form>
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
