import {
  ProductDtoSchema,
  PromotionDtoSchema,
  apiRoutes,
  planApiRoutes,
} from "@repo/common";
import type { Metadata } from "next";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Promotion Configuration" };

export default async function PromotionSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess("/settings/promotions");
  const parameters = await searchParams;
  const [items, products] = await Promise.all([
    loadConfigurationItems(
      planApiRoutes.configuration.promotions,
      PromotionDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.catalog.products, ProductDtoSchema),
  ]);

  return (
    <ConfigurationWorkspace
      canManage
      items={items}
      kind="promotions"
      products={products}
      search={firstSearchValue(parameters.search)}
      timeZone={session.organization.timezone}
    />
  );
}
