import type { Metadata } from "next";

import { PortalQuotationWorkspace } from "../../../../../features/portal/portal-quotation-workspace";

export const metadata: Metadata = { title: "Shared Quotation" };

export default async function PortalQuotationPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const route = await params;
  return <PortalQuotationWorkspace quoteId={route.quoteId} />;
}
