import { SubscriptionPlanDtoSchema, apiRoutes } from "@repo/common";
import type { Metadata } from "next";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Subscription Plan Configuration" };

export default async function SubscriptionPlanSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireConfigurationAccess("/settings/subscription-plans");
  const parameters = await searchParams;
  const items = await loadConfigurationItems(
    apiRoutes.pricing.subscriptionPlans,
    SubscriptionPlanDtoSchema,
  );

  return (
    <ConfigurationWorkspace
      canManage
      items={items}
      kind="subscription-plans"
      search={firstSearchValue(parameters.search)}
    />
  );
}
