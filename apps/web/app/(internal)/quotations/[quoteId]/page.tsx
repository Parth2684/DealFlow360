"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Send, ArrowLeft, ShoppingCart } from "lucide-react";
import { quotesApi, ordersApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState, ErrorState, PageLoading } from "@/components/ui/feedback";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { AddLineDialog } from "./add-line-dialog";
import { RecommendationsPanel } from "./recommendations-panel";
import { useRouter } from "next/navigation";

export default function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = use(params);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { notify } = useToast();

  const { data: quote, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => quotesApi.get(quoteId),
  });

  const calculateMutation = useMutation({
    mutationFn: () => quotesApi.calculate(quoteId, quote?.revision ?? 0),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      notify({ title: "Totals recalculated", variant: "success" });
    },
    onError: (err) => {
      notify({
        title: "Calculation failed",
        description: err instanceof ApiError ? err.message : undefined,
        variant: "error",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => quotesApi.submit(quoteId, quote?.revision ?? 0),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      notify({ title: "Quotation submitted for approval", variant: "success" });
    },
    onError: (err) => {
      notify({
        title: "Submission failed",
        description: err instanceof ApiError ? err.message : undefined,
        variant: "error",
      });
    },
  });

  const confirmOrderMutation = useMutation({
    mutationFn: () => ordersApi.confirmFromQuote(quoteId, quote?.revision ?? 0),
    onSuccess: (order) => {
      notify({ title: "Order confirmed", variant: "success" });
      router.push(`/orders/${order.id}`);
    },
    onError: (err) => {
      notify({
        title: "Could not confirm order",
        description: err instanceof ApiError ? err.message : undefined,
        variant: "error",
      });
    },
  });

  if (isLoading) return <PageLoading label="Loading quotation…" />;
  if (isError || !quote) {
    return (
      <ErrorState
        message={error instanceof ApiError ? error.message : "Could not load this quotation."}
        retry={() => refetch()}
      />
    );
  }

  const version = quote.currentVersion;
  const lines = version?.lines ?? [];
  const canEdit = ["DRAFT", "REVISION_REQUIRED"].includes(quote.stage);

  return (
    <div>
      <Link href="/quotations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to quotations
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-ink">{quote.quoteNumber ?? quote.id}</h1>
            <StatusBadge status={quote.stage} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {quote.customerAccount?.name ?? "Unknown customer"} · Expires {formatDate(quote.expiresAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => calculateMutation.mutate()} loading={calculateMutation.isPending}>
            <Calculator size={16} /> Recalculate
          </Button>
          {canEdit ? (
            <Button onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
              <Send size={16} /> Submit for approval
            </Button>
          ) : null}
          {quote.stage === "CUSTOMER_ACCEPTED" ? (
            <Button onClick={() => confirmOrderMutation.mutate()} loading={confirmOrderMutation.isPending}>
              <ShoppingCart size={16} /> Confirm order
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Quote lines"
              description={`${lines.length} line${lines.length === 1 ? "" : "s"}`}
              action={canEdit ? <AddLineDialog quoteId={quoteId} /> : undefined}
            />
            {lines.length === 0 ? (
              <EmptyState title="No lines yet" description="Add products to build this quotation." />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Product</Th>
                    <Th>Qty</Th>
                    <Th>Unit price</Th>
                    <Th>Discount</Th>
                    <Th>Tax</Th>
                    <Th>Billing</Th>
                    <Th className="text-right">Line total</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {lines.map((line) => (
                    <Tr key={line.id}>
                      <Td className="font-medium text-ink">
                        {line.productName}
                        {line.sku ? <span className="ml-1.5 text-xs text-muted-soft">({line.sku})</span> : null}
                      </Td>
                      <Td>{formatNumber(line.quantity)}</Td>
                      <Td>{formatMoney(line.unitPrice, version?.currency)}</Td>
                      <Td>{formatPercent(line.discountPercent)}</Td>
                      <Td>{formatPercent(line.taxRate)}</Td>
                      <Td>{line.billingType.replaceAll("_", " ")}</Td>
                      <Td className="text-right font-medium">{formatMoney(line.lineTotal, version?.currency)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>

          <RecommendationsPanel quoteId={quoteId} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Totals" />
            <dl className="space-y-2.5 px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatMoney(version?.subtotal, version?.currency)} />
              <Row label="Discount" value={`-${formatMoney(version?.discountTotal, version?.currency)}`} />
              <Row label="Tax" value={formatMoney(version?.taxTotal, version?.currency)} />
              <Row label="Total" value={formatMoney(version?.total, version?.currency)} strong />
              <div className="my-2 border-t border-hairline-soft" />
              <Row label="Cost" value={formatMoney(version?.costTotal, version?.currency)} />
              <Row label="Gross margin" value={formatMoney(version?.grossMargin, version?.currency)} />
              <Row label="Margin %" value={formatPercent(version?.marginPercent)} />
            </dl>
          </Card>

          <Card className="p-5 text-sm text-muted">
            <p className="font-medium text-body-strong">Terms</p>
            <p className="mt-1">Payment due in {version?.paymentTermsDays ?? "—"} days.</p>
            {version?.notes ? <p className="mt-2">{version.notes}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-semibold text-ink" : "text-body"}>{value}</dd>
    </div>
  );
}
