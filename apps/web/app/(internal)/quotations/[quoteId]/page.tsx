import {
  CustomerAccountDtoSchema,
  DealEventDtoSchema,
  PriceListDtoSchema,
  ProductCategoryDtoSchema,
  QuoteDtoSchema,
  QuoteProductPickerPageDtoSchema,
  QuoteVersionDiffDtoSchema,
  QuoteVersionDtoSchema,
  RecommendationDtoSchema,
  SubscriptionPlanDtoSchema,
  WarehouseDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  planApiRoutes,
} from "@repo/common";
import type { Metadata } from "next";
import { z } from "zod";

import { loadConfigurationItems } from "../../../../features/configuration/server";
import { NegotiationWorkspace } from "../../../../features/quotations/negotiation-workspace";
import { QuoteBuilder } from "../../../../features/quotations/quote-builder";
import { serverApiRequest } from "../../../../lib/api/server";
import { getInternalSessionState } from "../../../../lib/auth/session";

export const metadata: Metadata = { title: "Quotation Builder" };

const RecommendationsSchema = z.array(RecommendationDtoSchema);
const VersionsSchema = z.array(QuoteVersionDtoSchema);
const DealEventPageSchema = createCursorPageSchema(DealEventDtoSchema);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QuotationBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status !== "authenticated") return null;
  const { quoteId } = await params;
  const capabilities = sessionState.session.user.capabilities;
  const productPickerQuery = new URLSearchParams({
    limit: "30",
    quantity: "1",
    quoteId,
  });
  const [
    quote,
    initialProductPage,
    customers,
    plans,
    categories,
    priceLists,
    warehouses,
    versions,
    initialTimeline,
  ] = await Promise.all([
    serverApiRequest(apiRoutes.quotes.detail(quoteId), QuoteDtoSchema),
    serverApiRequest(
      `${planApiRoutes.catalog.productPicker}?${productPickerQuery.toString()}`,
      QuoteProductPickerPageDtoSchema,
    ),
    loadConfigurationItems(
      apiRoutes.customers.accounts,
      CustomerAccountDtoSchema,
    ),
    loadConfigurationItems(
      apiRoutes.pricing.subscriptionPlans,
      SubscriptionPlanDtoSchema,
    ),
    loadConfigurationItems(
      apiRoutes.catalog.productCategories,
      ProductCategoryDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.pricing.priceLists, PriceListDtoSchema),
    loadConfigurationItems(apiRoutes.catalog.warehouses, WarehouseDtoSchema),
    serverApiRequest(planApiRoutes.quotes.versions(quoteId), VersionsSchema),
    serverApiRequest(
      `${planApiRoutes.quotes.timeline(quoteId)}?limit=25`,
      DealEventPageSchema,
    ).catch(() => undefined),
  ]);
  const recommendations = capabilities.includes("recommendation.read")
    ? await serverApiRequest(
        apiRoutes.quotes.recommendations(quoteId),
        RecommendationsSchema,
      ).catch(() => [])
    : [];
  const values = await searchParams;
  const fromRevision = Number(first(values.fromRevision));
  const toRevision = Number(first(values.toRevision));
  const selectedPair =
    Number.isInteger(fromRevision) &&
    fromRevision > 0 &&
    Number.isInteger(toRevision) &&
    toRevision > 0
      ? { fromRevision, toRevision }
      : versions[1] && versions[0]
        ? {
            fromRevision: versions[1].revisionNumber,
            toRevision: versions[0].revisionNumber,
          }
        : undefined;
  const initialDiff = selectedPair
    ? await serverApiRequest(
        `${planApiRoutes.quotes.versionDiff(quoteId)}?${new URLSearchParams({
          fromRevision: String(selectedPair.fromRevision),
          toRevision: String(selectedPair.toRevision),
        }).toString()}`,
        QuoteVersionDiffDtoSchema,
      ).catch(() => undefined)
    : undefined;

  return (
    <div className="grid gap-lg">
      <QuoteBuilder
        canConfirm={capabilities.includes("quotation.confirm")}
        canEdit={
          capabilities.includes("quotation.editOwn") ||
          capabilities.includes("quotation.editAny")
        }
        canSend={capabilities.includes("quotation.send")}
        canSubmit={capabilities.includes("quotation.submit")}
        categories={categories.filter(
          (category) => category.status === "ACTIVE",
        )}
        customers={customers
          .filter((customer) => customer.status === "ACTIVE")
          .map((customer) => ({ id: customer.id, name: customer.name }))}
        initialDiff={initialDiff}
        initialProductPage={initialProductPage}
        initialQuote={quote}
        initialRecommendations={recommendations}
        initialTimeline={initialTimeline}
        initialVersions={versions}
        plans={plans.filter((plan) => plan.status === "ACTIVE")}
        priceLists={priceLists.filter(
          (priceList) => priceList.status === "ACTIVE",
        )}
        timeZone={sessionState.session.organization.timezone}
        warehouses={warehouses.filter(
          (warehouse) => warehouse.status === "ACTIVE",
        )}
      />
      {capabilities.includes("negotiation.read") ? (
        <NegotiationWorkspace
          quoteId={quote.id}
          canRespond={capabilities.includes("negotiation.respond")}
        />
      ) : null}
    </div>
  );
}
