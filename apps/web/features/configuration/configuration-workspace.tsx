"use client";

import {
  BILLING_INTERVALS,
  CONFIGURATION_STATUSES,
  CreateApprovalPolicyRequestSchema,
  CreateCustomerAccountRequestSchema,
  CreateCustomerContactRequestSchema,
  CreateCustomerTierRequestSchema,
  CreateDiscountLimitRequestSchema,
  CreatePriceListRequestSchema,
  CreatePriceRuleRequestSchema,
  CreateProductCategoryRequestSchema,
  CreateProductRequestSchema,
  CreateProductVariantRequestSchema,
  CreatePromotionRequestSchema,
  CreateRecommendationRuleRequestSchema,
  CreateSubscriptionPlanRequestSchema,
  CreateTaxRequestSchema,
  CreateWarehouseRequestSchema,
  PRORATION_CONVENTIONS,
  PRODUCT_TYPES,
  TAX_BEHAVIORS,
  ApprovalPolicyDtoSchema,
  CustomerAccountDtoSchema,
  CustomerContactDtoSchema,
  CustomerTierDtoSchema,
  DiscountLimitDtoSchema,
  PriceListDtoSchema,
  PriceRuleDtoSchema,
  ProductCategoryDtoSchema,
  ProductDtoSchema,
  ProductVariantDtoSchema,
  PromotionDtoSchema,
  RecommendationRuleDtoSchema,
  SubscriptionPlanDtoSchema,
  TaxDtoSchema,
  UpdateApprovalPolicyRequestSchema,
  UpdateCustomerAccountRequestSchema,
  UpdateCustomerContactRequestSchema,
  UpdateCustomerTierRequestSchema,
  UpdateDiscountLimitRequestSchema,
  UpdatePriceListRequestSchema,
  UpdatePriceRuleRequestSchema,
  UpdateProductCategoryRequestSchema,
  UpdateProductRequestSchema,
  UpdateProductVariantRequestSchema,
  UpdatePromotionRequestSchema,
  UpdateRecommendationRuleRequestSchema,
  UpdateSubscriptionPlanRequestSchema,
  UpdateTaxRequestSchema,
  UpdateWarehouseRequestSchema,
  WarehouseDtoSchema,
  apiRoutes,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  formatPercentage,
  planApiRoutes,
  type ApprovalPolicyDto,
  type ConfigurationStatus,
  type CustomerAccountDto,
  type CustomerContactDto,
  type CustomerTierDto,
  type DiscountLimitDto,
  type PriceListDto,
  type PriceRuleDto,
  type ProductCategoryDto,
  type ProductDto,
  type ProductVariantDto,
  type PromotionDto,
  type RecommendationRuleDto,
  type SubscriptionPlanDto,
  type TaxDto,
  type WarehouseDto,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  CheckboxField,
  DataTable,
  DataTableBody,
  DataTableCaption,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  Drawer,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  InlineFeedback,
  Input,
  LiveRegion,
  PageHeader,
  Select,
  Textarea,
} from "@repo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

const settingsLinks = [
  { href: "/settings/customers", key: "customers", label: "Customers" },
  { href: "/settings/products", key: "products", label: "Products" },
  { href: "/settings/price-lists", key: "price-lists", label: "Price Lists" },
  {
    href: "/settings/discount-policies",
    key: "discount-policies",
    label: "Discount Policies",
  },
  {
    href: "/settings/approval-chains",
    key: "approval-chains",
    label: "Approval Chains",
  },
  { href: "/settings/warehouses", key: "warehouses", label: "Warehouses" },
  {
    href: "/settings/subscription-plans",
    key: "subscription-plans",
    label: "Subscription Plans",
  },
  {
    href: "/settings/recommendations",
    key: "recommendations",
    label: "Recommendations",
  },
  { href: "/settings/promotions", key: "promotions", label: "Promotions" },
] as const;

type SettingsKey = (typeof settingsLinks)[number]["key"];
type CatalogView = "categories" | "products" | "taxes" | "variants";
type CustomerView = "accounts" | "contacts" | "tiers";
type PriceListView = "lists" | "rules";
type FieldErrors = Readonly<Record<string, string>>;

type ConfigurationItem =
  | ApprovalPolicyDto
  | CustomerAccountDto
  | CustomerContactDto
  | CustomerTierDto
  | DiscountLimitDto
  | PriceListDto
  | PriceRuleDto
  | ProductCategoryDto
  | ProductDto
  | ProductVariantDto
  | PromotionDto
  | RecommendationRuleDto
  | SubscriptionPlanDto
  | TaxDto
  | WarehouseDto;

interface FieldOption {
  label: string;
  value: string;
}

interface FieldDescriptor {
  description?: string;
  inputMode?: "decimal" | "numeric" | "text";
  label: string;
  max?: string;
  min?: string;
  name: string;
  options?: readonly FieldOption[];
  placeholder?: string;
  required?: boolean;
  rows?: number;
  step?: string;
  type:
    | "checkboxes"
    | "datetime"
    | "email"
    | "number"
    | "select"
    | "text"
    | "textarea";
}

type ParseResult =
  | { data: unknown; success: true }
  | { errors: Record<string, string>; success: false };

interface Column<T> {
  cell: (item: T) => ReactNode;
  label: string;
  numeric?: boolean;
}

interface ResourceDefinition<T extends ConfigurationItem> {
  catalogView?: CatalogView;
  columns: readonly Column<T>[];
  contextControls?: ReactNode;
  createPath: string;
  customerView?: CustomerView;
  description: string;
  fields: (item: T | null) => readonly FieldDescriptor[];
  initialValues: (item: T | null) => Readonly<Record<string, string>>;
  itemLabel: (item: T) => string;
  key: SettingsKey;
  pagePath: string;
  priceListView?: PriceListView;
  queryParams?: Readonly<Record<string, string>>;
  parse: (formData: FormData, item: T | null) => ParseResult;
  responseSchema: z.ZodType<T>;
  searchText: (item: T) => string;
  singular: string;
  title: string;
  updatePath: (item: T) => string;
}

interface ResourceWorkspaceProps<T extends ConfigurationItem> {
  canManage: boolean;
  definition: ResourceDefinition<T>;
  items: readonly T[];
  search: string;
}

class FieldParseError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "FieldParseError";
    this.field = field;
  }
}

function statusTone(status: ConfigurationStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "ARCHIVED") return "neutral" as const;
  return "warning" as const;
}

function statusBadge(status: ConfigurationStatus) {
  return <Badge tone={statusTone(status)}>{formatEnumLabel(status)}</Badge>;
}

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, name: string): string | undefined {
  const value = textValue(formData, name);
  return value.length > 0 ? value : undefined;
}

function numberValue(formData: FormData, name: string): number {
  const value = textValue(formData, name);
  return value.length === 0 ? Number.NaN : Number(value);
}

function toIsoDateTime(value: string): string {
  if (value.length === 0) return value;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
}

function optionalIsoDateTime(
  formData: FormData,
  name: string,
): string | undefined {
  const value = optionalText(formData, name);
  return value === undefined ? undefined : toIsoDateTime(value);
}

function dateTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function jsonObjectValue(formData: FormData, name: string): object {
  const source = textValue(formData, name);
  try {
    const value: unknown = JSON.parse(source);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Enter a JSON object enclosed in braces.");
    }
    return value;
  } catch (error) {
    throw new FieldParseError(
      name,
      error instanceof SyntaxError
        ? "Enter valid JSON with double-quoted property names."
        : error instanceof Error
          ? error.message
          : "Enter a valid JSON object.",
    );
  }
}

function jsonArrayValue(formData: FormData, name: string): unknown[] {
  const source = textValue(formData, name);
  try {
    const value: unknown = JSON.parse(source);
    if (!Array.isArray(value)) {
      throw new TypeError("Enter a JSON array enclosed in brackets.");
    }
    return value;
  } catch (error) {
    throw new FieldParseError(
      name,
      error instanceof SyntaxError
        ? "Enter valid JSON with double-quoted property names."
        : error instanceof Error
          ? error.message
          : "Enter a valid JSON array.",
    );
  }
}

function addressValue(formData: FormData): object | string {
  const value = textValue(formData, "address");
  if (!value.startsWith("{")) return value;
  return jsonObjectValue(formData, "address");
}

function validationResult(schema: z.ZodType, candidate: unknown): ParseResult {
  const parsed = schema.safeParse(candidate);
  if (parsed.success) return { data: parsed.data, success: true };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "_form");
    errors[field] ??= issue.message;
  }
  return { errors, success: false };
}

function safelyParse(schema: z.ZodType, candidate: () => unknown): ParseResult {
  try {
    return validationResult(schema, candidate());
  } catch (error) {
    if (error instanceof FieldParseError) {
      return { errors: { [error.field]: error.message }, success: false };
    }
    return {
      errors: { _form: "The form could not be read. Check every field." },
      success: false,
    };
  }
}

function errorsFromApi(error: ApiProblemError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.problem.errors ?? []) {
    const field = String(issue.path[0] ?? "_form");
    errors[field] ??= issue.message;
  }
  return errors;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The configuration could not be saved. Check the service and try again.";
}

function jsonText(value: object | readonly unknown[]): string {
  return JSON.stringify(value, null, 2);
}

function statusField(): FieldDescriptor {
  return {
    label: "Status",
    name: "status",
    options: CONFIGURATION_STATUSES.map((status) => ({
      label: formatEnumLabel(status),
      value: status,
    })),
    required: true,
    type: "select",
  };
}

function optionList(values: readonly string[]): readonly FieldOption[] {
  return values.map((value) => ({
    label: formatEnumLabel(value),
    value,
  }));
}

