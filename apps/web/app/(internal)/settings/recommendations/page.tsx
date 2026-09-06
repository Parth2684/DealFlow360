import {
  ProductDtoSchema,
  RecommendationRuleDtoSchema,
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

export const metadata: Metadata = { title: "Recommendation Configuration" };

export default async function RecommendationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess("/settings/recommendations");
  const parameters = await searchParams;
  const [items, products] = await Promise.all([
    loadConfigurationItems(
      planApiRoutes.configuration.recommendationRules,
      RecommendationRuleDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.catalog.products, ProductDtoSchema),
  ]);

  return (
    <ConfigurationWorkspace
      canManage
      items={items}
      kind="recommendations"
      products={products}
      search={firstSearchValue(parameters.search)}
      timeZone={session.organization.timezone}
    />
  );
}
