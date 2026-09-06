"use client";

import {
  AddQuoteLineRequestSchema,
  PRODUCT_TYPES,
  QuoteProductPickerPageDtoSchema,
  QuoteProductPickerQuerySchema,
  formatEnumLabel,
  formatMoney,
  planApiRoutes,
  type AddQuoteLineRequest,
  type PriceListDto,
  type ProductCategoryDto,
  type QuoteProductOptionDto,
  type QuoteProductPickerItemDto,
  type QuoteProductPickerPageDto,
  type SubscriptionPlanDto,
  type WarehouseDto,
} from "@repo/common";
import {
  Badge,
  Button,
  Checkbox,
  CheckboxField,
  Dialog,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  LiveRegion,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
} from "@repo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

interface PickerFilters {
  categoryId: string;
  inStockOnly: boolean;
  priceListId: string;
  productType: string;
  quantity: string;
  search: string;
  warehouseId: string;
}

const emptyFilters: PickerFilters = {
  categoryId: "",
  inStockOnly: false,
  priceListId: "",
  productType: "",
  quantity: "1",
  search: "",
  warehouseId: "",
};

function problemMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The product catalog could not be loaded. Check the service and try again.";
}

function queryPath(
  quoteId: string,
  filters: PickerFilters,
  cursor?: string,
): { error?: string; path?: string } {
  const parsed = QuoteProductPickerQuerySchema.safeParse({
    quoteId,
    limit: 30,
    quantity: filters.quantity,
    ...(cursor ? { cursor } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.productType ? { productType: filters.productType } : {}),
    ...(filters.priceListId ? { priceListId: filters.priceListId } : {}),
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(filters.inStockOnly ? { inStockOnly: "true" } : {}),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Check the product search filters.",
    };
  }

  const parameters = new URLSearchParams({
    limit: String(parsed.data.limit),
    quantity: parsed.data.quantity,
    quoteId: parsed.data.quoteId,
  });
  if (parsed.data.cursor) parameters.set("cursor", parsed.data.cursor);
  if (parsed.data.search) parameters.set("search", parsed.data.search);
  if (parsed.data.categoryId) {
    parameters.set("categoryId", parsed.data.categoryId);
  }
  if (parsed.data.productType) {
    parameters.set("productType", parsed.data.productType);
  }
  if (parsed.data.priceListId) {
    parameters.set("priceListId", parsed.data.priceListId);
  }
  if (parsed.data.warehouseId) {
    parameters.set("warehouseId", parsed.data.warehouseId);
  }
  if (parsed.data.inStockOnly !== undefined) {
    parameters.set("inStockOnly", String(parsed.data.inStockOnly));
  }
  return {
    path: `${planApiRoutes.catalog.productPicker}?${parameters.toString()}`,
  };
}

function defaultOption(product: QuoteProductPickerItemDto) {
  return product.options[0];
}

function optionLabel(option: QuoteProductOptionDto): string {
  if (!option.variantId) return "Standard Option";
  return [option.sku, option.name].filter(Boolean).join(" · ");
}

