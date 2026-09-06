import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BillingWorkspace } from "../../../../../features/billing/billing-workspace";
import { getInternalSessionState } from "../../../../../lib/auth/session";

export const metadata: Metadata = { title: "Order Billing" };

export default async function BillingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const [route, sessionState] = await Promise.all([
    params,
    getInternalSessionState(),
  ]);
  if (sessionState.status !== "authenticated") return null;
  if (!sessionState.session.user.capabilities.includes("billing.read")) {
    redirect("/forbidden");
  }

  return (
    <BillingWorkspace
      capabilities={sessionState.session.user.capabilities}
      orderId={route.orderId}
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
