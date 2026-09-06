import {
  CustomerTierDtoSchema,
  PriceListDtoSchema,
  PriceRuleDtoSchema,
  ProductCategoryDtoSchema,
  ProductDtoSchema,
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

export const metadata: Metadata = { title: "Price List Configuration" };

export default async function PriceListSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess("/settings/price-lists");
  const parameters = await searchParams;
  const items = await loadConfigurationItems(
    apiRoutes.pricing.priceLists,
    PriceListDtoSchema,
  );
  const view =
    firstSearchValue(parameters.view) === "rules" ? "rules" : "lists";
  const requestedPriceListId = firstSearchValue(parameters.priceListId);
  const selectedPriceListId = items.some(
    (priceList) => priceList.id === requestedPriceListId,
  )
    ? requestedPriceListId
    : items[0]?.id;

  if (
    view === "rules" &&
    selectedPriceListId &&
    selectedPriceListId !== requestedPriceListId
  ) {
    const canonical = new URLSearchParams({
      priceListId: selectedPriceListId,
      view: "rules",
    });
    const search = firstSearchValue(parameters.search);
    if (search) canonical.set("search", search);
    redirect(`/settings/price-lists?${canonical.toString()}`);
  }

  const [rules, products, categories, tiers] =
    view === "rules"
      ? await Promise.all([
          selectedPriceListId
            ? loadConfigurationItems(
                apiRoutes.pricing.priceRules(selectedPriceListId),
                PriceRuleDtoSchema,
              )
            : Promise.resolve([]),
          loadConfigurationItems(apiRoutes.catalog.products, ProductDtoSchema),
          loadConfigurationItems(
            apiRoutes.catalog.productCategories,
            ProductCategoryDtoSchema,
          ),
          loadConfigurationItems(
            apiRoutes.customers.tiers,
            CustomerTierDtoSchema,
          ),
        ])
      : [[], [], [], []];

  return (
    <ConfigurationWorkspace
      canManage
      categories={categories}
      items={items}
      kind="price-lists"
      products={products}
      rules={rules}
      search={firstSearchValue(parameters.search)}
      selectedPriceListId={selectedPriceListId}
      tiers={tiers}
      timeZone={session.organization.timezone}
      view={view}
    />
  );
}
