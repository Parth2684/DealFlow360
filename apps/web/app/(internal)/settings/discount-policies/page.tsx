import {
  CustomerTierDtoSchema,
  DiscountLimitDtoSchema,
  ProductCategoryDtoSchema,
  ProductDtoSchema,
  apiRoutes,
} from "@repo/common";
import type { Metadata } from "next";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Discount Policy Configuration" };

export default async function DiscountPolicySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess(
    "/settings/discount-policies",
  );
  const parameters = await searchParams;
  const [items, tiers, categories, products] = await Promise.all([
    loadConfigurationItems(
      apiRoutes.pricing.discountLimits,
      DiscountLimitDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.customers.tiers, CustomerTierDtoSchema),
    loadConfigurationItems(
      apiRoutes.catalog.productCategories,
      ProductCategoryDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.catalog.products, ProductDtoSchema),
  ]);

  return (
    <ConfigurationWorkspace
      canManage
      categories={categories}
      items={items}
      kind="discount-policies"
      products={products}
      search={firstSearchValue(parameters.search)}
      tiers={tiers}
      timeZone={session.organization.timezone}
    />
  );
}
