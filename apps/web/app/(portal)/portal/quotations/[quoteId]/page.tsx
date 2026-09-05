"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { negotiationApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ErrorState, PageLoading } from "@/components/ui/feedback";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { ChangeRequestForm } from "./change-request-form";

export default function PortalQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = use(params);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { data: quote, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portal-quote", quoteId],
    queryFn: () => negotiationApi.portalQuote(quoteId),
  });

  const { data: changeRequests } = useQuery({
    queryKey: ["change-requests", quoteId],
    queryFn: () => negotiationApi.changeRequests(quoteId),
  });

  const acceptCounteroffer = useMutation({
    mutationFn: (id: string) => negotiationApi.acceptCounteroffer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["change-requests", quoteId] });
      notify({ title: "Counteroffer accepted", variant: "success" });
    },
  });

  const rejectCounteroffer = useMutation({
    mutationFn: (id: string) => negotiationApi.rejectCounteroffer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["change-requests", quoteId] });
      notify({ title: "Counteroffer declined", variant: "success" });
    },
  });

  if (isLoading) return <PageLoading label="Loading your quotation…" />;
  if (isError || !quote) {
    return (
      <ErrorState
        message={error instanceof ApiError ? error.message : "We couldn't load this quotation. The link may have expired."}
        retry={() => refetch()}
      />
    );
  }

  const version = quote.currentVersion;
  const lines = version?.lines ?? [];
  const awaitingApproval = quote.stage === "PENDING_APPROVAL";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl text-ink">{quote.quoteNumber ?? "Your quotation"}</h1>
          <StatusBadge status={quote.stage} />
        </div>
        <p className="mt-1 text-sm text-muted">Valid until {formatDate(quote.expiresAt)}</p>
      </div>

      {awaitingApproval ? (
        <Card className="border-warning/40 bg-warning/10 p-4 text-sm text-body-strong">
          Awaiting internal approval. We&apos;ll notify you once this quotation is ready to review.
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Line items" />
        <Table>
          <Thead>
            <Tr>
              <Th>Item</Th>
              <Th>Qty</Th>
              <Th className="text-right">Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {lines.map((line) => (
              <Tr key={line.id}>
                <Td className="font-medium text-ink">{line.productName}</Td>
                <Td>{formatNumber(line.quantity)}</Td>
                <Td className="text-right">{formatMoney(line.lineTotal, version?.currency)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <div className="border-t border-hairline px-5 py-4">
          <div className="flex items-center justify-between text-sm font-semibold text-ink">
            <span>Total</span>
            <span>{formatMoney(version?.total, version?.currency)}</span>
          </div>
        </div>
      </Card>

      {changeRequests && changeRequests.length > 0 ? (
        <Card>
          <CardHeader title="Your requests" />
          <ul className="divide-y divide-hairline-soft px-5">
            {changeRequests.map((request) => (
              <li key={request.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{request.type.replaceAll("_", " ")}</span>
                  <StatusBadge status={request.status} />
                </div>
                {request.message ?? request.comment ? <p className="mt-1 text-muted">{request.message ?? request.comment}</p> : null}
                {request.counteroffer ? (
                  <div className="mt-2 rounded-md bg-surface-soft p-3">
                    <p className="text-sm font-medium text-body-strong">Seller counteroffer</p>
                    {request.counteroffer.message ? <p className="mt-1 text-sm text-body">{request.counteroffer.message}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => acceptCounteroffer.mutate(request.counteroffer!.id)} loading={acceptCounteroffer.isPending}>
                        Accept
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => rejectCounteroffer.mutate(request.counteroffer!.id)} loading={rejectCounteroffer.isPending}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {quote.stage === "SENT" || quote.stage === "UNDER_NEGOTIATION" ? (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-medium text-ink">Request a change</h2>
          <ChangeRequestForm quoteId={quoteId} lines={lines} />
        </Card>
      ) : null}
    </div>
  );
}
