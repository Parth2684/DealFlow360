"use client";

import {
  BackorderDtoSchema,
  FulfillmentPlanDtoSchema,
  InventoryBalanceDtoSchema,
  OrderDtoSchema,
  OverrideFulfillmentRequestSchema,
  PositiveDecimalStringSchema,
  ReservationResultDtoSchema,
  ReserveFulfillmentRequestSchema,
  ShipmentDtoSchema,
  ShipShipmentRequestSchema,
  WarehouseDtoSchema,
  addDecimalStrings,
  apiRoutes,
  compareDecimalStrings,
  createCursorPageSchema,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  normalizeDecimalString,
  subtractDecimalStrings,
  type BackorderDto,
  type Capability,
  type FulfillmentAllocationDto,
  type FulfillmentPlanDto,
  type InventoryBalanceDto,
  type OrderDto,
  type PromiseDateConfidenceDto,
  type ReservationResultDto,
  type ShipmentDto,
  type WarehouseDto,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  Metric,
  MetricGroup,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
  Skeleton,
  Textarea,
} from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";
import { useIdempotencyKey } from "../shared/use-idempotency-key";

const WarehousePageSchema = createCursorPageSchema(WarehouseDtoSchema);
const InventoryPageSchema = createCursorPageSchema(InventoryBalanceDtoSchema);
const BackorderPageSchema = createCursorPageSchema(BackorderDtoSchema);
const ShipmentListSchema = z.array(ShipmentDtoSchema);

const orderKey = (orderId: string) => ["order", orderId] as const;
const previewKey = (orderId: string) => ["allocation", orderId] as const;
const shipmentsKey = (orderId: string) => ["shipments", orderId] as const;
const backordersKey = (orderId: string) => ["backorders", orderId] as const;
const inventoryKey = (orderId: string) =>
  ["allocation-inventory", orderId] as const;

async function loadWarehouses(signal: AbortSignal): Promise<WarehouseDto[]> {
  const warehouses: WarehouseDto[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${apiRoutes.catalog.warehouses}?${query.toString()}`,
      { schema: WarehousePageSchema, signal },
    );
    warehouses.push(...page.items);
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return warehouses.filter((warehouse) => warehouse.status === "ACTIVE");
}

async function loadBalances(
  warehouseId: string,
  signal: AbortSignal,
): Promise<InventoryBalanceDto[]> {
  const balances: InventoryBalanceDto[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${apiRoutes.inventory.balances(warehouseId)}?${query.toString()}`,
      { schema: InventoryPageSchema, signal },
    );
    balances.push(...page.items);
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return balances;
}

async function loadBackorders(
  orderId: string,
  orderNumber: string,
  signal: AbortSignal,
): Promise<BackorderDto[]> {
  const backorders: BackorderDto[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100", search: orderNumber });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${apiRoutes.fulfillment.backorders}?${query.toString()}`,
      { schema: BackorderPageSchema, signal },
    );
    backorders.push(...page.items.filter((item) => item.orderId === orderId));
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return backorders;
}

function problemMessage(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError
    ? (error.problem.detail ?? fallback)
    : fallback;
}

function isStockConflict(error: unknown): boolean {
  return (
    error instanceof ApiProblemError &&
    [
      "ALLOCATION_EXCEEDS_AVAILABILITY",
      "FULFILLMENT_PREVIEW_STALE",
      "INVENTORY_CONFLICT",
      "STALE_REVISION",
    ].includes(error.problem.code ?? "")
  );
}

function quantityLabel(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
    Number(normalizeDecimalString(value)),
  );
}

function statusTone(
  value: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (["FULFILLED", "SHIPPED", "ACCEPTED"].includes(value)) return "success";
  if (["CANCELLED", "FAILED"].includes(value)) return "danger";
  if (["OPEN", "PARTIALLY_ALLOCATED", "PARTIALLY_FULFILLED"].includes(value)) {
    return "warning";
  }
  if (["READY", "RESERVED"].includes(value)) return "info";
  return "neutral";
}

function promiseConfidenceTone(
  level: PromiseDateConfidenceDto["level"],
): "success" | "info" | "warning" | "danger" {
  if (level === "HIGH") return "success";
  if (level === "MEDIUM") return "info";
  if (level === "LOW") return "warning";
  return "danger";
}

function allocationsByWarehouse(
  allocations: readonly FulfillmentAllocationDto[],
): Array<{
  id: string;
  name: string;
  allocations: FulfillmentAllocationDto[];
}> {
  const grouped = new Map<string, FulfillmentAllocationDto[]>();
  for (const allocation of allocations) {
    const current = grouped.get(allocation.warehouseId) ?? [];
    current.push(allocation);
    grouped.set(allocation.warehouseId, current);
  }
  return [...grouped].map(([id, values]) => ({
    id,
    name: values[0]?.warehouseName ?? "Warehouse",
    allocations: values,
  }));
}

