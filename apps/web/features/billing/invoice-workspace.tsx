"use client";
import {
  InvoiceDtoSchema,
  PaymentDtoSchema,
  apiRoutes,
  type Capability,
} from "@repo/common";
import {
  ButtonLink,
  ErrorFeedback,
  PageHeader,
  Panel,
  PanelBody,
  Skeleton,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { browserApiRequest } from "../../lib/api/browser";
import { InvoiceCard } from "./billing-workspace";

export function InvoiceWorkspace({
  invoiceId,
  capabilities,
  timeZone,
}: {
  invoiceId: string;
  capabilities: readonly Capability[];
  timeZone: string;
}) {
  const ledger = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async ({ signal }) => {
      const [detail, payments] = await Promise.all([
        browserApiRequest(apiRoutes.billing.invoice(invoiceId), {
          schema: InvoiceDtoSchema,
          signal,
        }),
        browserApiRequest(apiRoutes.billing.payments(invoiceId), {
          schema: z.array(PaymentDtoSchema),
          signal,
        }),
      ]);
      return { detail, payments };
    },
  });
  return (
    <div className="grid gap-lg">
      <PageHeader
        title={ledger.data?.detail.invoiceNumber ?? "Invoice"}
        description={ledger.data?.detail.customerName}
        actions={
          <ButtonLink href="/invoices" variant="secondary">
            All Invoices
          </ButtonLink>
        }
      />
      {ledger.isPending ? (
        <Skeleton />
      ) : ledger.isError ? (
        <ErrorFeedback title="Invoice unavailable">
          {ledger.error.message}
        </ErrorFeedback>
      ) : (
        <Panel>
          <PanelBody>
            <InvoiceCard
              entry={ledger.data}
              canIssue={capabilities.includes("billing.issueInvoice")}
              canRecordPayment={capabilities.includes("billing.recordPayment")}
              timeZone={timeZone}
              onChanged={async () => {
                await ledger.refetch();
              }}
            />
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
