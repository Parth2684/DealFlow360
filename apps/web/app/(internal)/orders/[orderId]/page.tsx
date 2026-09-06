import {
  IdSchema,
  OrderDtoSchema,
  apiRoutes,
  formatEnumLabel,
  formatMoney,
} from "@repo/common";
import { Badge, ButtonLink, PageHeader, Panel, PanelBody } from "@repo/ui";
import { notFound } from "next/navigation";
import { requireAccess } from "../../../../features/shared/require-access";
import { ServerApiError, serverApiRequest } from "../../../../lib/api/server";

export const metadata = { title: "Order Details" };
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireAccess("fulfillment.read", "billing.read");
  const { orderId } = await params;
  if (!IdSchema.safeParse(orderId).success) notFound();
  const order = await serverApiRequest(
    apiRoutes.orders.detail(orderId),
    OrderDtoSchema,
  ).catch((error: unknown) => {
    if (error instanceof ServerApiError && error.problem.status === 404)
      notFound();
    throw error;
  });
  return (
    <div className="grid gap-lg">
      <PageHeader
        title={order.orderNumber}
        description={order.customerName}
        actions={
          <ButtonLink href="/orders" variant="secondary">
            All Orders
          </ButtonLink>
        }
      />
      <div className="flex flex-wrap gap-sm">
        <Badge>{formatEnumLabel(order.status)}</Badge>
        {session.user.capabilities.includes("fulfillment.read") ? (
          <ButtonLink href={`/orders/${order.id}/fulfillment`}>
            Fulfillment
          </ButtonLink>
        ) : null}
        {session.user.capabilities.includes("billing.read") ? (
          <ButtonLink href={`/orders/${order.id}/billing`}>Billing</ButtonLink>
        ) : null}
        {session.user.capabilities.includes("quotation.read") ? (
          <ButtonLink href={`/quotations/${order.quoteId}`} variant="quiet">
            Original Quotation
          </ButtonLink>
        ) : null}
      </div>
      <Panel>
        <PanelBody>
          <div className="grid gap-md">
            {order.lines.map((line) => (
              <div key={line.id} className="flex justify-between gap-sm">
                <span>
                  {line.productName} × {line.quantity}
                </span>
                <span>
                  {formatMoney(
                    line.total,
                    order.currency,
                    session.organization.locale,
                  )}
                </span>
              </div>
            ))}
            <strong>
              Total:{" "}
              {formatMoney(
                order.total,
                order.currency,
                session.organization.locale,
              )}
            </strong>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