function referenceOptions<T extends { id: string; name: string }>(
  values: readonly T[],
  emptyLabel?: string,
): readonly FieldOption[] {
  return [
    ...(emptyLabel ? [{ label: emptyLabel, value: "" }] : []),
    ...values.map((value) => ({ label: value.name, value: value.id })),
  ];
}

function ConfigurationNavigation({ active }: { active: SettingsKey }) {
  return (
    <nav
      aria-label="Configuration sections"
      className="flex overflow-x-auto border-b border-border"
    >
      {settingsLinks.map((link) => (
        <Link
          aria-current={active === link.key ? "page" : undefined}
          className={
            active === link.key
              ? "min-h-touch shrink-0 border-b-2 border-brand bg-brand-subtle px-sm py-xs text-body-sm font-semibold text-brand"
              : "min-h-touch shrink-0 border-b-2 border-transparent px-sm py-xs text-body-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-subtle hover:text-foreground-strong"
          }
          href={link.href}
          key={link.key}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function CatalogNavigation({ active }: { active: CatalogView }) {
  const links: ReadonlyArray<{
    href: string;
    key: CatalogView;
    label: string;
  }> = [
    { href: "/settings/products", key: "products", label: "Products" },
    {
      href: "/settings/products?view=categories",
      key: "categories",
      label: "Categories",
    },
    { href: "/settings/products?view=taxes", key: "taxes", label: "Taxes" },
    {
      href: "/settings/products?view=variants",
      key: "variants",
      label: "Variants",
    },
  ];

  return (
    <nav aria-label="Catalog configuration" className="flex flex-wrap gap-xs">
      {links.map((link) => (
        <Link
          aria-current={active === link.key ? "page" : undefined}
          className={
            active === link.key
              ? "min-h-control rounded-control border border-brand bg-brand-subtle px-sm py-xxs text-caption font-semibold text-brand"
              : "min-h-control rounded-control border border-border-strong bg-surface px-sm py-xxs text-caption font-semibold text-foreground transition-colors hover:bg-surface-subtle hover:text-foreground-strong"
          }
          href={link.href}
          key={link.key}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function CustomerNavigation({
  active,
  customerId,
}: {
  active: CustomerView;
  customerId?: string;
}) {
  const contactParameters = new URLSearchParams({ view: "contacts" });
  if (customerId) contactParameters.set("customerId", customerId);
  const links: ReadonlyArray<{
    href: string;
    key: CustomerView;
    label: string;
  }> = [
    { href: "/settings/customers", key: "accounts", label: "Accounts" },
    {
      href: "/settings/customers?view=tiers",
      key: "tiers",
      label: "Tiers",
    },
    {
      href: `/settings/customers?${contactParameters.toString()}`,
      key: "contacts",
      label: "Contacts",
    },
  ];

  return (
    <nav aria-label="Customer configuration" className="flex flex-wrap gap-xs">
      {links.map((link) => (
        <Link
          aria-current={active === link.key ? "page" : undefined}
          className={
            active === link.key
              ? "min-h-control rounded-control border border-brand bg-brand-subtle px-sm py-xxs text-caption font-semibold text-brand"
              : "min-h-control rounded-control border border-border-strong bg-surface px-sm py-xxs text-caption font-semibold text-foreground transition-colors hover:bg-surface-subtle hover:text-foreground-strong"
          }
          href={link.href}
          key={link.key}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function PriceListNavigation({
  active,
  priceListId,
}: {
  active: PriceListView;
  priceListId?: string;
}) {
  const ruleParameters = new URLSearchParams({ view: "rules" });
  if (priceListId) ruleParameters.set("priceListId", priceListId);
  const links: ReadonlyArray<{
    href: string;
    key: PriceListView;
    label: string;
  }> = [
    { href: "/settings/price-lists", key: "lists", label: "Price Lists" },
    {
      href: `/settings/price-lists?${ruleParameters.toString()}`,
      key: "rules",
      label: "Price Rules",
    },
  ];

  return (
    <nav aria-label="Price configuration" className="flex flex-wrap gap-xs">
      {links.map((link) => (
        <Link
          aria-current={active === link.key ? "page" : undefined}
          className={
            active === link.key
              ? "min-h-control rounded-control border border-brand bg-brand-subtle px-sm py-xxs text-caption font-semibold text-brand"
              : "min-h-control rounded-control border border-border-strong bg-surface px-sm py-xxs text-caption font-semibold text-foreground transition-colors hover:bg-surface-subtle hover:text-foreground-strong"
          }
          href={link.href}
          key={link.key}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function ConfigurationField({
  descriptor,
  error,
  initialValue,
}: {
  descriptor: FieldDescriptor;
  error?: string;
  initialValue: string;
}) {
  const fieldId = useId();
  const descriptionId = descriptor.description ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");
  const shared = {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : undefined,
    id: fieldId,
    name: descriptor.name,
    required: descriptor.required,
  } as const;

  if (descriptor.type === "checkboxes") {
    let selectedValues = new Set<string>();
    try {
      const parsed: unknown = JSON.parse(initialValue || "[]");
      if (Array.isArray(parsed)) {
        selectedValues = new Set(
          parsed.filter((value): value is string => typeof value === "string"),
        );
      }
    } catch {
      selectedValues = new Set();
    }
    return (
      <FieldGroup
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        aria-required={descriptor.required}
      >
        <FieldLegend>{descriptor.label}</FieldLegend>
        <div className="grid max-h-64 gap-xs overflow-y-auto rounded-control border border-border p-sm sm:grid-cols-2">
          {descriptor.options?.map((option, index) => {
            const optionId = `${fieldId}-${index}`;
            return (
              <CheckboxField
                checkbox={
                  <Checkbox
                    defaultChecked={selectedValues.has(option.value)}
                    id={optionId}
                    name={descriptor.name}
                    value={option.value}
                  />
                }
                key={`${descriptor.name}-${option.value}`}
              >
                {option.label}
              </CheckboxField>
            );
          })}
        </div>
        {descriptor.description ? (
          <FieldDescription id={descriptionId}>
            {descriptor.description}
          </FieldDescription>
        ) : null}
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </FieldGroup>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>{descriptor.label}</FieldLabel>
      {descriptor.type === "select" ? (
        <Select defaultValue={initialValue} {...shared}>
          {descriptor.options?.map((option) => (
            <option
              key={`${descriptor.name}-${option.value}`}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </Select>
      ) : descriptor.type === "textarea" ? (
        <Textarea
          autoComplete="off"
          defaultValue={initialValue}
          placeholder={descriptor.placeholder}
          rows={descriptor.rows ?? 5}
          {...shared}
        />
      ) : (
        <Input
          autoComplete="off"
          defaultValue={initialValue}
          inputMode={descriptor.inputMode}
          max={descriptor.max}
          min={descriptor.min}
          placeholder={descriptor.placeholder}
          step={descriptor.step}
          type={
            descriptor.type === "datetime" ? "datetime-local" : descriptor.type
          }
          {...(descriptor.type === "email" ? { spellCheck: false } : {})}
          {...shared}
        />
      )}
      {descriptor.description ? (
        <FieldDescription id={descriptionId}>
          {descriptor.description}
        </FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

function resourceQueryParameters<T extends ConfigurationItem>(
  definition: ResourceDefinition<T>,
): URLSearchParams {
  const parameters = new URLSearchParams(definition.queryParams);
  if (definition.catalogView && definition.catalogView !== "products") {
    parameters.set("view", definition.catalogView);
  }
  if (definition.customerView && definition.customerView !== "accounts") {
    parameters.set("view", definition.customerView);
  }
  if (definition.priceListView === "rules") {
    parameters.set("view", "rules");
  }
  return parameters;
}

function resourceClearHref<T extends ConfigurationItem>(
  definition: ResourceDefinition<T>,
): string {
  const parameters = resourceQueryParameters(definition);
  const query = parameters.toString();
  return query ? `${definition.pagePath}?${query}` : definition.pagePath;
}

function ResourceWorkspace<T extends ConfigurationItem>({
  canManage,
  definition,
  items,
  search,
}: ResourceWorkspaceProps<T>) {
  const router = useRouter();
  const formId = useId();
  const [editorItem, setEditorItem] = useState<T | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"danger" | "success">(
    "success",
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleItems = normalizedSearch
    ? items.filter((item) =>
        definition
          .searchText(item)
          .toLocaleLowerCase()
          .includes(normalizedSearch),
      )
    : items;
  const isEditorOpen = editorItem !== undefined;
  const isEditing = editorItem !== null && editorItem !== undefined;
  const editorFields = definition.fields(editorItem ?? null);
  const initialValues = definition.initialValues(editorItem ?? null);

  function openCreate() {
    setErrors({});
    setMessage("");
    setEditorItem(null);
  }

  function openEdit(item: T) {
    setErrors({});
    setMessage("");
    setEditorItem(item);
  }

  function closeEditor() {
    if (!busy) {
      setEditorItem(undefined);
      setErrors({});
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item = editorItem ?? null;
    const parsed = definition.parse(new FormData(event.currentTarget), item);
    if (!parsed.success) {
      setErrors(parsed.errors);
      setMessageTone("danger");
      setMessage("Check the highlighted fields before saving.");
      return;
    }

    setBusy(true);
    setErrors({});
    setMessage("");
    try {
      const saved = await browserApiRequest(
        item ? definition.updatePath(item) : definition.createPath,
        {
          json: parsed.data,
          method: item ? "PATCH" : "POST",
          schema: definition.responseSchema,
          scope: "internal",
        },
      );
      setMessageTone("success");
      setMessage(
        `${item ? "Updated" : "Created"} ${definition.itemLabel(saved)}.`,
      );
      setEditorItem(undefined);
      router.refresh();
    } catch (error) {
      setMessageTone("danger");
      setMessage(errorMessage(error));
      if (error instanceof ApiProblemError) setErrors(errorsFromApi(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={openCreate}>New {definition.singular}</Button>
          ) : null
        }
        description={definition.description}
        metadata={`${items.length} ${items.length === 1 ? "record" : "records"}`}
        title={definition.title}
      />

      <ConfigurationNavigation active={definition.key} />

      {definition.catalogView ? (
        <CatalogNavigation active={definition.catalogView} />
      ) : null}

      {definition.customerView ? (
        <CustomerNavigation
          active={definition.customerView}
          customerId={definition.queryParams?.["customerId"]}
        />
      ) : null}

      {definition.priceListView ? (
        <PriceListNavigation
          active={definition.priceListView}
          priceListId={definition.queryParams?.["priceListId"]}
        />
      ) : null}

      {definition.contextControls}

      <form
        action={definition.pagePath}
        className="flex flex-wrap items-end gap-xs"
      >
        {[...resourceQueryParameters(definition)].map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor={`${formId}-search`}>
            Search {definition.title}
          </FieldLabel>
          <Input
            autoComplete="off"
            defaultValue={search}
            id={`${formId}-search`}
            name="search"
            placeholder={`Search ${definition.title.toLocaleLowerCase()}…`}
            type="search"
          />
        </Field>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {search ? (
          <ButtonLink href={resourceClearHref(definition)} variant="quiet">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      {message && !isEditorOpen ? (
        <InlineFeedback
          title={messageTone === "success" ? "Saved" : "Not Saved"}
          tone={messageTone}
        >
          {message}
        </InlineFeedback>
      ) : null}
      <LiveRegion
        message={message}
        politeness={messageTone === "danger" ? "assertive" : "polite"}
      />

      {visibleItems.length > 0 ? (
        <>
          <div className="grid gap-sm md:hidden">
            {visibleItems.map((item) => (
              <article
                className="grid gap-sm rounded-panel border border-border bg-surface p-md"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <h2 className="m-0 truncate text-body-sm font-semibold text-foreground-strong">
                      {definition.itemLabel(item)}
                    </h2>
                    <p className="m-0 truncate font-mono text-caption text-foreground-muted">
                      {"code" in item ? item.code : item.id}
                    </p>
                  </div>
                  {statusBadge(item.status)}
                </div>
                <dl className="m-0 grid grid-cols-2 gap-sm text-caption">
                  {definition.columns.slice(1, 3).map((column) => (
                    <div key={column.label}>
                      <dt className="text-foreground-muted">{column.label}</dt>
                      <dd className="m-0 break-words text-foreground-strong">
                        {column.cell(item)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {canManage ? (
                  <Button
                    onClick={() => openEdit(item)}
                    size="compact"
                    variant="secondary"
                  >
                    Edit {definition.singular}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable aria-label={`${definition.title} configuration`}>
              <DataTableCaption visuallyHidden>
                Searchable {definition.title.toLocaleLowerCase()} configuration
              </DataTableCaption>
              <DataTableHeader>
                <DataTableRow>
                  {definition.columns.map((column) => (
                    <DataTableHead key={column.label} numeric={column.numeric}>
                      {column.label}
                    </DataTableHead>
                  ))}
                  {canManage ? <DataTableHead>Actions</DataTableHead> : null}
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {visibleItems.map((item) => (
                  <DataTableRow key={item.id}>
                    {definition.columns.map((column) => (
                      <DataTableCell
                        key={column.label}
                        numeric={column.numeric}
                      >
                        {column.cell(item)}
                      </DataTableCell>
                    ))}
                    {canManage ? (
                      <DataTableCell>
                        <Button
                          onClick={() => openEdit(item)}
                          size="compact"
                          variant="quiet"
                        >
                          Edit
                        </Button>
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        </>
      ) : (
        <EmptyState
          action={
            search ? (
              <ButtonLink
                href={resourceClearHref(definition)}
                variant="secondary"
              >
                Clear Search
              </ButtonLink>
            ) : canManage ? (
              <Button onClick={openCreate}>Create {definition.singular}</Button>
            ) : undefined
          }
          description={
            search
              ? `No ${definition.title.toLocaleLowerCase()} match “${search}”.`
              : `Create the first ${definition.singular.toLocaleLowerCase()} to begin configuring this workflow.`
          }
          title={search ? "No Matching Records" : `No ${definition.title} Yet`}
        />
      )}

      <Drawer
        description={
          isEditing
            ? "Update governed fields. The server validates references, effective dates, overlaps, and revisions before saving."
            : "Create a governed record. Server validation remains authoritative."
        }
        footer={
          <>
            <Button disabled={busy} onClick={closeEditor} variant="quiet">
              Cancel
            </Button>
            <Button disabled={busy} form={formId} type="submit">
              {busy
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : `Create ${definition.singular}`}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
        open={isEditorOpen}
        title={
          isEditing
            ? `Edit ${definition.singular}`
            : `New ${definition.singular}`
        }
      >
        <form
          className="grid gap-md"
          id={formId}
          key={isEditing ? editorItem.id : "create"}
          onSubmit={submit}
        >
          {message && isEditorOpen ? (
            messageTone === "danger" ? (
              <ErrorFeedback title="Not Saved">{message}</ErrorFeedback>
            ) : (
              <InlineFeedback title="Saved" tone="success">
                {message}
              </InlineFeedback>
            )
          ) : null}
          {errors._form ? <ErrorFeedback>{errors._form}</ErrorFeedback> : null}
          {editorFields.map((descriptor) => (
            <ConfigurationField
              descriptor={descriptor}
              error={errors[descriptor.name]}
              initialValue={initialValues[descriptor.name] ?? ""}
              key={descriptor.name}
            />
          ))}
        </form>
      </Drawer>
    </div>
  );
}

function ProductSettings({
  baseCurrency,
  canManage,
  categories,
  items,
  search,
  taxes,
}: {
  baseCurrency: string;
  canManage: boolean;
  categories: readonly ProductCategoryDto[];
  items: readonly ProductDto[];
  search: string;
  taxes: readonly TaxDto[];
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<ProductDto> = {
    catalogView: "products",
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Product",
      },
      { cell: (item) => item.category.name, label: "Category" },
      { cell: (item) => formatEnumLabel(item.type), label: "Type" },
      { cell: (item) => item.unit, label: "Unit" },
      {
        cell: (item) => formatMoney(item.standardCost, baseCurrency, locale),
        label: "Standard Cost",
        numeric: true,
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.catalog.products,
    description:
      "Manage saleable products, catalog classification, cost basis, tax treatment, and lifecycle state.",
    fields: (item) => [
      { label: "Code", name: "code", required: true, type: "text" },
      { label: "Name", name: "name", required: true, type: "text" },
      {
        label: "Category",
        name: "categoryId",
        options: referenceOptions(categories),
        required: true,
        type: "select",
      },
      {
        label: "Tax",
        name: "taxId",
        options: referenceOptions(taxes, "No Tax"),
        type: "select",
      },
      {
        label: "Product Type",
        name: "type",
        options: optionList(PRODUCT_TYPES),
        required: true,
        type: "select",
      },
      { label: "Unit", name: "unit", required: true, type: "text" },
      {
        inputMode: "decimal",
        label: "Standard Cost",
        name: "standardCost",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        label: "Description",
        name: "description",
        rows: 4,
        type: "textarea",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      categoryId: item?.categoryId ?? categories[0]?.id ?? "",
      code: item?.code ?? "",
      description: item?.description ?? "",
      name: item?.name ?? "",
      standardCost: item?.standardCost ?? "0",
      status: item?.status ?? "ACTIVE",
      taxId: item?.taxId ?? "",
      type: item?.type ?? "HARDWARE",
      unit: item?.unit ?? "each",
    }),
    itemLabel: (item) => item.name,
    key: "products",
    pagePath: "/settings/products",
    parse: (formData, item) =>
      safelyParse(
        item ? UpdateProductRequestSchema : CreateProductRequestSchema,
        () => ({
          categoryId: textValue(formData, "categoryId"),
          code: textValue(formData, "code"),
          description: optionalText(formData, "description"),
          name: textValue(formData, "name"),
          standardCost: textValue(formData, "standardCost"),
          taxId: item
            ? (optionalText(formData, "taxId") ?? null)
            : optionalText(formData, "taxId"),
          type: textValue(formData, "type"),
          unit: textValue(formData, "unit"),
          ...(item
            ? { revision: item.revision, status: textValue(formData, "status") }
            : {}),
        }),
      ),
    responseSchema: ProductDtoSchema,
    searchText: (item) =>
      [
        item.code,
        item.name,
        item.category.name,
        item.type,
        ...item.variants.map((variant) => variant.sku),
      ].join(" "),
    singular: "Product",
    title: "Products",
    updatePath: (item) => apiRoutes.catalog.product(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function ProductCategorySettings({
  canManage,
  items,
  search,
}: {
  canManage: boolean;
  items: readonly ProductCategoryDto[];
  search: string;
}) {
  const categoryName = (id: string | null) =>
    id
      ? (items.find((category) => category.id === id)?.name ?? "Category")
      : "Top Level";
  const definition: ResourceDefinition<ProductCategoryDto> = {
    catalogView: "categories",
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Category",
      },
      { cell: (item) => categoryName(item.parentId), label: "Parent" },
      { cell: (item) => `Revision ${item.revision}`, label: "Revision" },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.catalog.productCategories,
    description:
      "Organize products into governed categories used by pricing, discount ceilings, and reporting.",
    fields: (item) => [
      { label: "Code", name: "code", required: true, type: "text" },
      { label: "Name", name: "name", required: true, type: "text" },
      {
        description: "Optional. A category cannot be its own parent.",
        label: "Parent Category",
        name: "parentId",
        options: referenceOptions(
          items.filter((category) => category.id !== item?.id),
          "Top Level",
        ),
        type: "select",
      },
      {
        label: "Description",
        name: "description",
        rows: 4,
        type: "textarea",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      code: item?.code ?? "",
      description: item?.description ?? "",
      name: item?.name ?? "",
      parentId: item?.parentId ?? "",
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "products",
    pagePath: "/settings/products",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateProductCategoryRequestSchema
          : CreateProductCategoryRequestSchema,
        () => ({
          code: textValue(formData, "code"),
          description: optionalText(formData, "description"),
          name: textValue(formData, "name"),
          parentId: item
            ? (optionalText(formData, "parentId") ?? null)
            : optionalText(formData, "parentId"),
          ...(item
            ? { revision: item.revision, status: textValue(formData, "status") }
            : {}),
        }),
      ),
    responseSchema: ProductCategoryDtoSchema,
    searchText: (item) =>
      [item.code, item.name, categoryName(item.parentId), item.status].join(
        " ",
      ),
    singular: "Product Category",
    title: "Product Categories",
    updatePath: (item) => apiRoutes.catalog.productCategory(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function TaxSettings({
  canManage,
  items,
  search,
  timeZone,
}: {
  canManage: boolean;
  items: readonly TaxDto[];
  search: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<TaxDto> = {
    catalogView: "taxes",
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Tax",
      },
      {
        cell: (item) => formatPercentage(item.rate, locale),
        label: "Rate",
        numeric: true,
      },
      { cell: (item) => formatEnumLabel(item.behavior), label: "Behavior" },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      {
        cell: (item) =>
          item.effectiveTo
            ? formatDateTime(item.effectiveTo, locale, timeZone)
            : "Open Ended",
        label: "Effective To",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.pricing.taxes,
    description:
      "Maintain inclusive or exclusive tax rates and the effective periods used by server calculations.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Code", name: "code", type: "text" },
            { label: "Name", name: "name", required: true, type: "text" },
            {
              label: "Effective From",
              name: "effectiveFrom",
              required: true,
              type: "datetime",
            },
          ] satisfies FieldDescriptor[])
        : []),
      {
        description: "Enter a percentage from 0 through 100.",
        inputMode: "decimal",
        label: "Rate",
        name: "rate",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        label: "Tax Behavior",
        name: "behavior",
        options: optionList(TAX_BEHAVIORS),
        required: true,
        type: "select",
      },
      {
        description: "Leave blank for an open-ended tax rate.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      behavior: item?.behavior ?? "EXCLUSIVE",
      code: item?.code ?? "",
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      name: item?.name ?? "",
      rate: item?.rate ?? "0",
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "products",
    pagePath: "/settings/products",
    parse: (formData, item) =>
      safelyParse(item ? UpdateTaxRequestSchema : CreateTaxRequestSchema, () =>
        item
          ? {
              behavior: textValue(formData, "behavior"),
              effectiveTo: optionalIsoDateTime(formData, "effectiveTo") ?? null,
              rate: textValue(formData, "rate"),
              status: textValue(formData, "status"),
            }
          : {
              behavior: textValue(formData, "behavior"),
              code: optionalText(formData, "code"),
              effectiveFrom: toIsoDateTime(
                textValue(formData, "effectiveFrom"),
              ),
              effectiveTo: optionalIsoDateTime(formData, "effectiveTo"),
              name: textValue(formData, "name"),
              rate: textValue(formData, "rate"),
            },
      ),
    responseSchema: TaxDtoSchema,
    searchText: (item) =>
      [item.code, item.name, item.behavior, item.status].join(" "),
    singular: "Tax Rate",
    title: "Taxes",
    updatePath: (item) => apiRoutes.pricing.tax(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function PriceListSettings({
  canManage,
  items,
  search,
  timeZone,
}: {
  canManage: boolean;
  items: readonly PriceListDto[];
  search: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<PriceListDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Price List",
      },
      { cell: (item) => item.currency, label: "Currency" },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      {
        cell: (item) =>
          item.effectiveTo
            ? formatDateTime(item.effectiveTo, locale, timeZone)
            : "Open Ended",
        label: "Effective To",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.pricing.priceLists,
    description:
      "Control currency-specific price books, precedence, effective periods, and active state.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Code", name: "code", type: "text" },
            {
              label: "Currency",
              name: "currency",
              placeholder: "Example: USD…",
              required: true,
              type: "text",
            },
            {
              label: "Effective From",
              name: "effectiveFrom",
              required: true,
              type: "datetime",
            },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      {
        description: "Leave blank for an open-ended price list.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      code: item?.code ?? "",
      currency: item?.currency ?? "USD",
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      name: item?.name ?? "",
      priority: String(item?.priority ?? 0),
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "price-lists",
    pagePath: "/settings/price-lists",
    priceListView: "lists",
    parse: (formData, item) =>
      safelyParse(
        item ? UpdatePriceListRequestSchema : CreatePriceListRequestSchema,
        () =>
          item
            ? {
                effectiveTo:
                  optionalIsoDateTime(formData, "effectiveTo") ?? null,
                name: textValue(formData, "name"),
                priority: numberValue(formData, "priority"),
                status: textValue(formData, "status"),
              }
            : {
                code: optionalText(formData, "code"),
                currency: textValue(formData, "currency").toUpperCase(),
                effectiveFrom: toIsoDateTime(
                  textValue(formData, "effectiveFrom"),
                ),
                effectiveTo: optionalIsoDateTime(formData, "effectiveTo"),
                name: textValue(formData, "name"),
                priority: numberValue(formData, "priority"),
              },
      ),
    responseSchema: PriceListDtoSchema,
    searchText: (item) =>
      [item.code, item.name, item.currency, item.status].join(" "),
    singular: "Price List",
    title: "Price Lists",
    updatePath: (item) => apiRoutes.pricing.priceList(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function priceRuleScope(
  item: PriceRuleDto,
  products: readonly ProductDto[],
  categories: readonly ProductCategoryDto[],
): string {
  if (item.productId) {
    return (
      products.find((product) => product.id === item.productId)?.name ??
      "Archived Product"
    );
  }
  if (item.categoryId) {
    return (
      categories.find((category) => category.id === item.categoryId)?.name ??
      "Archived Category"
    );
  }
  return "Invalid Scope";
}

function PriceRuleSettings({
  canManage,
  categories,
  items,
  priceLists,
  products,
  search,
  selectedPriceListId,
  tiers,
  timeZone,
}: {
  canManage: boolean;
  categories: readonly ProductCategoryDto[];
  items: readonly PriceRuleDto[];
  priceLists: readonly PriceListDto[];
  products: readonly ProductDto[];
  search: string;
  selectedPriceListId?: string;
  tiers: readonly CustomerTierDto[];
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const selectedPriceList = priceLists.find(
    (priceList) => priceList.id === selectedPriceListId,
  );
  const definition: ResourceDefinition<PriceRuleDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {priceRuleScope(item, products, categories)}
            </span>
            <span className="block text-caption text-foreground-muted">
              {item.tierId
                ? (tiers.find((tier) => tier.id === item.tierId)?.name ??
                  "Archived Tier")
                : "All Customer Tiers"}
            </span>
          </div>
        ),
        label: "Scope",
      },
      {
        cell: (item) => item.minQuantity,
        label: "Minimum Quantity",
        numeric: true,
      },
      {
        cell: (item) =>
          selectedPriceList
            ? formatMoney(item.unitPrice, selectedPriceList.currency, locale)
            : item.unitPrice,
        label: "Unit Price",
        numeric: true,
      },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    contextControls: (
      <form
        action="/settings/price-lists"
        className="flex flex-wrap items-end gap-xs"
      >
        <input name="view" type="hidden" value="rules" />
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="rule-price-list">Price List</FieldLabel>
          <Select
            defaultValue={selectedPriceListId ?? ""}
            id="rule-price-list"
            name="priceListId"
          >
            {priceLists.map((priceList) => (
              <option key={priceList.id} value={priceList.id}>
                {priceList.name} ({priceList.currency})
              </option>
            ))}
          </Select>
        </Field>
        <Button
          disabled={priceLists.length === 0}
          type="submit"
          variant="secondary"
        >
          View Price Rules
        </Button>
      </form>
    ),
    createPath: selectedPriceListId
      ? apiRoutes.pricing.priceRules(selectedPriceListId)
      : apiRoutes.pricing.priceLists,
    description: selectedPriceList
      ? `Manage effective, quantity-aware product and category prices in ${selectedPriceList.name}.`
      : "Create a price list before adding product or category price rules.",
    fields: (item) => [
      ...(!item
        ? ([
            {
              description:
                "Choose a product or category. If both are selected, the product must belong to that category.",
              label: "Product",
              name: "productId",
              options: referenceOptions(products, "No Product Scope"),
              type: "select",
            },
            {
              label: "Product Category",
              name: "categoryId",
              options: referenceOptions(categories, "No Category Scope"),
              type: "select",
            },
            {
              label: "Customer Tier",
              name: "tierId",
              options: referenceOptions(tiers, "All Customer Tiers"),
              type: "select",
            },
            {
              label: "Effective From",
              name: "effectiveFrom",
              required: true,
              type: "datetime",
            },
          ] satisfies FieldDescriptor[])
        : []),
      {
        inputMode: "decimal",
        label: "Minimum Quantity",
        min: "0.0001",
        name: "minQuantity",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Unit Price",
        min: "0",
        name: "unitPrice",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      {
        description: "Leave blank for an open-ended price rule.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      categoryId: item?.categoryId ?? "",
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      minQuantity: item?.minQuantity ?? "1",
      priority: String(item?.priority ?? 0),
      productId: item?.productId ?? "",
      status: item?.status ?? "ACTIVE",
      tierId: item?.tierId ?? "",
      unitPrice: item?.unitPrice ?? "0",
    }),
    itemLabel: (item) => priceRuleScope(item, products, categories),
    key: "price-lists",
    pagePath: "/settings/price-lists",
    parse: (formData, item) =>
      safelyParse(
        item ? UpdatePriceRuleRequestSchema : CreatePriceRuleRequestSchema,
        () => ({
          effectiveTo: item
            ? (optionalIsoDateTime(formData, "effectiveTo") ?? null)
            : optionalIsoDateTime(formData, "effectiveTo"),
          minQuantity: textValue(formData, "minQuantity"),
          priority: numberValue(formData, "priority"),
          unitPrice: textValue(formData, "unitPrice"),
          ...(item
            ? { status: textValue(formData, "status") }
            : {
                categoryId: optionalText(formData, "categoryId"),
                effectiveFrom: toIsoDateTime(
                  textValue(formData, "effectiveFrom"),
                ),
                productId: optionalText(formData, "productId"),
                tierId: optionalText(formData, "tierId"),
              }),
        }),
      ),
    priceListView: "rules",
    queryParams: selectedPriceListId
      ? { priceListId: selectedPriceListId }
      : undefined,
    responseSchema: PriceRuleDtoSchema,
    searchText: (item) =>
      [
        priceRuleScope(item, products, categories),
        tiers.find((tier) => tier.id === item.tierId)?.name,
        item.minQuantity,
        item.unitPrice,
        item.priority,
        item.status,
      ]
        .filter((value) => value !== undefined)
        .join(" "),
    singular: "Price Rule",
    title: selectedPriceList
      ? `${selectedPriceList.name} Price Rules`
      : "Price Rules",
    updatePath: (item) => apiRoutes.pricing.priceRule(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage && selectedPriceList !== undefined}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function scopeLabel(
  item: DiscountLimitDto,
  tiers: readonly CustomerTierDto[],
  categories: readonly ProductCategoryDto[],
  products: readonly ProductDto[],
): string {
  if (item.productId) {
    return (
      products.find((product) => product.id === item.productId)?.name ??
      "Product"
    );
  }
  if (item.categoryId) {
    return (
      categories.find((category) => category.id === item.categoryId)?.name ??
      "Category"
    );
  }
  if (item.tierId) {
    return (
      tiers.find((tier) => tier.id === item.tierId)?.name ?? "Customer Tier"
    );
  }
  return "Organization Default";
}

function DiscountPolicySettings({
  canManage,
  categories,
  items,
  products,
  search,
  tiers,
  timeZone,
}: {
  canManage: boolean;
  categories: readonly ProductCategoryDto[];
  items: readonly DiscountLimitDto[];
  products: readonly ProductDto[];
  search: string;
  tiers: readonly CustomerTierDto[];
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<DiscountLimitDto> = {
    columns: [
      {
        cell: (item) => (
          <span className="font-semibold text-foreground-strong">
            {item.name}
          </span>
        ),
        label: "Policy",
      },
      {
        cell: (item) => scopeLabel(item, tiers, categories, products),
        label: "Scope",
      },
      {
        cell: (item) => formatPercentage(item.maxDiscountPercent, locale),
        label: "Maximum Discount",
        numeric: true,
      },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.pricing.discountLimits,
    description:
      "Set explainable discount ceilings by customer tier, category, product, and precedence.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Name", name: "name", required: true, type: "text" },
            {
              description:
                "Optional. More specific scopes take precedence through the configured priority.",
              label: "Customer Tier",
              name: "tierId",
              options: referenceOptions(tiers, "All Tiers"),
              type: "select",
            },
            {
              label: "Product Category",
              name: "categoryId",
              options: referenceOptions(categories, "All Categories"),
              type: "select",
            },
            {
              label: "Product",
              name: "productId",
              options: referenceOptions(products, "All Products"),
              type: "select",
            },
            {
              label: "Effective From",
              name: "effectiveFrom",
              required: true,
              type: "datetime",
            },
          ] satisfies FieldDescriptor[])
        : []),
      {
        description: "Enter a percentage from 0 through 100.",
        inputMode: "decimal",
        label: "Maximum Discount",
        name: "maxDiscountPct",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      {
        description: "Leave blank for an open-ended policy.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      categoryId: item?.categoryId ?? "",
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      maxDiscountPct: item?.maxDiscountPercent ?? "0",
      name: item?.name ?? "",
      priority: String(item?.priority ?? 0),
      productId: item?.productId ?? "",
      status: item?.status ?? "ACTIVE",
      tierId: item?.tierId ?? "",
    }),
    itemLabel: (item) => item.name,
    key: "discount-policies",
    pagePath: "/settings/discount-policies",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateDiscountLimitRequestSchema
          : CreateDiscountLimitRequestSchema,
        () =>
          item
            ? {
                effectiveTo:
                  optionalIsoDateTime(formData, "effectiveTo") ?? null,
                maxDiscountPct: textValue(formData, "maxDiscountPct"),
                priority: numberValue(formData, "priority"),
                status: textValue(formData, "status"),
              }
            : {
                categoryId: optionalText(formData, "categoryId"),
                effectiveFrom: toIsoDateTime(
                  textValue(formData, "effectiveFrom"),
                ),
                effectiveTo: optionalIsoDateTime(formData, "effectiveTo"),
                maxDiscountPct: textValue(formData, "maxDiscountPct"),
                name: textValue(formData, "name"),
                priority: numberValue(formData, "priority"),
                productId: optionalText(formData, "productId"),
                tierId: optionalText(formData, "tierId"),
              },
      ),
    responseSchema: DiscountLimitDtoSchema,
    searchText: (item) =>
      [
        item.name,
        scopeLabel(item, tiers, categories, products),
        item.status,
      ].join(" "),
    singular: "Discount Policy",
    title: "Discount Policies",
    updatePath: (item) => apiRoutes.pricing.discountLimit(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

const defaultApprovalSteps = [
  {
    assigneeStrategy: "ROLE",
    dueAfterHours: 24,
    requiredCapability: "approval.managerAct",
    requiredRole: "SALES_MANAGER",
    sequence: 1,
  },
] as const;

function ApprovalChainSettings({
  canManage,
  items,
  search,
  timeZone,
}: {
  canManage: boolean;
  items: readonly ApprovalPolicyDto[];
  search: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<ApprovalPolicyDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Approval Chain",
      },
      { cell: (item) => `Version ${item.version}`, label: "Version" },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      { cell: (item) => item.steps.length, label: "Steps", numeric: true },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: planApiRoutes.configuration.approvalPolicies,
    description:
      "Version approval predicates and ordered manager or finance decision steps without changing quote code.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Code", name: "code", required: true, type: "text" },
            {
              label: "Effective From",
              name: "effectiveFrom",
              required: true,
              type: "datetime",
            },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        description:
          "JSON object of server-evaluated facts, such as risk level or margin thresholds.",
        label: "Predicates",
        name: "predicates",
        placeholder: 'Example: {"segment":"enterprise"}…',
        required: true,
        rows: 7,
        type: "textarea",
      },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      {
        description:
          "Ordered JSON array. Pair SALES_MANAGER with approval.managerAct or FINANCE with approval.financeAct.",
        label: "Approval Steps",
        name: "steps",
        required: true,
        rows: 12,
        type: "textarea",
      },
      {
        description: "Leave blank for an open-ended policy.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      statusField(),
    ],
    initialValues: (item) => ({
      code: item?.code ?? "",
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      name: item?.name ?? "",
      predicates: jsonText(item?.predicates ?? {}),
      priority: String(item?.priority ?? 0),
      status: item?.status ?? "DRAFT",
      steps: jsonText(item?.steps ?? defaultApprovalSteps),
    }),
    itemLabel: (item) => item.name,
    key: "approval-chains",
    pagePath: "/settings/approval-chains",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateApprovalPolicyRequestSchema
          : CreateApprovalPolicyRequestSchema,
        () => ({
          ...(item
            ? { revision: item.version }
            : { code: textValue(formData, "code") }),
          ...(item
            ? {}
            : {
                effectiveFrom: toIsoDateTime(
                  textValue(formData, "effectiveFrom"),
                ),
              }),
          effectiveTo: item
            ? (optionalIsoDateTime(formData, "effectiveTo") ?? null)
            : optionalIsoDateTime(formData, "effectiveTo"),
          name: textValue(formData, "name"),
          predicates: jsonObjectValue(formData, "predicates"),
          priority: numberValue(formData, "priority"),
          status: textValue(formData, "status"),
          steps: jsonArrayValue(formData, "steps"),
        }),
      ),
    responseSchema: ApprovalPolicyDtoSchema,
    searchText: (item) =>
      [
        item.code,
        item.name,
        item.status,
        ...item.steps.map((step) => step.requiredRole),
      ].join(" "),
    singular: "Approval Chain",
    title: "Approval Chains",
    updatePath: (item) => planApiRoutes.configuration.approvalPolicy(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function WarehouseSettings({
  canManage,
  items,
  search,
}: {
  canManage: boolean;
  items: readonly WarehouseDto[];
  search: string;
}) {
  const definition: ResourceDefinition<WarehouseDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Warehouse",
      },
      { cell: (item) => `${item.leadTimeDays} days`, label: "Lead Time" },
      {
        cell: (item) => item.shippingCostWeight,
        label: "Shipping Weight",
        numeric: true,
      },
      { cell: (item) => `Revision ${item.revision}`, label: "Revision" },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.inventory.warehouses,
    description:
      "Maintain fulfillment locations, lead-time assumptions, shipping weights, and optimistic revisions.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Code", name: "code", type: "text" },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        description:
          "Enter a plain address or a JSON object for structured address fields.",
        label: "Address",
        name: "address",
        required: true,
        rows: 6,
        type: "textarea",
      },
      {
        inputMode: "numeric",
        label: "Lead Time in Days",
        name: "leadTimeDays",
        required: true,
        step: "1",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Shipping Cost Weight",
        name: "shippingCostWeight",
        required: true,
        step: "0.0001",
        type: "number",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      address: item ? jsonText(item.address) : "",
      code: item?.code ?? "",
      leadTimeDays: String(item?.leadTimeDays ?? 1),
      name: item?.name ?? "",
      shippingCostWeight: item?.shippingCostWeight ?? "1",
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "warehouses",
    pagePath: "/settings/warehouses",
    parse: (formData, item) =>
      safelyParse(
        item ? UpdateWarehouseRequestSchema : CreateWarehouseRequestSchema,
        () => ({
          address: addressValue(formData),
          leadTimeDays: numberValue(formData, "leadTimeDays"),
          name: textValue(formData, "name"),
          shippingCostWeight: textValue(formData, "shippingCostWeight"),
          ...(item
            ? { revision: item.revision, status: textValue(formData, "status") }
            : { code: optionalText(formData, "code") }),
        }),
      ),
    responseSchema: WarehouseDtoSchema,
    searchText: (item) => [item.code, item.name, item.status].join(" "),
    singular: "Warehouse",
    title: "Warehouses",
    updatePath: (item) => apiRoutes.inventory.warehouse(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function SubscriptionPlanSettings({
  canManage,
  items,
  search,
}: {
  canManage: boolean;
  items: readonly SubscriptionPlanDto[];
  search: string;
}) {
  const definition: ResourceDefinition<SubscriptionPlanDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Subscription Plan",
      },
      {
        cell: (item) =>
          `${item.intervalCount} ${formatEnumLabel(item.interval)}`,
        label: "Interval",
      },
      {
        cell: (item) => formatEnumLabel(item.prorationConvention),
        label: "Proration",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.pricing.subscriptionPlans,
    description:
      "Define recurring billing cadence, proration behavior, cancellation rules, and refund rules.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Code", name: "code", required: true, type: "text" },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        label: "Billing Interval",
        name: "interval",
        options: optionList(BILLING_INTERVALS),
        required: true,
        type: "select",
      },
      {
        inputMode: "numeric",
        label: "Interval Count",
        name: "intervalCount",
        required: true,
        step: "1",
        type: "number",
      },
      {
        label: "Proration Convention",
        name: "prorationConvention",
        options: optionList(PRORATION_CONVENTIONS),
        required: true,
        type: "select",
      },
      {
        description:
          "JSON object consumed by the subscription cancellation preview.",
        label: "Cancellation Rules",
        name: "cancellationRules",
        required: true,
        rows: 6,
        type: "textarea",
      },
      {
        description:
          "JSON object used by server-authoritative refund calculation.",
        label: "Refund Rules",
        name: "refundRules",
        required: true,
        rows: 6,
        type: "textarea",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      cancellationRules: jsonText(item?.cancellationRules ?? {}),
      code: item?.code ?? "",
      interval: item?.interval ?? "MONTH",
      intervalCount: String(item?.intervalCount ?? 1),
      name: item?.name ?? "",
      prorationConvention: item?.prorationConvention ?? "CALENDAR_DAYS",
      refundRules: jsonText(item?.refundRules ?? {}),
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "subscription-plans",
    pagePath: "/settings/subscription-plans",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateSubscriptionPlanRequestSchema
          : CreateSubscriptionPlanRequestSchema,
        () => ({
          cancellationRules: jsonObjectValue(formData, "cancellationRules"),
          interval: textValue(formData, "interval"),
          intervalCount: numberValue(formData, "intervalCount"),
          name: textValue(formData, "name"),
          prorationConvention: textValue(formData, "prorationConvention"),
          refundRules: jsonObjectValue(formData, "refundRules"),
          ...(item
            ? { status: textValue(formData, "status") }
            : { code: textValue(formData, "code") }),
        }),
      ),
    responseSchema: SubscriptionPlanDtoSchema,
    searchText: (item) =>
      [
        item.code,
        item.name,
        item.interval,
        item.prorationConvention,
        item.status,
      ].join(" "),
    singular: "Subscription Plan",
    title: "Subscription Plans",
    updatePath: (item) => apiRoutes.pricing.subscriptionPlan(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function RecommendationSettings({
  canManage,
  items,
  products,
  search,
  timeZone,
}: {
  canManage: boolean;
  items: readonly RecommendationRuleDto[];
  products: readonly ProductDto[];
  search: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<RecommendationRuleDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Rule",
      },
      {
        cell: (item) =>
          item.productId
            ? (products.find((product) => product.id === item.productId)
                ?.name ?? "Product")
            : "All Products",
        label: "Product",
      },
      { cell: (item) => `Version ${item.version}`, label: "Version" },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: planApiRoutes.configuration.recommendationRules,
    description:
      "Tune explainable product-ranking weights, applicability conditions, margin floors, and effective versions.",
    fields: (item) => [
      ...(!item
        ? ([
            { label: "Code", name: "code", required: true, type: "text" },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        label: "Product Scope",
        name: "productId",
        options: referenceOptions(products, "All Products"),
        type: "select",
      },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Affinity Weight",
        name: "affinityWeight",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Margin Weight",
        name: "marginWeight",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Promotion Weight",
        name: "promotionWeight",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Availability Weight",
        name: "availabilityWeight",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        description:
          "Increases the score for eligible stock that has remained on hand longer.",
        inputMode: "decimal",
        label: "Stock Age Weight",
        name: "stockAgeWeight",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        description:
          "Lowest acceptable expected margin for recommendations from this rule.",
        inputMode: "decimal",
        label: "Minimum Margin",
        name: "minimumMargin",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        description:
          "JSON object of explainable facts evaluated by the ranking service.",
        label: "Conditions",
        name: "conditions",
        required: true,
        rows: 7,
        type: "textarea",
      },
      {
        label: "Effective From",
        name: "effectiveFrom",
        required: true,
        type: "datetime",
      },
      {
        description: "Leave blank for an open-ended rule.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      statusField(),
    ],
    initialValues: (item) => ({
      affinityWeight: item?.affinityWeight ?? "0.35",
      availabilityWeight: item?.availabilityWeight ?? "0.15",
      code: item?.code ?? "",
      conditions: jsonText(item?.conditions ?? {}),
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      marginWeight: item?.marginWeight ?? "0.2",
      minimumMargin: item?.minimumMargin ?? "0",
      name: item?.name ?? "",
      priority: String(item?.priority ?? 0),
      productId: item?.productId ?? "",
      promotionWeight: item?.promotionWeight ?? "0.15",
      stockAgeWeight: item?.stockAgeWeight ?? "0.15",
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "recommendations",
    pagePath: "/settings/recommendations",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateRecommendationRuleRequestSchema
          : CreateRecommendationRuleRequestSchema,
        () => ({
          affinityWeight: textValue(formData, "affinityWeight"),
          availabilityWeight: textValue(formData, "availabilityWeight"),
          conditions: jsonObjectValue(formData, "conditions"),
          effectiveFrom: toIsoDateTime(textValue(formData, "effectiveFrom")),
          effectiveTo: item
            ? (optionalIsoDateTime(formData, "effectiveTo") ?? null)
            : optionalIsoDateTime(formData, "effectiveTo"),
          marginWeight: textValue(formData, "marginWeight"),
          minimumMargin: textValue(formData, "minimumMargin"),
          name: textValue(formData, "name"),
          priority: numberValue(formData, "priority"),
          productId: item
            ? (optionalText(formData, "productId") ?? null)
            : optionalText(formData, "productId"),
          promotionWeight: textValue(formData, "promotionWeight"),
          stockAgeWeight: textValue(formData, "stockAgeWeight"),
          status: textValue(formData, "status"),
          ...(item
            ? { version: item.version }
            : { code: textValue(formData, "code") }),
        }),
      ),
    responseSchema: RecommendationRuleDtoSchema,
    searchText: (item) => {
      const productName = products.find(
        (product) => product.id === item.productId,
      )?.name;
      return [item.code, item.name, productName, item.status]
        .filter(Boolean)
        .join(" ");
    },
    singular: "Recommendation Rule",
    title: "Recommendations",
    updatePath: (item) =>
      planApiRoutes.configuration.recommendationRule(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function CustomerAccountSettings({
  baseCurrency,
  canManage,
  items,
  search,
  tiers,
}: {
  baseCurrency: string;
  canManage: boolean;
  items: readonly CustomerAccountDto[];
  search: string;
  tiers: readonly CustomerTierDto[];
}) {
  const { locale } = useOrganizationFormatting();
  const definition: ResourceDefinition<CustomerAccountDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.accountCode}
            </span>
          </div>
        ),
        label: "Account",
      },
      { cell: (item) => item.tier.name, label: "Tier" },
      {
        cell: (item) => item.assignedRep?.name ?? "Unassigned",
        label: "Representative",
      },
      {
        cell: (item) =>
          formatMoney(item.creditLimit, item.preferredCurrency, locale),
        label: "Credit Limit",
        numeric: true,
      },
      {
        cell: (item) =>
          formatMoney(item.currentExposure, item.preferredCurrency, locale),
        label: "Exposure",
        numeric: true,
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.customers.accounts,
    customerView: "accounts",
    description:
      "Manage customer identity, commercial tier, terms, credit limit, and lifecycle state.",
    fields: (item) => [
      { label: "Account Name", name: "name", required: true, type: "text" },
      {
        label: "Customer Tier",
        name: "tierId",
        options: referenceOptions(tiers),
        required: true,
        type: "select",
      },
      {
        description: `Defaults to the organization base currency (${baseCurrency}).`,
        label: "Preferred Currency",
        name: "preferredCurrency",
        placeholder: "Example: USD…",
        required: true,
        type: "text",
      },
      {
        inputMode: "numeric",
        label: "Payment Terms (Days)",
        max: "365",
        min: "0",
        name: "paymentTermsDays",
        required: true,
        step: "1",
        type: "number",
      },
      {
        inputMode: "decimal",
        label: "Credit Limit",
        min: "0",
        name: "creditLimit",
        required: true,
        step: "0.0001",
        type: "number",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      creditLimit: item?.creditLimit ?? "0",
      name: item?.name ?? "",
      paymentTermsDays: String(item?.paymentTermsDays ?? 30),
      preferredCurrency: item?.preferredCurrency ?? baseCurrency,
      status: item?.status ?? "ACTIVE",
      tierId: item?.tier.id ?? tiers[0]?.id ?? "",
    }),
    itemLabel: (item) => item.name,
    key: "customers",
    pagePath: "/settings/customers",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateCustomerAccountRequestSchema
          : CreateCustomerAccountRequestSchema,
        () => ({
          creditLimit: textValue(formData, "creditLimit"),
          name: textValue(formData, "name"),
          paymentTermsDays: numberValue(formData, "paymentTermsDays"),
          preferredCurrency: textValue(
            formData,
            "preferredCurrency",
          ).toUpperCase(),
          tierId: textValue(formData, "tierId"),
          ...(item
            ? {
                revision: item.revision,
                status: textValue(formData, "status"),
              }
            : {}),
        }),
      ),
    responseSchema: CustomerAccountDtoSchema,
    searchText: (item) =>
      [
        item.accountCode,
        item.name,
        item.tier.name,
        item.salesTeam?.name,
        item.assignedRep?.name,
        item.status,
      ]
        .filter(Boolean)
        .join(" "),
    singular: "Customer Account",
    title: "Customer Accounts",
    updatePath: (item) => apiRoutes.customers.account(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function CustomerTierSettings({
  canManage,
  items,
  search,
}: {
  canManage: boolean;
  items: readonly CustomerTierDto[];
  search: string;
}) {
  const definition: ResourceDefinition<CustomerTierDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Tier",
      },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: apiRoutes.customers.tiers,
    customerView: "tiers",
    description:
      "Maintain the customer tiers used by pricing, discount policy, and commercial risk evaluation.",
    fields: (item) => [
      ...(!item
        ? ([
            {
              label: "Code",
              name: "code",
              required: true,
              type: "text",
            },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      code: item?.code ?? "",
      name: item?.name ?? "",
      priority: String(item?.priority ?? 0),
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "customers",
    pagePath: "/settings/customers",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateCustomerTierRequestSchema
          : CreateCustomerTierRequestSchema,
        () => ({
          name: textValue(formData, "name"),
          priority: numberValue(formData, "priority"),
          ...(item
            ? { status: textValue(formData, "status") }
            : { code: textValue(formData, "code") }),
        }),
      ),
    responseSchema: CustomerTierDtoSchema,
    searchText: (item) =>
      [item.code, item.name, item.priority, item.status].join(" "),
    singular: "Customer Tier",
    title: "Customer Tiers",
    updatePath: (item) => apiRoutes.customers.tier(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function CustomerContactSettings({
  accounts,
  canManage,
  items,
  search,
  selectedCustomerId,
}: {
  accounts: readonly CustomerAccountDto[];
  canManage: boolean;
  items: readonly CustomerContactDto[];
  search: string;
  selectedCustomerId?: string;
}) {
  const selectedAccount = accounts.find(
    (account) => account.id === selectedCustomerId,
  );
  const booleanOptions = [
    { label: "No", value: "false" },
    { label: "Yes", value: "true" },
  ];
  const definition: ResourceDefinition<CustomerContactDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.firstName} {item.lastName}
            </span>
            <span className="block break-all text-caption text-foreground-muted">
              {item.email}
            </span>
          </div>
        ),
        label: "Contact",
      },
      { cell: (item) => (item.isPrimary ? "Yes" : "No"), label: "Primary" },
      {
        cell: (item) => (item.portalEnabled ? "Enabled" : "Disabled"),
        label: "Portal",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    contextControls: (
      <form
        action="/settings/customers"
        className="flex flex-wrap items-end gap-xs"
      >
        <input name="view" type="hidden" value="contacts" />
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="contact-customer">Customer Account</FieldLabel>
          <Select
            defaultValue={selectedCustomerId ?? ""}
            id="contact-customer"
            name="customerId"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.accountCode})
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          View Contacts
        </Button>
      </form>
    ),
    createPath: selectedCustomerId
      ? apiRoutes.customers.contacts(selectedCustomerId)
      : apiRoutes.customers.accounts,
    customerView: "contacts",
    description: selectedAccount
      ? `Manage buyer contacts and portal access for ${selectedAccount.name}.`
      : "Create a customer account before adding buyer contacts.",
    fields: (item) => [
      { label: "First Name", name: "firstName", required: true, type: "text" },
      { label: "Last Name", name: "lastName", required: true, type: "text" },
      { label: "Email", name: "email", required: true, type: "email" },
      {
        label: "Primary Contact",
        name: "isPrimary",
        options: booleanOptions,
        required: true,
        type: "select",
      },
      {
        label: "Portal Access",
        name: "portalEnabled",
        options: booleanOptions,
        required: true,
        type: "select",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      email: item?.email ?? "",
      firstName: item?.firstName ?? "",
      isPrimary: String(item?.isPrimary ?? false),
      lastName: item?.lastName ?? "",
      portalEnabled: String(item?.portalEnabled ?? false),
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => `${item.firstName} ${item.lastName}`,
    key: "customers",
    pagePath: "/settings/customers",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateCustomerContactRequestSchema
          : CreateCustomerContactRequestSchema,
        () => ({
          email: textValue(formData, "email").toLowerCase(),
          firstName: textValue(formData, "firstName"),
          isPrimary: textValue(formData, "isPrimary") === "true",
          lastName: textValue(formData, "lastName"),
          portalEnabled: textValue(formData, "portalEnabled") === "true",
          ...(item ? { status: textValue(formData, "status") } : {}),
        }),
      ),
    queryParams: selectedCustomerId
      ? { customerId: selectedCustomerId }
      : undefined,
    responseSchema: CustomerContactDtoSchema,
    searchText: (item) =>
      [item.firstName, item.lastName, item.email, item.status].join(" "),
    singular: "Customer Contact",
    title: selectedAccount
      ? `${selectedAccount.name} Contacts`
      : "Customer Contacts",
    updatePath: (item) =>
      apiRoutes.customers.contact(item.customerAccountId, item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage && selectedAccount !== undefined}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function ProductVariantSettings({
  baseCurrency,
  canManage,
  items,
  products,
  search,
  selectedProductId,
}: {
  baseCurrency: string;
  canManage: boolean;
  items: readonly ProductVariantDto[];
  products: readonly ProductDto[];
  search: string;
  selectedProductId?: string;
}) {
  const { locale } = useOrganizationFormatting();
  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );
  const definition: ResourceDefinition<ProductVariantDto> = {
    catalogView: "variants",
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name ?? "Unnamed Variant"}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.sku}
            </span>
          </div>
        ),
        label: "Variant",
      },
      {
        cell: (item) => formatMoney(item.priceSurcharge, baseCurrency, locale),
        label: "Price Surcharge",
        numeric: true,
      },
      {
        cell: (item) => Object.keys(item.attributes).length,
        label: "Attributes",
        numeric: true,
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    contextControls: (
      <form
        action="/settings/products"
        className="flex flex-wrap items-end gap-xs"
      >
        <input name="view" type="hidden" value="variants" />
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="variant-product">Product</FieldLabel>
          <Select
            defaultValue={selectedProductId ?? ""}
            id="variant-product"
            name="productId"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.code})
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          View Variants
        </Button>
      </form>
    ),
    createPath: selectedProductId
      ? planApiRoutes.catalog.productVariants(selectedProductId)
      : apiRoutes.catalog.products,
    description: selectedProduct
      ? `Manage SKU variants, attributes, and price surcharges for ${selectedProduct.name}.`
      : "Create a product before adding SKU variants.",
    fields: (item) => [
      { label: "SKU", name: "sku", required: true, type: "text" },
      { label: "Variant Name", name: "name", type: "text" },
      {
        description: "Use a JSON object for governed option names and values.",
        label: "Attributes",
        name: "attributes",
        placeholder: 'Example: {"color":"navy"}…',
        required: true,
        rows: 5,
        type: "textarea",
      },
      {
        inputMode: "decimal",
        label: "Price Surcharge",
        min: "0",
        name: "priceSurcharge",
        required: true,
        step: "0.0001",
        type: "number",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      attributes: jsonText(item?.attributes ?? {}),
      name: item?.name ?? "",
      priceSurcharge: item?.priceSurcharge ?? "0",
      sku: item?.sku ?? "",
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name ?? item.sku,
    key: "products",
    pagePath: "/settings/products",
    parse: (formData, item) =>
      safelyParse(
        item
          ? UpdateProductVariantRequestSchema
          : CreateProductVariantRequestSchema,
        () => ({
          attributes: jsonObjectValue(formData, "attributes"),
          name: item
            ? (optionalText(formData, "name") ?? null)
            : optionalText(formData, "name"),
          priceSurcharge: textValue(formData, "priceSurcharge"),
          sku: textValue(formData, "sku"),
          ...(item
            ? { revision: item.revision, status: textValue(formData, "status") }
            : {}),
        }),
      ),
    queryParams: selectedProductId
      ? { productId: selectedProductId }
      : undefined,
    responseSchema: ProductVariantDtoSchema,
    searchText: (item) =>
      [item.sku, item.name, JSON.stringify(item.attributes), item.status]
        .filter(Boolean)
        .join(" "),
    singular: "Product Variant",
    title: selectedProduct
      ? `${selectedProduct.name} Variants`
      : "Product Variants",
    updatePath: (item) =>
      planApiRoutes.catalog.productVariant(item.productId, item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage && selectedProduct !== undefined}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

function PromotionSettings({
  canManage,
  items,
  products,
  search,
  timeZone,
}: {
  canManage: boolean;
  items: readonly PromotionDto[];
  products: readonly ProductDto[];
  search: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const productName = (id: string) =>
    products.find((product) => product.id === id)?.name ?? "Archived Product";
  const definition: ResourceDefinition<PromotionDto> = {
    columns: [
      {
        cell: (item) => (
          <div>
            <span className="block font-semibold text-foreground-strong">
              {item.name}
            </span>
            <span className="block font-mono text-caption text-foreground-muted">
              {item.code}
            </span>
          </div>
        ),
        label: "Promotion",
      },
      { cell: (item) => item.priority, label: "Priority", numeric: true },
      {
        cell: (item) =>
          new Intl.NumberFormat(locale, {
            maximumFractionDigits: 4,
          }).format(Number(item.recommendationBoost)),
        label: "Recommendation Boost",
        numeric: true,
      },
      {
        cell: (item) => item.productIds.length.toLocaleString(locale),
        label: "Products",
        numeric: true,
      },
      {
        cell: (item) => formatDateTime(item.effectiveFrom, locale, timeZone),
        label: "Effective From",
      },
      { cell: (item) => statusBadge(item.status), label: "Status" },
    ],
    createPath: planApiRoutes.configuration.promotions,
    description:
      "Manage effective-dated product promotions, calculation conditions, benefits, and recommendation influence.",
    fields: (item) => [
      ...(!item
        ? ([
            {
              label: "Code",
              name: "code",
              required: true,
              type: "text",
            },
          ] satisfies FieldDescriptor[])
        : []),
      { label: "Name", name: "name", required: true, type: "text" },
      {
        inputMode: "numeric",
        label: "Priority",
        name: "priority",
        required: true,
        step: "1",
        type: "number",
      },
      {
        description: "Select every product governed by this promotion.",
        label: "Products",
        name: "productIds",
        options: products.map((product) => ({
          label: `${product.name} (${product.code})`,
          value: product.id,
        })),
        required: true,
        type: "checkboxes",
      },
      {
        description: "Use a JSON object evaluated by the pricing engine.",
        label: "Conditions",
        name: "conditions",
        placeholder: 'Example: {"minimumQuantity":"5"}…',
        required: true,
        rows: 5,
        type: "textarea",
      },
      {
        description: "Use a JSON object describing the price benefit.",
        label: "Benefit",
        name: "benefit",
        placeholder: 'Example: {"discountPercent":"10"}…',
        required: true,
        rows: 5,
        type: "textarea",
      },
      {
        description: "Enter a recommendation score boost from 0 through 1.",
        inputMode: "decimal",
        label: "Recommendation Boost",
        max: "1",
        min: "0",
        name: "recommendationBoost",
        required: true,
        step: "0.0001",
        type: "number",
      },
      {
        label: "Effective From",
        name: "effectiveFrom",
        required: true,
        type: "datetime",
      },
      {
        description: "Leave blank for an open-ended promotion.",
        label: "Effective To",
        name: "effectiveTo",
        type: "datetime",
      },
      ...(item ? [statusField()] : []),
    ],
    initialValues: (item) => ({
      benefit: jsonText(item?.benefit ?? {}),
      code: item?.code ?? "",
      conditions: jsonText(item?.conditions ?? {}),
      effectiveFrom: dateTimeInputValue(item?.effectiveFrom),
      effectiveTo: dateTimeInputValue(item?.effectiveTo),
      name: item?.name ?? "",
      priority: String(item?.priority ?? 0),
      productIds: JSON.stringify(item?.productIds ?? []),
      recommendationBoost: item?.recommendationBoost ?? "0",
      status: item?.status ?? "ACTIVE",
    }),
    itemLabel: (item) => item.name,
    key: "promotions",
    pagePath: "/settings/promotions",
    parse: (formData, item) =>
      safelyParse(
        item ? UpdatePromotionRequestSchema : CreatePromotionRequestSchema,
        () => ({
          benefit: jsonObjectValue(formData, "benefit"),
          conditions: jsonObjectValue(formData, "conditions"),
          effectiveFrom: toIsoDateTime(textValue(formData, "effectiveFrom")),
          effectiveTo: item
            ? (optionalIsoDateTime(formData, "effectiveTo") ?? null)
            : optionalIsoDateTime(formData, "effectiveTo"),
          name: textValue(formData, "name"),
          priority: numberValue(formData, "priority"),
          productIds: formData
            .getAll("productIds")
            .filter((value): value is string => typeof value === "string"),
          recommendationBoost: textValue(formData, "recommendationBoost"),
          ...(item
            ? { revision: item.revision, status: textValue(formData, "status") }
            : { code: textValue(formData, "code") }),
        }),
      ),
    responseSchema: PromotionDtoSchema,
    searchText: (item) =>
      [
        item.code,
        item.name,
        item.status,
        ...item.productIds.map(productName),
      ].join(" "),
    singular: "Promotion",
    title: "Promotions",
    updatePath: (item) => planApiRoutes.configuration.promotion(item.id),
  };
  return (
    <ResourceWorkspace
      canManage={canManage}
      definition={definition}
      items={items}
      search={search}
    />
  );
}

export type ConfigurationWorkspaceProps =
  | {
      accounts: readonly CustomerAccountDto[];
      baseCurrency: string;
      canManage: boolean;
      contacts: readonly CustomerContactDto[];
      kind: "customers";
      search: string;
      selectedCustomerId?: string;
      tiers: readonly CustomerTierDto[];
      view: CustomerView;
    }
  | {
      baseCurrency: string;
      canManage: boolean;
      categories: readonly ProductCategoryDto[];
      items: readonly ProductDto[];
      kind: "products";
      search: string;
      selectedProductId?: string;
      taxes: readonly TaxDto[];
      timeZone: string;
      variants: readonly ProductVariantDto[];
      view: CatalogView;
    }
  | {
      canManage: boolean;
      categories: readonly ProductCategoryDto[];
      items: readonly PriceListDto[];
      kind: "price-lists";
      products: readonly ProductDto[];
      rules: readonly PriceRuleDto[];
      search: string;
      selectedPriceListId?: string;
      tiers: readonly CustomerTierDto[];
      timeZone: string;
      view: PriceListView;
    }
  | {
      canManage: boolean;
      categories: readonly ProductCategoryDto[];
      items: readonly DiscountLimitDto[];
      kind: "discount-policies";
      products: readonly ProductDto[];
      search: string;
      tiers: readonly CustomerTierDto[];
      timeZone: string;
    }
  | {
      canManage: boolean;
      items: readonly ApprovalPolicyDto[];
      kind: "approval-chains";
      search: string;
      timeZone: string;
    }
  | {
      canManage: boolean;
      items: readonly WarehouseDto[];
      kind: "warehouses";
      search: string;
    }
  | {
      canManage: boolean;
      items: readonly SubscriptionPlanDto[];
      kind: "subscription-plans";
      search: string;
    }
  | {
      canManage: boolean;
      items: readonly RecommendationRuleDto[];
      kind: "recommendations";
      products: readonly ProductDto[];
      search: string;
      timeZone: string;
    }
  | {
      canManage: boolean;
      items: readonly PromotionDto[];
      kind: "promotions";
      products: readonly ProductDto[];
      search: string;
      timeZone: string;
    };

export function ConfigurationWorkspace(props: ConfigurationWorkspaceProps) {
  switch (props.kind) {
    case "customers":
      if (props.view === "tiers") {
        return (
          <CustomerTierSettings
            canManage={props.canManage}
            items={props.tiers}
            search={props.search}
          />
        );
      }
      if (props.view === "contacts") {
        return (
          <CustomerContactSettings
            accounts={props.accounts}
            canManage={props.canManage}
            items={props.contacts}
            search={props.search}
            selectedCustomerId={props.selectedCustomerId}
          />
        );
      }
      return (
        <CustomerAccountSettings
          baseCurrency={props.baseCurrency}
          canManage={props.canManage}
          items={props.accounts}
          search={props.search}
          tiers={props.tiers}
        />
      );
    case "products":
      if (props.view === "categories") {
        return (
          <ProductCategorySettings
            canManage={props.canManage}
            items={props.categories}
            search={props.search}
          />
        );
      }
      if (props.view === "taxes") {
        return (
          <TaxSettings
            canManage={props.canManage}
            items={props.taxes}
            search={props.search}
            timeZone={props.timeZone}
          />
        );
      }
      if (props.view === "variants") {
        return (
          <ProductVariantSettings
            baseCurrency={props.baseCurrency}
            canManage={props.canManage}
            items={props.variants}
            products={props.items}
            search={props.search}
            selectedProductId={props.selectedProductId}
          />
        );
      }
      return <ProductSettings {...props} />;
    case "price-lists":
      if (props.view === "rules") {
        return (
          <PriceRuleSettings
            canManage={props.canManage}
            categories={props.categories}
            items={props.rules}
            priceLists={props.items}
            products={props.products}
            search={props.search}
            selectedPriceListId={props.selectedPriceListId}
            tiers={props.tiers}
            timeZone={props.timeZone}
          />
        );
      }
      return <PriceListSettings {...props} />;
    case "discount-policies":
      return <DiscountPolicySettings {...props} />;
    case "approval-chains":
      return <ApprovalChainSettings {...props} />;
    case "warehouses":
      return <WarehouseSettings {...props} />;
    case "subscription-plans":
      return <SubscriptionPlanSettings {...props} />;
    case "recommendations":
      return <RecommendationSettings {...props} />;
    case "promotions":
      return <PromotionSettings {...props} />;
  }
}