export function ProductBrowser({
  categories,
  disabled,
  initialPage,
  onAdd,
  plans,
  priceLists,
  quoteId,
  warehouses,
}: {
  categories: ProductCategoryDto[];
  disabled: boolean;
  initialPage: QuoteProductPickerPageDto;
  onAdd: (input: AddQuoteLineRequest) => Promise<void>;
  plans: SubscriptionPlanDto[];
  priceLists: PriceListDto[];
  quoteId: string;
  warehouses: WarehouseDto[];
}) {
  const { locale } = useOrganizationFormatting();
  const id = useId();
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>();
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [page, setPage] = useState(initialPage);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<QuoteProductPickerItemDto | null>(
    null,
  );
  const [submitError, setSubmitError] = useState("");
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<
    z.input<typeof AddQuoteLineRequestSchema>,
    undefined,
    AddQuoteLineRequest
  >({
    resolver: zodResolver(AddQuoteLineRequestSchema),
  });
  const billingType = useWatch({ control, name: "billingType" });
  const selectedVariantId = useWatch({ control, name: "variantId" });
  const selectedOption =
    selected?.options.find(
      (option) => option.variantId === (selectedVariantId ?? null),
    ) ?? (selected ? defaultOption(selected) : undefined);

  async function loadPage(
    filters: PickerFilters,
    cursor: string | undefined,
  ): Promise<boolean> {
    const request = queryPath(quoteId, filters, cursor);
    if (!request.path) {
      setSearchError(request.error ?? "Check the product search filters.");
      return false;
    }
    setSearching(true);
    setSearchError("");
    try {
      const nextPage = await browserApiRequest(request.path, {
        schema: QuoteProductPickerPageDtoSchema,
        scope: "internal",
      });
      setPage(nextPage);
      return true;
    } catch (error) {
      setSearchError(problemMessage(error));
      return false;
    } finally {
      setSearching(false);
    }
  }

  async function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await loadPage(draftFilters, undefined)) {
      setAppliedFilters(draftFilters);
      setCurrentCursor(undefined);
      setHistory([]);
    }
  }

  async function clearFilters() {
    if (await loadPage(emptyFilters, undefined)) {
      setDraftFilters(emptyFilters);
      setAppliedFilters(emptyFilters);
      setCurrentCursor(undefined);
      setHistory([]);
    }
  }

  async function nextPage() {
    const nextCursor = page.pageInfo.nextCursor ?? undefined;
    if (!nextCursor) return;
    if (await loadPage(appliedFilters, nextCursor)) {
      setHistory((current) => [...current, currentCursor]);
      setCurrentCursor(nextCursor);
    }
  }

  async function previousPage() {
    if (history.length === 0) return;
    const previousCursor = history[history.length - 1];
    if (await loadPage(appliedFilters, previousCursor)) {
      setHistory((current) => current.slice(0, -1));
      setCurrentCursor(previousCursor);
    }
  }

  function choose(product: QuoteProductPickerItemDto) {
    const recurring = product.productType === "SUBSCRIPTION";
    const option = defaultOption(product);
    setSubmitError("");
    setSelected(product);
    reset({
      billingType: recurring ? "RECURRING" : "ONE_TIME",
      discountPercent: "0",
      productId: product.id,
      quantity: appliedFilters.quantity,
      ...(option?.variantId ? { variantId: option.variantId } : {}),
      ...(recurring && plans[0] ? { subscriptionPlanId: plans[0].id } : {}),
    });
  }

  async function add(input: AddQuoteLineRequest) {
    setSubmitError("");
    try {
      await onAdd(input);
      setSelected(null);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The product could not be added. Refresh and try again.",
      );
    }
  }

  return (
    <>
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Product Browser</PanelTitle>
            <PanelDescription>
              Search server-resolved products, price lists, variants, and stock.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          <form className="grid gap-sm" onSubmit={searchProducts}>
            <Field>
              <FieldLabel htmlFor={`${id}-search`}>Search Products</FieldLabel>
              <Input
                autoComplete="off"
                id={`${id}-search`}
                name="catalog-search"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Product, category, variant, or SKU…"
                type="search"
                value={draftFilters.search}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-type`}>Product Type</FieldLabel>
              <Select
                id={`${id}-type`}
                name="product-type"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    productType: event.target.value,
                  }))
                }
                value={draftFilters.productType}
              >
                <option value="">All Types</option>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatEnumLabel(type)}
                  </option>
                ))}
              </Select>
            </Field>
            <details className="rounded-control border border-border bg-surface-subtle px-sm py-xs">
              <summary className="cursor-pointer text-body-sm font-semibold text-foreground-strong">
                Stock and Pricing Filters
              </summary>
              <div className="grid gap-sm pt-sm">
                <Field>
                  <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
                  <Select
                    id={`${id}-category`}
                    name="category-id"
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                    value={draftFilters.categoryId}
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-price-list`}>
                    Price List Preview
                  </FieldLabel>
                  <Select
                    id={`${id}-price-list`}
                    name="price-list-id"
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        priceListId: event.target.value,
                      }))
                    }
                    value={draftFilters.priceListId}
                  >
                    <option value="">Quote-Resolved Price List</option>
                    {priceLists.map((priceList) => (
                      <option key={priceList.id} value={priceList.id}>
                        {priceList.name} ({priceList.currency})
                      </option>
                    ))}
                  </Select>
                  <FieldDescription>
                    The add-line endpoint still confirms the authoritative quote
                    price.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-warehouse`}>Warehouse</FieldLabel>
                  <Select
                    id={`${id}-warehouse`}
                    name="warehouse-id"
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        warehouseId: event.target.value,
                      }))
                    }
                    value={draftFilters.warehouseId}
                  >
                    <option value="">All Warehouses</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-pricing-quantity`}>
                    Pricing Quantity
                  </FieldLabel>
                  <Input
                    autoComplete="off"
                    id={`${id}-pricing-quantity`}
                    inputMode="decimal"
                    min="0.0001"
                    name="pricing-quantity"
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                    step="0.0001"
                    type="number"
                    value={draftFilters.quantity}
                  />
                </Field>
                <CheckboxField
                  checkbox={
                    <Checkbox
                      checked={draftFilters.inStockOnly}
                      name="in-stock-only"
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          inStockOnly: event.target.checked,
                        }))
                      }
                    />
                  }
                  description="For hardware, show only options with available stock in the selected warehouse scope."
                >
                  In Stock Only
                </CheckboxField>
              </div>
            </details>
            <div className="flex flex-wrap gap-xs">
              <Button disabled={disabled || searching} type="submit">
                {searching ? "Searching…" : "Search Catalog"}
              </Button>
              <Button
                disabled={disabled || searching}
                onClick={() => void clearFilters()}
                variant="quiet"
              >
                Clear
              </Button>
            </div>
          </form>

          <LiveRegion
            message={searchError || (searching ? "Searching catalog" : "")}
          />
          {searchError ? (
            <ErrorFeedback className="mt-sm" title="Catalog Not Loaded">
              {searchError}
            </ErrorFeedback>
          ) : null}

          <div className="mt-sm grid gap-sm">
            {page.items.length > 0 ? (
              <div className="grid max-h-96 gap-xs overflow-y-auto overscroll-contain pr-xxs">
                {page.items.map((product) => {
                  const option = defaultOption(product);
                  return (
                    <article
                      className="grid gap-xs rounded-control border border-border bg-surface p-sm"
                      key={product.id}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-xs">
                        <div className="min-w-0">
                          <strong className="block truncate text-body-sm text-foreground-strong">
                            {product.name}
                          </strong>
                          <span className="font-mono text-caption text-foreground-muted">
                            {product.code}
                          </span>
                        </div>
                        <Badge>{formatEnumLabel(product.productType)}</Badge>
                      </div>
                      <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
                        <div>
                          <dt className="text-foreground-muted">
                            Resolved Price
                          </dt>
                          <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                            {option
                              ? formatMoney(
                                  option.resolvedUnitPrice,
                                  product.priceList.currency,
                                  locale,
                                )
                              : "Unavailable"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-foreground-muted">Available</dt>
                          <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                            {option?.availableQuantity ?? "0"} {product.unit}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-foreground-muted">Price List</dt>
                          <dd className="m-0 truncate text-foreground-strong">
                            {product.priceList.name}
                          </dd>
                        </div>
                      </dl>
                      <Button
                        disabled={disabled}
                        onClick={() => choose(product)}
                        size="compact"
                        variant="secondary"
                      >
                        Configure Line
                      </Button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                description="No active products match the current product, price-list, and stock filters."
                headingLevel="h3"
                title="No Products Found"
              />
            )}
            <div className="flex items-center justify-between gap-xs">
              <Button
                disabled={history.length === 0 || searching}
                onClick={() => void previousPage()}
                size="compact"
                variant="secondary"
              >
                Previous
              </Button>
              <span className="font-mono text-caption text-foreground-muted">
                {page.items.length} products
              </span>
              <Button
                disabled={!page.pageInfo.hasNextPage || searching}
                onClick={() => void nextPage()}
                size="compact"
                variant="secondary"
              >
                Next
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Dialog
        description="Choose line terms from the server-resolved product option. Final pricing is recalculated after the line is added."
        footer={
          <>
            <Button onClick={() => setSelected(null)} variant="quiet">
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              form={`${id}-add-line-form`}
              type="submit"
            >
              {isSubmitting ? "Adding Product…" : "Add Product"}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        open={selected !== null}
        title={selected ? `Add ${selected.name}` : "Add Product"}
      >
        <form
          className="grid gap-md"
          id={`${id}-add-line-form`}
          noValidate
          onSubmit={handleSubmit(add)}
        >
          {submitError ? <FieldError>{submitError}</FieldError> : null}
          <input {...register("productId")} type="hidden" />
          {selected && selected.options.some((option) => option.variantId) ? (
            <Field>
              <FieldLabel htmlFor={`${id}-variant`}>Variant</FieldLabel>
              <Select
                {...register("variantId", {
                  setValueAs: (value: unknown) =>
                    typeof value === "string" && value ? value : undefined,
                })}
                aria-invalid={Boolean(errors.variantId)}
                id={`${id}-variant`}
              >
                {selected.options.map((option) => (
                  <option
                    key={option.variantId ?? "standard"}
                    value={option.variantId ?? ""}
                  >
                    {optionLabel(option)}
                  </option>
                ))}
              </Select>
              {errors.variantId ? (
                <FieldError>{errors.variantId.message}</FieldError>
              ) : null}
            </Field>
          ) : null}
          {selected && selectedOption ? (
            <div className="grid gap-xs rounded-control border border-border bg-surface-subtle p-sm text-body-sm">
              <div className="flex items-center justify-between gap-sm">
                <span className="text-foreground-muted">
                  Resolved Unit Price
                </span>
                <strong className="font-mono tabular-nums text-foreground-strong">
                  {formatMoney(
                    selectedOption.resolvedUnitPrice,
                    selected.priceList.currency,
                    locale,
                  )}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-sm">
                <span className="text-foreground-muted">Available Stock</span>
                <strong className="font-mono tabular-nums text-foreground-strong">
                  {selectedOption.availableQuantity} {selected.unit}
                </strong>
              </div>
              <p className="m-0 text-caption text-foreground-muted">
                {selected.pricingExplanation}
              </p>
            </div>
          ) : null}
          <div className="grid gap-md sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${id}-quantity`}>Quantity</FieldLabel>
              <Input
                {...register("quantity")}
                aria-invalid={Boolean(errors.quantity)}
                autoComplete="off"
                id={`${id}-quantity`}
                inputMode="decimal"
                min="0.0001"
                step="0.0001"
                type="number"
              />
              {errors.quantity ? (
                <FieldError>{errors.quantity.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-discount`}>Discount %</FieldLabel>
              <Input
                {...register("discountPercent")}
                aria-invalid={Boolean(errors.discountPercent)}
                autoComplete="off"
                id={`${id}-discount`}
                inputMode="decimal"
                max="100"
                min="0"
                step="0.0001"
                type="number"
              />
              {errors.discountPercent ? (
                <FieldError>{errors.discountPercent.message}</FieldError>
              ) : null}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-billing-type`}>Billing Type</FieldLabel>
            <Select {...register("billingType")} id={`${id}-billing-type`}>
              <option value="ONE_TIME">One Time</option>
              <option value="RECURRING">Recurring</option>
            </Select>
          </Field>
          {billingType === "RECURRING" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-plan`}>Subscription Plan</FieldLabel>
              <Select
                {...register("subscriptionPlanId", {
                  setValueAs: (value: unknown) =>
                    typeof value === "string" && value ? value : undefined,
                })}
                aria-invalid={Boolean(errors.subscriptionPlanId)}
                id={`${id}-plan`}
              >
                <option value="">Select Plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}, every {plan.intervalCount}{" "}
                    {formatEnumLabel(plan.interval)}
                  </option>
                ))}
              </Select>
              <FieldDescription>
                Recurring lines require an active subscription plan.
              </FieldDescription>
              {errors.subscriptionPlanId ? (
                <FieldError>{errors.subscriptionPlanId.message}</FieldError>
              ) : null}
            </Field>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
