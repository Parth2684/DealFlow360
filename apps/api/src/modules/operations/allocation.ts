import {
  FulfillmentPlanDtoSchema,
  type FulfillmentPlanDto,
  type ManualFulfillmentAllocationRequest,
  type PromiseDateConfidenceDto,
} from "@repo/common";
import { Prisma } from "@repo/db";

import { conflict } from "../../shared/errors.js";
import { stableFingerprint } from "../../shared/security.js";

export type AllocationOrder = Prisma.OrderGetPayload<{
  include: {
    lines: {
      include: { product: true };
      orderBy: { position: "asc" };
    };
  };
}>;

export type AllocationBalance = Prisma.InventoryBalanceGetPayload<{
  include: { warehouse: true };
}>;

export interface PreviewAllocation {
  orderLineId: string;
  warehouseId: string;
  warehouseName: string;
  inventoryBalanceId: string;
  inventoryRevision: number;
  productId: string;
  variantId: string | null;
  quantity: Prisma.Decimal;
  availableAtPreview: Prisma.Decimal;
  estimatedCost: Prisma.Decimal;
  estimatedDate: Date;
}

export interface AllocationPreview {
  dto: FulfillmentPlanDto;
  allocations: PreviewAllocation[];
}

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

function uuidFromFingerprint(fingerprint: string): string {
  return `${fingerprint.slice(0, 8)}-${fingerprint.slice(8, 12)}-4${fingerprint.slice(13, 16)}-a${fingerprint.slice(17, 20)}-${fingerprint.slice(20, 32)}`;
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function sameVariant(left: string | null, right: string | null): boolean {
  return left === right;
}

function availabilitySnapshot(
  order: AllocationOrder,
  balances: readonly AllocationBalance[],
) {
  return {
    orderRevision: order.revision,
    balances: [...balances]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((balance) => ({
        id: balance.id,
        revision: balance.revision,
        warehouseId: balance.warehouseId,
        productId: balance.productId,
        variantId: balance.variantId,
        onHand: balance.onHand.toString(),
        reserved: balance.reserved.toString(),
        available: balance.available.toString(),
        incoming: balance.incoming.toString(),
        incomingExpectedAt: balance.incomingExpectedAt?.toISOString() ?? null,
        warehouseLeadTimeDays: balance.warehouse.leadTimeDays,
      })),
  };
}

function latestDate(left: Date | null, right: Date): Date {
  return left === null || right > left ? right : left;
}

function decimalRatio(
  numerator: Prisma.Decimal,
  denominator: Prisma.Decimal,
): Prisma.Decimal {
  return denominator.isZero()
    ? ZERO
    : Prisma.Decimal.min(
        new Prisma.Decimal(1),
        Prisma.Decimal.max(ZERO, numerator.div(denominator)),
      );
}

function buildPromiseDateConfidence(
  order: AllocationOrder,
  balances: readonly AllocationBalance[],
  allocations: readonly PreviewAllocation[],
  planningStartedAt: Date,
): PromiseDateConfidenceDto {
  const hardwareLines = order.lines.filter(
    (line) => line.product.type === "HARDWARE",
  );
  if (hardwareLines.length === 0) {
    return {
      level: "UNAVAILABLE",
      score: 0,
      estimatedPromiseAt: null,
      splitShipmentCount: 0,
      projectedUnfulfilledQuantity: "0",
      inventoryInputs: [],
      reasonCodes: ["NO_STOCK_MANAGED_LINES"],
      explanation: [
        "This order has no stock-managed hardware, so an inventory promise date does not apply.",
      ],
    };
  }

  const activeBalances = balances.filter(
    (balance) => balance.warehouse.status === "ACTIVE",
  );
  const allocatedByLine = new Map<string, Prisma.Decimal>();
  const projectedWarehouseIds = new Set<string>();
  let latestPromiseAt: Date | null = null;
  for (const allocation of allocations) {
    allocatedByLine.set(
      allocation.orderLineId,
      (allocatedByLine.get(allocation.orderLineId) ?? ZERO).plus(
        allocation.quantity,
      ),
    );
    projectedWarehouseIds.add(allocation.warehouseId);
    latestPromiseAt = latestDate(latestPromiseAt, allocation.estimatedDate);
  }

  const incomingByBalance = new Map(
    activeBalances.map((balance) => [
      balance.id,
      new Prisma.Decimal(balance.incoming),
    ]),
  );
  let incomingUsed = ZERO;
  let projectedUnfulfilled = ZERO;
  let missingEtaQuantity = ZERO;
  for (const line of hardwareLines) {
    let remaining = Prisma.Decimal.max(
      ZERO,
      line.quantity.minus(allocatedByLine.get(line.id) ?? ZERO),
    );
    const candidates = activeBalances
      .filter(
        (balance) =>
          balance.productId === line.productId &&
          sameVariant(balance.variantId, line.variantId) &&
          (incomingByBalance.get(balance.id) ?? ZERO).greaterThan(ZERO),
      )
      .sort((left, right) => {
        if (
          left.incomingExpectedAt === null ||
          right.incomingExpectedAt === null
        ) {
          if (
            left.incomingExpectedAt === null &&
            right.incomingExpectedAt !== null
          )
            return 1;
          if (
            left.incomingExpectedAt !== null &&
            right.incomingExpectedAt === null
          )
            return -1;
        }
        const arrival =
          (left.incomingExpectedAt?.getTime() ?? Number.POSITIVE_INFINITY) -
          (right.incomingExpectedAt?.getTime() ?? Number.POSITIVE_INFINITY);
        if (arrival !== 0) return arrival;
        if (left.warehouse.leadTimeDays !== right.warehouse.leadTimeDays) {
          return left.warehouse.leadTimeDays - right.warehouse.leadTimeDays;
        }
        const cost = left.warehouse.shippingCostWeight.comparedTo(
          right.warehouse.shippingCostWeight,
        );
        return cost === 0 ? left.id.localeCompare(right.id) : cost;
      });

    for (const balance of candidates) {
      if (!remaining.greaterThan(ZERO)) break;
      const incoming = incomingByBalance.get(balance.id) ?? ZERO;
      if (balance.incomingExpectedAt === null) {
        missingEtaQuantity = missingEtaQuantity.plus(
          Prisma.Decimal.min(remaining, incoming),
        );
        continue;
      }
      const quantity = Prisma.Decimal.min(remaining, incoming);
      remaining = remaining.minus(quantity);
      incomingUsed = incomingUsed.plus(quantity);
      incomingByBalance.set(balance.id, incoming.minus(quantity));
      projectedWarehouseIds.add(balance.warehouseId);
      const usableFrom =
        balance.incomingExpectedAt > planningStartedAt
          ? balance.incomingExpectedAt
          : planningStartedAt;
      latestPromiseAt = latestDate(
        latestPromiseAt,
        addUtcDays(usableFrom, balance.warehouse.leadTimeDays),
      );
    }
    projectedUnfulfilled = projectedUnfulfilled.plus(remaining);
  }

  const totalQuantity = hardwareLines.reduce(
    (total, line) => total.plus(line.quantity),
    ZERO,
  );
  const currentAllocated = allocations.reduce(
    (total, allocation) => total.plus(allocation.quantity),
    ZERO,
  );
  const reservationTotal = activeBalances
    .filter((balance) =>
      hardwareLines.some(
        (line) =>
          line.productId === balance.productId &&
          sameVariant(line.variantId, balance.variantId),
      ),
    )
    .reduce((total, balance) => total.plus(balance.reserved), ZERO);
  const onHandTotal = activeBalances
    .filter((balance) =>
      hardwareLines.some(
        (line) =>
          line.productId === balance.productId &&
          sameVariant(line.variantId, balance.variantId),
      ),
    )
    .reduce((total, balance) => total.plus(balance.onHand), ZERO);
  const usedLeadTimes = activeBalances
    .filter((balance) => projectedWarehouseIds.has(balance.warehouseId))
    .map((balance) => balance.warehouse.leadTimeDays);
  const maxLeadTimeDays =
    usedLeadTimes.length === 0 ? 0 : Math.max(...usedLeadTimes);
  const splitShipmentCount = projectedWarehouseIds.size;
  const shortfallPenalty = decimalRatio(
    projectedUnfulfilled,
    totalQuantity,
  ).mul(60);
  const incomingPenalty = decimalRatio(incomingUsed, totalQuantity).mul(15);
  const reservationPenalty = decimalRatio(reservationTotal, onHandTotal).mul(
    15,
  );
  const splitPenalty = new Prisma.Decimal(
    Math.min(20, Math.max(0, splitShipmentCount - 1) * 8),
  );
  const leadTimePenalty = new Prisma.Decimal(
    Math.min(15, Math.max(0, maxLeadTimeDays - 2) * 3),
  );
  const score = Prisma.Decimal.max(
    ZERO,
    ONE_HUNDRED.minus(shortfallPenalty)
      .minus(incomingPenalty)
      .minus(reservationPenalty)
      .minus(splitPenalty)
      .minus(leadTimePenalty),
  )
    .toDecimalPlaces(0)
    .toNumber();
  const hasFullCoverage = projectedUnfulfilled.isZero();
  const level: PromiseDateConfidenceDto["level"] = !hasFullCoverage
    ? "UNAVAILABLE"
    : score >= 80
      ? "HIGH"
      : score >= 55
        ? "MEDIUM"
        : "LOW";

  const reasonCodes: string[] = [];
  const explanation: string[] = [];
  if (currentAllocated.greaterThanOrEqualTo(totalQuantity)) {
    reasonCodes.push("CURRENT_STOCK_COVERS_ORDER");
    explanation.push(
      `Current net availability covers all ${totalQuantity.toString()} stock-managed units.`,
    );
  } else if (incomingUsed.greaterThan(ZERO)) {
    reasonCodes.push("INCOMING_STOCK_REQUIRED");
    explanation.push(
      `${incomingUsed.toString()} unit(s) depend on dated incoming stock before warehouse lead time is applied.`,
    );
  }
  if (reservationTotal.greaterThan(ZERO)) {
    reasonCodes.push("ACTIVE_RESERVATIONS_REDUCE_AVAILABILITY");
    explanation.push(
      `${reservationTotal.toString()} unit(s) are already reserved and were excluded from current availability.`,
    );
  }
  if (missingEtaQuantity.greaterThan(ZERO)) {
    reasonCodes.push("INCOMING_ETA_MISSING");
    explanation.push(
      `${missingEtaQuantity.toString()} incoming unit(s) have no ETA and cannot support the promised date.`,
    );
  }
  if (projectedUnfulfilled.greaterThan(ZERO)) {
    reasonCodes.push("INVENTORY_SHORTFALL");
    explanation.push(
      `${projectedUnfulfilled.toString()} unit(s) remain uncovered after current and dated incoming stock.`,
    );
  }
  if (splitShipmentCount > 1) {
    reasonCodes.push("SPLIT_SHIPMENT_COMPLEXITY");
    explanation.push(
      `The projected fulfillment uses ${splitShipmentCount} warehouses, reducing confidence for coordination risk.`,
    );
  }
  if (maxLeadTimeDays > 2) {
    reasonCodes.push("EXTENDED_WAREHOUSE_LEAD_TIME");
    explanation.push(
      `The longest selected warehouse lead time is ${maxLeadTimeDays} days.`,
    );
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push("CURRENT_STOCK_COVERS_ORDER");
    explanation.push(
      "Current net availability and warehouse lead time support the estimate.",
    );
  }

  return {
    level,
    score,
    estimatedPromiseAt:
      hasFullCoverage && latestPromiseAt !== null
        ? latestPromiseAt.toISOString()
        : null,
    splitShipmentCount,
    projectedUnfulfilledQuantity: projectedUnfulfilled.toString(),
    inventoryInputs: hardwareLines.flatMap((line) =>
      activeBalances
        .filter(
          (balance) =>
            balance.productId === line.productId &&
            sameVariant(balance.variantId, line.variantId),
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((balance) => ({
          orderLineId: line.id,
          warehouseId: balance.warehouseId,
          currentAvailable: balance.available.toString(),
          existingReserved: balance.reserved.toString(),
          incomingQuantity: balance.incoming.toString(),
          incomingExpectedAt: balance.incomingExpectedAt?.toISOString() ?? null,
          leadTimeDays: balance.warehouse.leadTimeDays,
        })),
    ),
    reasonCodes,
    explanation,
  };
}

function finalizePreview(
  order: AllocationOrder,
  balances: readonly AllocationBalance[],
  source: "RECOMMENDED" | "MANUAL",
  allocations: PreviewAllocation[],
  overrideReason: string | null,
  planningStartedAt: Date,
): AllocationPreview {
  const hardwareLines = order.lines.filter(
    (line) => line.product.type === "HARDWARE",
  );
  const allocatedByLine = new Map<string, Prisma.Decimal>();
  for (const allocation of allocations) {
    allocatedByLine.set(
      allocation.orderLineId,
      (allocatedByLine.get(allocation.orderLineId) ?? ZERO).plus(
        allocation.quantity,
      ),
    );
  }
  const unfulfilledQuantity = hardwareLines.reduce(
    (total, line) =>
      total.plus(
        Prisma.Decimal.max(
          ZERO,
          line.quantity.minus(allocatedByLine.get(line.id) ?? ZERO),
        ),
      ),
    ZERO,
  );
  const usedWarehouseIds = [
    ...new Set(allocations.map((item) => item.warehouseId)),
  ];
  const estimatedShippingCost = usedWarehouseIds.reduce(
    (total, warehouseId) => {
      const warehouse = balances.find(
        (item) => item.warehouseId === warehouseId,
      )?.warehouse;
      return total.plus(warehouse?.shippingCostWeight ?? ZERO);
    },
    ZERO,
  );
  const promiseDateConfidence = buildPromiseDateConfidence(
    order,
    balances,
    allocations,
    planningStartedAt,
  );
  const snapshot = availabilitySnapshot(order, balances);
  const fingerprint = stableFingerprint({
    orderId: order.id,
    source,
    allocations: allocations.map((item) => ({
      orderLineId: item.orderLineId,
      warehouseId: item.warehouseId,
      quantity: item.quantity.toString(),
      inventoryBalanceId: item.inventoryBalanceId,
      inventoryRevision: item.inventoryRevision,
    })),
    overrideReason,
    snapshot,
  });
  const dto = FulfillmentPlanDtoSchema.parse({
    id: uuidFromFingerprint(fingerprint),
    orderId: order.id,
    revision: order.revision,
    status: "PREVIEW",
    source,
    allocations: allocations.map((item) => ({
      orderLineId: item.orderLineId,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouseName,
      quantity: item.quantity.toString(),
      availableAtPreview: item.availableAtPreview.toString(),
      estimatedCost: item.estimatedCost.toString(),
      estimatedDate: item.estimatedDate.toISOString(),
    })),
    unfulfilledQuantity: unfulfilledQuantity.toString(),
    shipmentCount: usedWarehouseIds.length,
    estimatedShippingCost: estimatedShippingCost.toString(),
    estimatedPromiseAt: promiseDateConfidence.estimatedPromiseAt,
    promiseDateConfidence,
    overrideReason,
    availabilitySnapshot: snapshot,
    expiresAt: null,
    createdAt: planningStartedAt.toISOString(),
  });
  return { dto, allocations };
}

function warehouseRank(
  balance: AllocationBalance,
  remainingLines: readonly AllocationOrder["lines"][number][],
  balances: readonly AllocationBalance[],
  availableByBalance: ReadonlyMap<string, Prisma.Decimal>,
): [number, Prisma.Decimal, number, string, string] {
  const eligible = remainingLines.filter((line) => {
    const matchingBalance = balances.find(
      (candidate) =>
        candidate.warehouseId === balance.warehouseId &&
        candidate.productId === line.productId &&
        sameVariant(candidate.variantId, line.variantId),
    );
    return (
      matchingBalance !== undefined &&
      (availableByBalance.get(matchingBalance.id) ?? ZERO).greaterThanOrEqualTo(
        line.quantity,
      )
    );
  }).length;
  return [
    eligible,
    balance.warehouse.shippingCostWeight,
    balance.warehouse.leadTimeDays,
    balance.warehouse.code,
    balance.id,
  ];
}

function compareWarehouseRank(
  left: ReturnType<typeof warehouseRank>,
  right: ReturnType<typeof warehouseRank>,
): number {
  if (left[0] !== right[0]) return right[0] - left[0];
  const cost = left[1].comparedTo(right[1]);
  if (cost !== 0) return cost;
  if (left[2] !== right[2]) return left[2] - right[2];
  const code = left[3].localeCompare(right[3]);
  return code === 0 ? left[4].localeCompare(right[4]) : code;
}

export function buildRecommendedPreview(
  order: AllocationOrder,
  balances: readonly AllocationBalance[],
): AllocationPreview {
  const planningStartedAt = new Date();
  const hardwareLines = order.lines.filter(
    (line) => line.product.type === "HARDWARE",
  );
  const eligibleBalances = balances.filter(
    (balance) => balance.warehouse.status === "ACTIVE",
  );
  const availableBalances = eligibleBalances.filter((balance) =>
    balance.available.greaterThan(0),
  );
  const availableByBalance = new Map(
    availableBalances.map((balance) => [
      balance.id,
      new Prisma.Decimal(balance.available),
    ]),
  );
  const allocations: PreviewAllocation[] = [];

  for (const [lineIndex, line] of hardwareLines.entries()) {
    let remaining = new Prisma.Decimal(line.quantity);
    while (remaining.greaterThan(0)) {
      const remainingLines = hardwareLines
        .slice(lineIndex)
        .filter((candidate) => {
          if (candidate.id === line.id) return remaining.greaterThan(0);
          return true;
        });
      const candidates = availableBalances
        .filter(
          (balance) =>
            balance.productId === line.productId &&
            sameVariant(balance.variantId, line.variantId) &&
            (availableByBalance.get(balance.id) ?? ZERO).greaterThan(0),
        )
        .sort((left, right) =>
          compareWarehouseRank(
            warehouseRank(
              left,
              remainingLines,
              availableBalances,
              availableByBalance,
            ),
            warehouseRank(
              right,
              remainingLines,
              availableBalances,
              availableByBalance,
            ),
          ),
        );
      const balance = candidates[0];
      if (balance === undefined) break;
      const available = availableByBalance.get(balance.id) ?? ZERO;
      const quantity = Prisma.Decimal.min(remaining, available);
      allocations.push({
        orderLineId: line.id,
        warehouseId: balance.warehouseId,
        warehouseName: balance.warehouse.name,
        inventoryBalanceId: balance.id,
        inventoryRevision: balance.revision,
        productId: line.productId,
        variantId: line.variantId,
        quantity,
        availableAtPreview: balance.available,
        estimatedCost: balance.warehouse.shippingCostWeight,
        estimatedDate: addUtcDays(
          planningStartedAt,
          balance.warehouse.leadTimeDays,
        ),
      });
      remaining = remaining.minus(quantity);
      availableByBalance.set(balance.id, available.minus(quantity));
    }
  }

  return finalizePreview(
    order,
    eligibleBalances,
    "RECOMMENDED",
    allocations,
    null,
    planningStartedAt,
  );
}

export function buildManualPreview(
  order: AllocationOrder,
  balances: readonly AllocationBalance[],
  requested: readonly ManualFulfillmentAllocationRequest[],
  reason: string,
): AllocationPreview {
  const planningStartedAt = new Date();
  const hardwareLines = order.lines.filter(
    (line) => line.product.type === "HARDWARE",
  );
  const linesById = new Map(hardwareLines.map((line) => [line.id, line]));
  const linesByQuoteId = new Map(
    hardwareLines.map((line) => [line.quoteLineId, line]),
  );
  const balancesByKey = new Map(
    balances
      .filter((balance) => balance.warehouse.status === "ACTIVE")
      .map((balance) => [
        `${balance.warehouseId}:${balance.productId}:${balance.variantId ?? "none"}`,
        balance,
      ]),
  );
  const allocatedByLine = new Map<string, Prisma.Decimal>();
  const allocatedByBalance = new Map<string, Prisma.Decimal>();
  const usedPairs = new Set<string>();
  const allocations: PreviewAllocation[] = [];

  for (const item of requested) {
    const line =
      (item.orderLineId === undefined
        ? undefined
        : linesById.get(item.orderLineId)) ??
      (item.quoteLineId === undefined
        ? undefined
        : linesByQuoteId.get(item.quoteLineId));
    if (line === undefined) {
      conflict(
        "A manual allocation references a line that is not a hardware line on this order",
        "INVALID_ALLOCATION_LINE",
      );
    }
    const pair = `${line.id}:${item.warehouseId}`;
    if (usedPairs.has(pair)) {
      conflict(
        "Manual allocations cannot repeat the same order line and warehouse",
        "DUPLICATE_ALLOCATION",
      );
    }
    usedPairs.add(pair);
    const balance = balancesByKey.get(
      `${item.warehouseId}:${line.productId}:${line.variantId ?? "none"}`,
    );
    if (balance === undefined) {
      conflict(
        "A selected warehouse has no active inventory balance for the order line",
        "INVENTORY_BALANCE_NOT_FOUND",
      );
    }
    const quantity = new Prisma.Decimal(item.quantity);
    const lineTotal = (allocatedByLine.get(line.id) ?? ZERO).plus(quantity);
    if (lineTotal.greaterThan(line.quantity)) {
      conflict(
        "Manual allocation quantity exceeds the ordered quantity",
        "ALLOCATION_EXCEEDS_ORDER",
      );
    }
    const balanceTotal = (allocatedByBalance.get(balance.id) ?? ZERO).plus(
      quantity,
    );
    if (balanceTotal.greaterThan(balance.available)) {
      conflict(
        "Manual allocation quantity exceeds current warehouse availability",
        "ALLOCATION_EXCEEDS_AVAILABILITY",
      );
    }
    allocatedByLine.set(line.id, lineTotal);
    allocatedByBalance.set(balance.id, balanceTotal);
    allocations.push({
      orderLineId: line.id,
      warehouseId: balance.warehouseId,
      warehouseName: balance.warehouse.name,
      inventoryBalanceId: balance.id,
      inventoryRevision: balance.revision,
      productId: line.productId,
      variantId: line.variantId,
      quantity,
      availableAtPreview: balance.available,
      estimatedCost: balance.warehouse.shippingCostWeight,
      estimatedDate: addUtcDays(
        planningStartedAt,
        balance.warehouse.leadTimeDays,
      ),
    });
  }

  return finalizePreview(
    order,
    balances,
    "MANUAL",
    allocations,
    reason,
    planningStartedAt,
  );
}
