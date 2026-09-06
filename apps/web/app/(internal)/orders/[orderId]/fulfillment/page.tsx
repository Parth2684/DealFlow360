import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FulfillmentWorkspace } from "../../../../../features/fulfillment/fulfillment-workspace";
import { getInternalSessionState } from "../../../../../lib/auth/session";

export const metadata: Metadata = { title: "Order Fulfillment" };

export default async function FulfillmentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const [route, sessionState] = await Promise.all([
    params,
    getInternalSessionState(),
  ]);
  if (sessionState.status !== "authenticated") return null;
  if (!sessionState.session.user.capabilities.includes("fulfillment.read")) {
    redirect("/forbidden");
  }

  return (
    <FulfillmentWorkspace
      capabilities={sessionState.session.user.capabilities}
      orderId={route.orderId}
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
