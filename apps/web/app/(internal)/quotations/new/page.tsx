import { CustomerAccountDtoSchema, apiRoutes } from "@repo/common";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateQuotationForm } from "../../../../features/quotations/create-quotation-form";
import { loadConfigurationItems } from "../../../../features/configuration/server";
import { getInternalSessionState } from "../../../../lib/auth/session";

export const metadata: Metadata = { title: "New Quotation" };

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status !== "authenticated") return null;
  if (!sessionState.session.user.capabilities.includes("quotation.create")) {
    redirect("/forbidden");
  }
  const customers = await loadConfigurationItems(
    apiRoutes.customers.accounts,
    CustomerAccountDtoSchema,
  );
  const query = await searchParams;

  return (
    <CreateQuotationForm
      baseCurrency={sessionState.session.organization.baseCurrency}
      initialCustomerId={query.customerId}
      customers={customers.filter((customer) => customer.status === "ACTIVE")}
    />
  );
}
