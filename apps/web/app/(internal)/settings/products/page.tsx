import {
  ProductCategoryDtoSchema,
  ProductDtoSchema,
  ProductVariantDtoSchema,
  TaxDtoSchema,
  apiRoutes,
  planApiRoutes,
} from "@repo/common";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Product Configuration" };

export default async function ProductSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess("/settings/products");
  const parameters = await searchParams;
  const requestedView = Array.isArray(parameters.view)
    ? parameters.view[0]
    : parameters.view;
  const view =
    requestedView === "categories" ||
    requestedView === "taxes" ||
    requestedView === "variants"
      ? requestedView
      : "products";
  const [items, categories, taxes] = await Promise.all([
    loadConfigurationItems(apiRoutes.catalog.products, ProductDtoSchema),
    loadConfigurationItems(
      apiRoutes.catalog.productCategories,
      ProductCategoryDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.pricing.taxes, TaxDtoSchema),
  ]);
  const requestedProductId = firstSearchValue(parameters.productId);
  const selectedProduct = items.find(
    (product) => product.id === requestedProductId,
  );
  if (view === "variants" && items.length > 0 && !selectedProduct) {
    const canonical = new URLSearchParams({
      productId: items[0]?.id ?? "",
      view: "variants",
    });
    const search = firstSearchValue(parameters.search);
    if (search) canonical.set("search", search);
    redirect(`/settings/products?${canonical.toString()}`);
  }
  const variants = selectedProduct
    ? await loadConfigurationItems(
        planApiRoutes.catalog.productVariants(selectedProduct.id),
        ProductVariantDtoSchema,
      )
    : [];

  return (
    <ConfigurationWorkspace
      baseCurrency={session.organization.baseCurrency}
      canManage
      categories={categories}
      items={items}
      kind="products"
      search={firstSearchValue(parameters.search)}
      selectedProductId={selectedProduct?.id}
      taxes={taxes}
      timeZone={session.organization.timezone}
      variants={variants}
      view={view}
    />
  );
}