function AllocationGroup({
  group,
  lines,
  timeZone,
}: {
  group: ReturnType<typeof allocationsByWarehouse>[number];
  lines: ReadonlyMap<string, OrderDto["lines"][number]>;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  return (
    <section className="grid gap-xs border-b border-border pb-md last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-xs">
        <h3 className="m-0 text-title font-semibold text-foreground-strong">
          {group.name}
        </h3>
        <Badge tone="info">
          {group.allocations.length} line
          {group.allocations.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid gap-xs md:hidden">
        {group.allocations.map((allocation) => {
          const line = lines.get(allocation.orderLineId);
          return (
            <article
              className="grid gap-xs rounded-control border border-border bg-surface-subtle p-sm"
              key={`${allocation.orderLineId}:${allocation.warehouseId}`}
            >
              <strong className="break-words text-body-sm text-foreground-strong">
                {line?.productName ?? allocation.orderLineId}
              </strong>
              <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
                <div>
                  <dt className="text-foreground-muted">Assigned</dt>
                  <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                    {quantityLabel(allocation.quantity, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Available</dt>
                  <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                    {quantityLabel(allocation.availableAtPreview, locale)}
                  </dd>
                </div>
              </dl>
              <p className="m-0 text-caption text-foreground-muted">
                Promise{" "}
                {allocation.estimatedDate
                  ? formatDateTime(allocation.estimatedDate, locale, timeZone)
                  : "not available"}
              </p>
            </article>
          );
        })}
      </div>

      <DataTable
        aria-label={`${group.name} recommended allocations`}
        containerClassName="hidden md:block"
      >
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead>Order Line</DataTableHead>
            <DataTableHead numeric>Assigned</DataTableHead>
            <DataTableHead numeric>Available</DataTableHead>
            <DataTableHead>Promise</DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {group.allocations.map((allocation) => (
            <DataTableRow
              key={`${allocation.orderLineId}:${allocation.warehouseId}`}
            >
              <DataTableCell>
                {lines.get(allocation.orderLineId)?.productName ??
                  allocation.orderLineId}
              </DataTableCell>
              <DataTableCell numeric>
                {quantityLabel(allocation.quantity, locale)}
              </DataTableCell>
              <DataTableCell numeric>
                {quantityLabel(allocation.availableAtPreview, locale)}
              </DataTableCell>
              <DataTableCell>
                {allocation.estimatedDate
                  ? formatDateTime(allocation.estimatedDate, locale, timeZone)
                  : "Not available"}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </section>
  );
}

function PromiseDateConfidence({
  confidence,
  lines,
  timeZone,
  warehouseNames,
}: {
  confidence: PromiseDateConfidenceDto;
  lines: ReadonlyMap<string, OrderDto["lines"][number]>;
  timeZone: string;
  warehouseNames: ReadonlyMap<string, string>;
}) {
  const { locale } = useOrganizationFormatting();
  const tone = promiseConfidenceTone(confidence.level);

  return (
    <section className="grid gap-sm border-t border-border pt-md">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="grid min-w-0 gap-xxs">
          <h3 className="m-0 text-title font-semibold text-foreground-strong">
            Promise-Date Confidence
          </h3>
          <p className="m-0 text-pretty text-caption text-foreground-muted">
            Server-calculated confidence in when current and incoming stock can
            cover every stock-managed line.
          </p>
        </div>
        <Badge tone={tone}>
          {formatEnumLabel(confidence.level)} Confidence
        </Badge>
      </div>

      <MetricGroup aria-label="Promise-date confidence facts">
        <Metric
          detail={formatEnumLabel(confidence.level)}
          label="Confidence Score"
          tone={tone}
          value={`${confidence.score}/100`}
        />
        <Metric
          label="Promise Estimate"
          tone={tone}
          value={
            confidence.estimatedPromiseAt
              ? formatDateTime(confidence.estimatedPromiseAt, locale, timeZone)
              : "Not available"
          }
        />
        <Metric
          label="Split Shipments"
          tone={confidence.splitShipmentCount > 1 ? "warning" : "neutral"}
          value={confidence.splitShipmentCount}
        />
        <Metric
          label="Projected Unfulfilled"
          tone={
            confidence.projectedUnfulfilledQuantity === "0"
              ? "success"
              : "danger"
          }
          value={quantityLabel(confidence.projectedUnfulfilledQuantity, locale)}
        />
      </MetricGroup>

      {confidence.explanation.length > 0 ? (
        <ul className="m-0 grid gap-xxs pl-lg text-body-sm text-foreground-muted">
          {confidence.explanation.map((explanation) => (
            <li className="text-pretty" key={explanation}>
              {explanation}
            </li>
          ))}
        </ul>
      ) : null}

      {confidence.reasonCodes.length > 0 ? (
        <div
          aria-label="Promise-date confidence signals"
          className="flex flex-wrap gap-xs"
          role="group"
        >
          {confidence.reasonCodes.map((reasonCode) => (
            <Badge key={reasonCode}>{formatEnumLabel(reasonCode)}</Badge>
          ))}
        </div>
      ) : null}

      <details className="rounded-control border border-border bg-surface-subtle px-sm py-xs">
        <summary className="cursor-pointer text-body-sm font-semibold text-foreground-strong">
          Review Inventory Inputs ({confidence.inventoryInputs.length})
        </summary>
        <div className="pt-sm">
          {confidence.inventoryInputs.length > 0 ? (
            <DataTable aria-label="Inventory inputs used for promise-date confidence">
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Order Line</DataTableHead>
                  <DataTableHead>Warehouse</DataTableHead>
                  <DataTableHead numeric>Available</DataTableHead>
                  <DataTableHead numeric>Reserved</DataTableHead>
                  <DataTableHead>Incoming</DataTableHead>
                  <DataTableHead numeric>Lead Time</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {confidence.inventoryInputs.map((input) => (
                  <DataTableRow
                    key={`${input.orderLineId}:${input.warehouseId}`}
                  >
                    <DataTableCell>
                      {lines.get(input.orderLineId)?.productName ??
                        input.orderLineId}
                    </DataTableCell>
                    <DataTableCell>
                      {warehouseNames.get(input.warehouseId) ??
                        input.warehouseId}
                    </DataTableCell>
                    <DataTableCell numeric>
                      {quantityLabel(input.currentAvailable, locale)}
                    </DataTableCell>
                    <DataTableCell numeric>
                      {quantityLabel(input.existingReserved, locale)}
                    </DataTableCell>
                    <DataTableCell>
                      <span className="block font-mono tabular-nums text-foreground-strong">
                        {quantityLabel(input.incomingQuantity, locale)}
                      </span>
                      <span className="block text-caption text-foreground-muted">
                        {input.incomingExpectedAt
                          ? formatDateTime(
                              input.incomingExpectedAt,
                              locale,
                              timeZone,
                            )
                          : compareDecimalStrings(
                                input.incomingQuantity,
                                "0",
                              ) === 0
                            ? "No incoming stock"
                            : "ETA unavailable"}
                      </span>
                    </DataTableCell>
                    <DataTableCell numeric>
                      {input.leadTimeDays} day
                      {input.leadTimeDays === 1 ? "" : "s"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          ) : (
            <p className="m-0 text-body-sm text-foreground-muted">
              No stock-managed inventory inputs contributed to this estimate.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

interface InventoryContext {
  balances: InventoryBalanceDto[];
  warehouses: WarehouseDto[];
}

interface ManualScenario {
  allocations: Array<{
    orderLineId: string;
    quantity: string;
    warehouseId: string;
  }>;
  assignedQuantity: string;
  estimatedPromiseAt: string | null;
  estimatedShippingCost: string;
  error?: string;
  shipmentCount: number;
  unfulfilledQuantity: string;
}

function buildManualScenario(
  order: OrderDto,
  inventory: InventoryContext,
  stockLineIds: ReadonlySet<string>,
  quantities: Readonly<Record<string, string>>,
): ManualScenario {
  const allocations: ManualScenario["allocations"] = [];
  const allocationByLine = new Map<string, string[]>();
  const allocationByBalance = new Map<string, string[]>();

  for (const line of order.lines) {
    if (!stockLineIds.has(line.id)) continue;
    for (const balance of inventory.balances) {
      if (
        balance.productId !== line.productId ||
        balance.variantId !== line.variantId
      ) {
        continue;
      }
      const raw = quantities[`${line.id}:${balance.warehouseId}`]?.trim();
      if (!raw || raw === "0") continue;
      const parsed = PositiveDecimalStringSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          allocations: [],
          assignedQuantity: "0",
          estimatedPromiseAt: null,
          estimatedShippingCost: "0",
          error: "Every assigned quantity must be a positive decimal number.",
          shipmentCount: 0,
          unfulfilledQuantity: "0",
        };
      }
      allocations.push({
        orderLineId: line.id,
        quantity: parsed.data,
        warehouseId: balance.warehouseId,
      });
      allocationByLine.set(line.id, [
        ...(allocationByLine.get(line.id) ?? []),
        parsed.data,
      ]);
      allocationByBalance.set(balance.id, [
        ...(allocationByBalance.get(balance.id) ?? []),
        parsed.data,
      ]);
    }
  }

  for (const line of order.lines.filter((candidate) =>
    stockLineIds.has(candidate.id),
  )) {
    const assigned = addDecimalStrings(
      ...(allocationByLine.get(line.id) ?? []),
    );
    if (compareDecimalStrings(assigned, line.quantity) > 0) {
      return {
        allocations,
        assignedQuantity: "0",
        estimatedPromiseAt: null,
        estimatedShippingCost: "0",
        error: `${line.productName} is assigned above its ordered quantity.`,
        shipmentCount: 0,
        unfulfilledQuantity: "0",
      };
    }
  }
  for (const balance of inventory.balances) {
    const assigned = addDecimalStrings(
      ...(allocationByBalance.get(balance.id) ?? []),
    );
    if (compareDecimalStrings(assigned, balance.available) > 0) {
      return {
        allocations,
        assignedQuantity: "0",
        estimatedPromiseAt: null,
        estimatedShippingCost: "0",
        error: `${balance.warehouseName} is assigned above current availability for ${balance.productName}.`,
        shipmentCount: 0,
        unfulfilledQuantity: "0",
      };
    }
  }

  const warehouses = new Set(
    allocations.map((allocation) => allocation.warehouseId),
  );
  const assignedQuantity = addDecimalStrings(
    ...allocations.map((allocation) => allocation.quantity),
  );
  const unfulfilledQuantity = addDecimalStrings(
    ...order.lines
      .filter((line) => stockLineIds.has(line.id))
      .map((line) => {
        const assigned = addDecimalStrings(
          ...(allocationByLine.get(line.id) ?? []),
        );
        return subtractDecimalStrings(line.quantity, assigned);
      }),
  );
  const usedWarehouses = inventory.warehouses.filter((warehouse) =>
    warehouses.has(warehouse.id),
  );
  const estimatedShippingCost = addDecimalStrings(
    ...usedWarehouses.map((warehouse) => warehouse.shippingCostWeight),
  );
  const estimatedPromiseAt = usedWarehouses.reduce<string | null>(
    (latest, warehouse) => {
      const date = new Date(order.updatedAt);
      date.setUTCDate(date.getUTCDate() + warehouse.leadTimeDays);
      const candidate = date.toISOString();
      return latest === null || candidate > latest ? candidate : latest;
    },
    null,
  );

  return {
    allocations,
    assignedQuantity,
    estimatedPromiseAt,
    estimatedShippingCost,
    shipmentCount: warehouses.size,
    unfulfilledQuantity,
  };
}

function ShipmentCard({
  canShip,
  currency,
  disabled,
  onShip,
  pending,
  shipment,
  timeZone,
  tracking,
  updateTracking,
}: {
  canShip: boolean;
  currency: string;
  disabled: boolean;
  onShip: (shipment: ShipmentDto) => void;
  pending: boolean;
  shipment: ShipmentDto;
  timeZone: string;
  tracking: string;
  updateTracking: (value: string) => void;
}) {
  const { locale } = useOrganizationFormatting();
  return (
    <article className="grid gap-sm border-b border-border pb-md last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-xs">
        <div className="min-w-0">
          <h3 className="m-0 break-words text-title font-semibold text-foreground-strong">
            {shipment.shipmentNumber}
          </h3>
          <p className="m-0 text-body-sm text-foreground-muted">
            {shipment.warehouseName}
          </p>
        </div>
        <Badge tone={statusTone(shipment.status)}>
          {formatEnumLabel(shipment.status)}
        </Badge>
      </div>
      <dl className="m-0 grid gap-xs text-caption sm:grid-cols-3">
        <div>
          <dt className="text-foreground-muted">Promise Date</dt>
          <dd className="m-0 text-foreground-strong">
            {shipment.promisedDate
              ? formatDateTime(shipment.promisedDate, locale, timeZone)
              : "Not scheduled"}
          </dd>
        </div>
        <div>
          <dt className="text-foreground-muted">Items</dt>
          <dd className="m-0 font-mono tabular-nums text-foreground-strong">
            {shipment.items.length}
          </dd>
        </div>
        <div>
          <dt className="text-foreground-muted">Shipping Cost</dt>
          <dd className="m-0 font-mono tabular-nums text-foreground-strong">
            {formatMoney(shipment.estimatedShippingCost, currency, locale)}
          </dd>
        </div>
      </dl>
      {shipment.items.map((item) => (
        <p className="m-0 text-body-sm text-foreground" key={item.orderLineId}>
          {item.productName}: {quantityLabel(item.quantity, locale)}
        </p>
      ))}
      {canShip && shipment.status === "READY" ? (
        <Field>
          <FieldLabel htmlFor={`tracking-${shipment.id}`}>
            Tracking Number
          </FieldLabel>
          <Input
            autoComplete="off"
            disabled={disabled}
            id={`tracking-${shipment.id}`}
            maxLength={120}
            name={`tracking-${shipment.id}`}
            onChange={(event) => updateTracking(event.target.value)}
            spellCheck={false}
            type="text"
            value={tracking}
          />
          <FieldDescription>
            Posting a shipment consumes its active stock reservations.
          </FieldDescription>
          <Button
            disabled={disabled || tracking.trim().length === 0}
            onClick={() => onShip(shipment)}
            size="compact"
          >
            {pending ? "Posting Shipment…" : "Post Shipment"}
          </Button>
        </Field>
      ) : null}
    </article>
  );
}

export function FulfillmentWorkspace({
  capabilities,
  orderId,
  timeZone,
}: {
  capabilities: readonly Capability[];
  orderId: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const queryClient = useQueryClient();
  const granted = useMemo(() => new Set(capabilities), [capabilities]);
  const [manualQuantities, setManualQuantities] = useState<
    Record<string, string>
  >({});
  const [overrideReason, setOverrideReason] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [stockConflict, setStockConflict] = useState(false);
  const [lastReservation, setLastReservation] =
    useState<ReservationResultDto>();
  const [trackingByShipment, setTrackingByShipment] = useState<
    Record<string, string>
  >({});
  const reserveKey = useIdempotencyKey();
  const overrideKey = useIdempotencyKey();
  const shipKey = useIdempotencyKey();
  const consolidateKey = useIdempotencyKey();

  const order = useQuery({
    queryFn: ({ signal }) =>
      browserApiRequest(apiRoutes.orders.detail(orderId), {
        schema: OrderDtoSchema,
        signal,
      }),
    queryKey: orderKey(orderId),
    refetchInterval: 30_000,
  });
  const previewEligible =
    order.data?.status === "CONFIRMED" ||
    order.data?.status === "ALLOCATION_PENDING";
  const preview = useQuery({
    enabled: previewEligible,
    queryFn: ({ signal }) =>
      browserApiRequest(apiRoutes.fulfillment.preview(orderId), {
        schema: FulfillmentPlanDtoSchema,
        signal,
      }),
    queryKey: previewKey(orderId),
    refetchInterval: 30_000,
    retry: false,
  });
  const shipments = useQuery({
    enabled: order.isSuccess,
    queryFn: ({ signal }) =>
      browserApiRequest(apiRoutes.fulfillment.shipments(orderId), {
        schema: ShipmentListSchema,
        signal,
      }),
    queryKey: shipmentsKey(orderId),
    refetchInterval: 30_000,
  });
  const backorders = useQuery({
    enabled: order.isSuccess,
    queryFn: ({ signal }) =>
      loadBackorders(orderId, order.data?.orderNumber ?? orderId, signal),
    queryKey: backordersKey(orderId),
    refetchInterval: 30_000,
  });
  const inventory = useQuery({
    enabled: previewEligible && granted.has("fulfillment.override"),
    queryFn: async ({ signal }): Promise<InventoryContext> => {
      const warehouses = await loadWarehouses(signal);
      const pages = await Promise.all(
        warehouses.map((warehouse) => loadBalances(warehouse.id, signal)),
      );
      const orderProductIds = new Set(
        order.data?.lines.map((line) => line.productId) ?? [],
      );
      return {
        balances: pages
          .flat()
          .filter((balance) => orderProductIds.has(balance.productId)),
        warehouses,
      };
    },
    queryKey: inventoryKey(orderId),
    refetchInterval: 30_000,
  });

  const lineById = useMemo(
    () => new Map(order.data?.lines.map((line) => [line.id, line]) ?? []),
    [order.data],
  );
  const recommendationGroups = useMemo(
    () => allocationsByWarehouse(preview.data?.allocations ?? []),
    [preview.data],
  );
  const currentBackorders = useMemo(
    () => backorders.data ?? [],
    [backorders.data],
  );
  const stockLineIds = useMemo(() => {
    const ids = new Set(
      preview.data?.allocations.map((item) => item.orderLineId) ?? [],
    );
    for (const line of order.data?.lines ?? []) {
      if (line.productType === "HARDWARE") ids.add(line.id);
    }
    return ids;
  }, [order.data, preview.data]);
  const defaultQuantity = useMemo(() => {
    const values: Record<string, string> = {};
    for (const allocation of preview.data?.allocations ?? []) {
      values[`${allocation.orderLineId}:${allocation.warehouseId}`] =
        allocation.quantity;
    }
    return values;
  }, [preview.data]);
  const effectiveQuantities = useMemo(
    () => ({ ...defaultQuantity, ...manualQuantities }),
    [defaultQuantity, manualQuantities],
  );
  const manualScenario = useMemo(
    () =>
      order.data && inventory.data
        ? buildManualScenario(
            order.data,
            inventory.data,
            stockLineIds,
            effectiveQuantities,
          )
        : undefined,
    [effectiveQuantities, inventory.data, order.data, stockLineIds],
  );
  async function refreshAuthoritativeState() {
    setActionError("");
    setStockConflict(false);
    setManualQuantities({});
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) }),
      queryClient.invalidateQueries({ queryKey: previewKey(orderId) }),
      queryClient.invalidateQueries({ queryKey: shipmentsKey(orderId) }),
      queryClient.invalidateQueries({ queryKey: backordersKey(orderId) }),
      queryClient.invalidateQueries({ queryKey: inventoryKey(orderId) }),
    ]);
    setActionMessage("Fulfillment data refreshed from the API.");
  }

  const reserve = useMutation({
    mutationFn: (plan: FulfillmentPlanDto) => {
      const body = ReserveFulfillmentRequestSchema.parse({
        planId: plan.id,
        planRevision: plan.revision,
      });
      return browserApiRequest(apiRoutes.fulfillment.reserve(orderId), {
        headers: reserveKey.headersFor(body),
        json: body,
        method: "POST",
        schema: ReservationResultDtoSchema,
      });
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
      setStockConflict(false);
    },
    onError: (error) => {
      setActionError(
        problemMessage(error, "The recommended plan could not be reserved."),
      );
      setStockConflict(isStockConflict(error));
    },
    onSuccess: async (result) => {
      reserveKey.clear();
      setLastReservation(result);
      setActionError("");
      setActionMessage("Recommended stock allocation reserved.");
      queryClient.setQueryData(orderKey(orderId), result.order);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shipmentsKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: backordersKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: inventoryKey(orderId) }),
      ]);
    },
  });

  const override = useMutation({
    mutationFn: () => {
      const body = OverrideFulfillmentRequestSchema.parse({
        allocations: manualScenario?.allocations ?? [],
        reason: overrideReason,
      });
      return browserApiRequest(apiRoutes.fulfillment.override(orderId), {
        headers: overrideKey.headersFor(body),
        json: body,
        method: "POST",
        schema: ReservationResultDtoSchema,
      });
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
      setStockConflict(false);
    },
    onError: (error) => {
      setActionError(
        problemMessage(error, "The manual allocation could not be reserved."),
      );
      setStockConflict(isStockConflict(error));
    },
    onSuccess: async (result) => {
      overrideKey.clear();
      setLastReservation(result);
      setActionError("");
      setActionMessage("Manual allocation validated and reserved by the API.");
      queryClient.setQueryData(orderKey(orderId), result.order);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shipmentsKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: backordersKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: inventoryKey(orderId) }),
      ]);
    },
  });

  const ship = useMutation({
    mutationFn: (shipment: ShipmentDto) => {
      const body = ShipShipmentRequestSchema.parse({
        trackingNumber: trackingByShipment[shipment.id],
      });
      const command = { shipmentId: shipment.id, ...body };
      return browserApiRequest(apiRoutes.fulfillment.ship(shipment.id), {
        headers: shipKey.headersFor(command),
        json: body,
        method: "POST",
        schema: ShipmentDtoSchema,
      });
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
      setStockConflict(false);
    },
    onError: (error) => {
      setActionError(
        problemMessage(error, "The shipment could not be posted."),
      );
      setStockConflict(isStockConflict(error));
    },
    onSuccess: async (result) => {
      shipKey.clear();
      setTrackingByShipment((current) => ({ ...current, [result.id]: "" }));
      setActionError("");
      setActionMessage(`${result.shipmentNumber} posted as shipped.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shipmentsKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: orderKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: backordersKey(orderId) }),
      ]);
    },
  });

  const consolidate = useMutation({
    mutationFn: (backorderId: string) =>
      browserApiRequest(
        apiRoutes.fulfillment.consolidateBackorder(backorderId),
        {
          headers: consolidateKey.headersFor({ backorderId }),
          json: {},
          method: "POST",
          schema: BackorderDtoSchema,
        },
      ),
    onMutate: () => {
      setActionError("");
      setActionMessage("");
    },
    onError: (error) => {
      setActionError(
        problemMessage(error, "Replenished stock could not be allocated."),
      );
    },
    onSuccess: async (result) => {
      consolidateKey.clear();
      setActionError("");
      setActionMessage(
        result.status === "FULFILLED"
          ? "Replenished stock was allocated and the backorder was fulfilled."
          : "Available replenished stock was allocated to a ready shipment.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: backordersKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: shipmentsKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: inventoryKey(orderId) }),
      ]);
    },
  });

  if (order.isPending) {
    return (
      <div aria-busy="true" className="grid gap-md" role="status">
        <Skeleton className="w-2/5" />
        <Skeleton shape="block" />
        <span className="sr-only">Loading fulfillment workspace…</span>
      </div>
    );
  }
  if (order.isError || !order.data) {
    return (
      <ErrorFeedback title="Order Not Available">
        {problemMessage(
          order.error,
          "The order could not be loaded. Check access and retry.",
        )}
      </ErrorFeedback>
    );
  }

  const plan = lastReservation?.plan ?? preview.data;
  const warehouseNames = new Map<string, string>();
  for (const allocation of plan?.allocations ?? []) {
    warehouseNames.set(allocation.warehouseId, allocation.warehouseName);
  }
  for (const warehouse of inventory.data?.warehouses ?? []) {
    warehouseNames.set(warehouse.id, warehouse.name);
  }
  const canReserve = granted.has("fulfillment.reserve") && previewEligible;
  const canOverride = granted.has("fulfillment.override") && previewEligible;
  const isBusy =
    reserve.isPending ||
    override.isPending ||
    ship.isPending ||
    consolidate.isPending;

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-xs">
            {granted.has("billing.read") ? (
              <ButtonLink
                href={`/orders/${encodeURIComponent(orderId)}/billing`}
                variant="secondary"
              >
                Open Billing
              </ButtonLink>
            ) : null}
            <Button
              disabled={isBusy}
              onClick={() => void refreshAuthoritativeState()}
              variant="secondary"
            >
              Refresh
            </Button>
          </div>
        }
        description={`${order.data.customerName}. Review server-recommended stock, compare a manual scenario, then commit one allocation.`}
        metadata={`Order ${order.data.orderNumber}`}
        title="Fulfillment"
      />

      <LiveRegion message={actionMessage || actionError} />
      {actionError ? (
        <ErrorFeedback title="Fulfillment Action Failed">
          {actionError}
        </ErrorFeedback>
      ) : null}
      {stockConflict ? (
        <InlineFeedback title="Stock Changed" tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <p className="m-0">
              Availability changed after this scenario was prepared. Refresh
              before retrying.
            </p>
            <Button
              onClick={() => void refreshAuthoritativeState()}
              size="compact"
              variant="secondary"
            >
              Refresh Preview
            </Button>
          </div>
        </InlineFeedback>
      ) : null}
      {actionMessage ? (
        <InlineFeedback tone="success">{actionMessage}</InlineFeedback>
      ) : null}

      <MetricGroup aria-label="Fulfillment summary">
        <Metric
          label="Order Status"
          value={formatEnumLabel(order.data.status)}
        />
        <Metric
          label="Assigned Warehouses"
          value={plan?.shipmentCount ?? shipments.data?.length ?? 0}
        />
        <Metric
          label="Backorder Quantity"
          tone={
            plan && plan.unfulfilledQuantity !== "0" ? "warning" : "neutral"
          }
          value={
            plan
              ? quantityLabel(plan.unfulfilledQuantity, locale)
              : quantityLabel(
                  addDecimalStrings(
                    ...currentBackorders.map((item) => item.remainingQuantity),
                  ),
                  locale,
                )
          }
        />
        <Metric
          detail={
            plan
              ? `${formatEnumLabel(plan.promiseDateConfidence.level)} confidence, ${plan.promiseDateConfidence.score}/100`
              : undefined
          }
          label="Promise"
          tone={
            plan
              ? promiseConfidenceTone(plan.promiseDateConfidence.level)
              : "neutral"
          }
          value={
            plan?.estimatedPromiseAt
              ? formatDateTime(plan.estimatedPromiseAt, locale, timeZone)
              : "Not available"
          }
        />
      </MetricGroup>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Recommended Allocation</PanelTitle>
            <PanelDescription>
              The API minimizes shortage, shipment count, estimated shipping
              cost, then promise date.
            </PanelDescription>
          </div>
          {plan ? (
            <Badge tone={statusTone(plan.status)}>
              {formatEnumLabel(plan.status)}
            </Badge>
          ) : null}
        </PanelHeader>
        <PanelBody className="grid gap-md">
          {previewEligible && preview.isPending ? (
            <div aria-busy="true" className="grid gap-sm" role="status">
              <Skeleton className="w-full" />
              <Skeleton className="w-4/5" />
              <span className="sr-only">Calculating allocation…</span>
            </div>
          ) : null}
          {previewEligible && preview.isError ? (
            <ErrorFeedback title="Recommendation Unavailable">
              {problemMessage(
                preview.error,
                "The allocation preview could not be calculated.",
              )}
            </ErrorFeedback>
          ) : null}
          {plan ? (
            <>
              <MetricGroup aria-label="Recommended scenario facts">
                <Metric label="Shipments" value={plan.shipmentCount} />
                <Metric
                  label="Unfulfilled"
                  tone={
                    plan.unfulfilledQuantity === "0" ? "success" : "warning"
                  }
                  value={quantityLabel(plan.unfulfilledQuantity, locale)}
                />
                <Metric
                  label="Estimated Cost"
                  value={formatMoney(
                    plan.estimatedShippingCost,
                    order.data.currency,
                    locale,
                  )}
                />
                <Metric label="Source" value={formatEnumLabel(plan.source)} />
              </MetricGroup>
              <PromiseDateConfidence
                confidence={plan.promiseDateConfidence}
                lines={lineById}
                timeZone={timeZone}
                warehouseNames={warehouseNames}
              />
              <div className="grid gap-md">
                {recommendationGroups.map((group) => (
                  <AllocationGroup
                    group={group}
                    key={group.id}
                    lines={lineById}
                    timeZone={timeZone}
                  />
                ))}
              </div>
            </>
          ) : !previewEligible ? (
            <EmptyState
              description="This order has moved beyond allocation preview. Shipment and backorder records remain below."
              headingLevel="h3"
              title="Allocation Already Committed"
            />
          ) : null}
        </PanelBody>
        {canReserve && preview.data ? (
          <PanelFooter>
            <Button
              disabled={isBusy}
              onClick={() => reserve.mutate(preview.data)}
            >
              {reserve.isPending
                ? "Reserving Stock…"
                : "Reserve Recommended Plan"}
            </Button>
          </PanelFooter>
        ) : null}
      </Panel>

      {canOverride ? (
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Manual Scenario Comparison</PanelTitle>
              <PanelDescription>
                Edit assigned quantities without dragging. Draft figures are
                estimates; the API validates stock and recalculates before
                reservation.
              </PanelDescription>
            </div>
            <Badge tone="warning">Override Requires Reason</Badge>
          </PanelHeader>
          <PanelBody className="grid gap-md">
            {inventory.isPending ? (
              <div aria-busy="true" className="grid gap-sm" role="status">
                <Skeleton className="w-full" />
                <Skeleton className="w-3/4" />
                <span className="sr-only">Loading warehouse availability…</span>
              </div>
            ) : null}
            {inventory.isError ? (
              <ErrorFeedback title="Warehouse Stock Unavailable">
                {problemMessage(
                  inventory.error,
                  "Warehouse availability could not be loaded.",
                )}
              </ErrorFeedback>
            ) : null}
            {inventory.data && stockLineIds.size > 0 ? (
              <div className="grid gap-md">
                {[...stockLineIds].map((lineId) => {
                  const line = lineById.get(lineId);
                  if (!line) return null;
                  const balances = inventory.data.balances.filter(
                    (balance) =>
                      balance.productId === line.productId &&
                      balance.variantId === line.variantId,
                  );
                  return (
                    <fieldset
                      className="grid gap-sm rounded-panel border border-border p-sm"
                      key={line.id}
                    >
                      <legend className="px-xs text-body-sm font-semibold text-foreground-strong">
                        {line.productName}, ordered{" "}
                        {quantityLabel(line.quantity, locale)}
                      </legend>
                      <div className="grid gap-sm sm:grid-cols-2 xl:grid-cols-3">
                        {balances.map((balance) => {
                          const key = `${line.id}:${balance.warehouseId}`;
                          return (
                            <Field key={balance.id}>
                              <FieldLabel
                                htmlFor={`manual-${line.id}-${balance.warehouseId}`}
                              >
                                {balance.warehouseName}
                              </FieldLabel>
                              <Input
                                autoComplete="off"
                                disabled={isBusy}
                                id={`manual-${line.id}-${balance.warehouseId}`}
                                inputMode="decimal"
                                min="0"
                                name={key}
                                onChange={(event) =>
                                  setManualQuantities((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                step="0.0001"
                                type="number"
                                value={effectiveQuantities[key] ?? ""}
                              />
                              <FieldDescription>
                                {quantityLabel(balance.available, locale)}{" "}
                                available,{" "}
                                {quantityLabel(balance.incoming, locale)}{" "}
                                incoming
                              </FieldDescription>
                            </Field>
                          );
                        })}
                        {balances.length === 0 ? (
                          <p className="m-0 text-caption text-foreground-muted">
                            No active warehouse has an inventory balance for
                            this line.
                          </p>
                        ) : null}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            ) : null}
            {manualScenario ? (
              <div className="grid gap-sm border-t border-border pt-md">
                <h3 className="m-0 text-title font-semibold text-foreground-strong">
                  Scenario Comparison
                </h3>
                {manualScenario.error ? (
                  <ErrorFeedback title="Draft Scenario Invalid">
                    {manualScenario.error}
                  </ErrorFeedback>
                ) : null}
                <DataTable aria-label="Recommended and manual fulfillment scenario comparison">
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Scenario</DataTableHead>
                      <DataTableHead numeric>Assigned</DataTableHead>
                      <DataTableHead numeric>Shipments</DataTableHead>
                      <DataTableHead numeric>Backorder</DataTableHead>
                      <DataTableHead numeric>Estimated Cost</DataTableHead>
                      <DataTableHead>Promise</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {preview.data ? (
                      <DataTableRow>
                        <DataTableCell>Recommended by API</DataTableCell>
                        <DataTableCell numeric>
                          {quantityLabel(
                            addDecimalStrings(
                              ...preview.data.allocations.map(
                                (allocation) => allocation.quantity,
                              ),
                            ),
                            locale,
                          )}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {preview.data.shipmentCount}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {quantityLabel(
                            preview.data.unfulfilledQuantity,
                            locale,
                          )}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {formatMoney(
                            preview.data.estimatedShippingCost,
                            order.data.currency,
                            locale,
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          {preview.data.estimatedPromiseAt
                            ? formatDateTime(
                                preview.data.estimatedPromiseAt,
                                locale,
                                timeZone,
                              )
                            : "Not available"}
                        </DataTableCell>
                      </DataTableRow>
                    ) : null}
                    <DataTableRow>
                      <DataTableCell>Manual draft estimate</DataTableCell>
                      <DataTableCell numeric>
                        {quantityLabel(manualScenario.assignedQuantity, locale)}
                      </DataTableCell>
                      <DataTableCell numeric>
                        {manualScenario.shipmentCount}
                      </DataTableCell>
                      <DataTableCell numeric>
                        {quantityLabel(
                          manualScenario.unfulfilledQuantity,
                          locale,
                        )}
                      </DataTableCell>
                      <DataTableCell numeric>
                        {formatMoney(
                          manualScenario.estimatedShippingCost,
                          order.data.currency,
                          locale,
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {manualScenario.estimatedPromiseAt
                          ? formatDateTime(
                              manualScenario.estimatedPromiseAt,
                              locale,
                              timeZone,
                            )
                          : "Not available"}
                      </DataTableCell>
                    </DataTableRow>
                  </DataTableBody>
                </DataTable>
                <Field>
                  <FieldLabel htmlFor="override-reason">
                    Override Reason
                  </FieldLabel>
                  <Textarea
                    aria-describedby={
                      overrideReason.trim().length === 0
                        ? "override-reason-error"
                        : "override-reason-help"
                    }
                    aria-invalid={overrideReason.trim().length === 0}
                    autoComplete="off"
                    id="override-reason"
                    disabled={isBusy}
                    maxLength={1000}
                    name="override-reason"
                    onChange={(event) => setOverrideReason(event.target.value)}
                    rows={3}
                    value={overrideReason}
                  />
                  {overrideReason.trim().length === 0 ? (
                    <FieldError id="override-reason-error">
                      A reason is required before the manual scenario can be
                      reserved.
                    </FieldError>
                  ) : (
                    <FieldDescription id="override-reason-help">
                      This reason is recorded in the fulfillment audit trail.
                    </FieldDescription>
                  )}
                </Field>
              </div>
            ) : null}
          </PanelBody>
          <PanelFooter>
            <Button
              disabled={isBusy}
              onClick={() => setManualQuantities({})}
              variant="secondary"
            >
              Reset to Recommendation
            </Button>
            <Button
              disabled={
                isBusy ||
                Boolean(manualScenario?.error) ||
                !manualScenario?.allocations.length ||
                overrideReason.trim().length === 0
              }
              onClick={() => override.mutate()}
            >
              {override.isPending
                ? "Validating & Reserving…"
                : "Validate & Reserve Override"}
            </Button>
          </PanelFooter>
        </Panel>
      ) : null}

      <div className="grid gap-md xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Shipments</PanelTitle>
              <PanelDescription>
                Post only ready shipments with their carrier tracking reference.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody className="grid gap-md">
            {shipments.isPending ? <Skeleton shape="block" /> : null}
            {shipments.isError ? (
              <ErrorFeedback title="Shipments Unavailable">
                {problemMessage(
                  shipments.error,
                  "Shipment records could not be loaded.",
                )}
              </ErrorFeedback>
            ) : null}
            {shipments.data?.length === 0 ? (
              <EmptyState
                description="Shipments are created after stock is reserved."
                headingLevel="h3"
                title="No Shipments"
              />
            ) : null}
            {shipments.data?.map((shipment) => (
              <ShipmentCard
                canShip={granted.has("fulfillment.reserve")}
                currency={order.data.currency}
                disabled={isBusy}
                key={shipment.id}
                onShip={(selected) => ship.mutate(selected)}
                pending={ship.isPending && ship.variables?.id === shipment.id}
                shipment={shipment}
                timeZone={timeZone}
                tracking={trackingByShipment[shipment.id] ?? ""}
                updateTracking={(value) =>
                  setTrackingByShipment((current) => ({
                    ...current,
                    [shipment.id]: value,
                  }))
                }
              />
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Backorders</PanelTitle>
              <PanelDescription>
                Allocate replenished inventory into ready shipments when the
                server confirms stock is available.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody className="grid gap-md">
            {backorders.isPending ? <Skeleton shape="block" /> : null}
            {backorders.isError ? (
              <ErrorFeedback title="Backorders Unavailable">
                {problemMessage(
                  backorders.error,
                  "Backorder records could not be loaded.",
                )}
              </ErrorFeedback>
            ) : null}
            {currentBackorders.length === 0 ? (
              <EmptyState
                description="No shortages are recorded for this order."
                headingLevel="h3"
                title="No Backorders"
              />
            ) : null}
            {currentBackorders.map((backorder) => (
              <article
                className="grid gap-xs border-b border-border pb-md last:border-b-0 last:pb-0"
                key={backorder.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-xs">
                  <div>
                    <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
                      {backorder.productName}
                    </h3>
                    <p className="m-0 font-mono text-caption tabular-nums text-foreground-muted">
                      {quantityLabel(backorder.remainingQuantity, locale)}{" "}
                      remaining
                    </p>
                  </div>
                  <Badge tone={statusTone(backorder.status)}>
                    {formatEnumLabel(backorder.status)}
                  </Badge>
                </div>
                <p className="m-0 text-caption text-foreground-muted">
                  Expected{" "}
                  {backorder.expectedAt
                    ? formatDateTime(backorder.expectedAt, locale, timeZone)
                    : "date not available"}
                </p>
                <p className="m-0 text-caption text-foreground-muted">
                  Available to allocate:{" "}
                  {quantityLabel(backorder.availableQuantity, locale)}
                </p>
                {backorder.consolidationReason ? (
                  <p className="m-0 text-caption text-foreground-muted">
                    {backorder.consolidationReason}
                  </p>
                ) : null}
                {granted.has("fulfillment.reserve") &&
                backorder.consolidationEligible ? (
                  <Button
                    disabled={isBusy}
                    onClick={() => consolidate.mutate(backorder.id)}
                    size="compact"
                    variant="secondary"
                  >
                    {consolidate.isPending &&
                    consolidate.variables === backorder.id
                      ? "Allocating…"
                      : "Allocate Replenished Stock"}
                  </Button>
                ) : null}
              </article>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
