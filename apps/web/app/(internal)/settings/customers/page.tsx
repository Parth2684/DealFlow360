import {
  CustomerAccountDtoSchema,
  CustomerContactDtoSchema,
  CustomerTierDtoSchema,
  apiRoutes,
} from "@repo/common";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Customer Configuration" };

export default async function CustomerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess("/settings/customers");
  const parameters = await searchParams;
  const requestedView = Array.isArray(parameters.view)
    ? parameters.view[0]
    : parameters.view;
  const view =
    requestedView === "contacts" || requestedView === "tiers"
      ? requestedView
      : "accounts";
  const [accounts, tiers] = await Promise.all([
    loadConfigurationItems(
      apiRoutes.customers.accounts,
      CustomerAccountDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.customers.tiers, CustomerTierDtoSchema),
  ]);
  const requestedCustomerId = firstSearchValue(parameters.customerId);
  const selectedCustomer = accounts.find(
    (account) => account.id === requestedCustomerId,
  );
  if (view === "contacts" && accounts.length > 0 && !selectedCustomer) {
    const canonical = new URLSearchParams({
      customerId: accounts[0]?.id ?? "",
      view: "contacts",
    });
    const search = firstSearchValue(parameters.search);
    if (search) canonical.set("search", search);
    redirect(`/settings/customers?${canonical.toString()}`);
  }
  const contacts = selectedCustomer
    ? await loadConfigurationItems(
        apiRoutes.customers.contacts(selectedCustomer.id),
        CustomerContactDtoSchema,
      )
    : [];

  return (
    <ConfigurationWorkspace
      accounts={accounts}
      baseCurrency={session.organization.baseCurrency}
      canManage
      contacts={contacts}
      kind="customers"
      search={firstSearchValue(parameters.search)}
      selectedCustomerId={selectedCustomer?.id}
      tiers={tiers}
      view={view}
    />
  );
}
