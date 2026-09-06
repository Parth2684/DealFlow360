import { Prisma } from "@repo/db";

import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import type { ClaimedOutboxEvent } from "../job-events.js";
import { lockWorkerEntity } from "../locks.js";

const ZERO = new Prisma.Decimal(0);
const OPEN_BACKORDER_STATUSES = ["OPEN", "PARTIALLY_ALLOCATED"] as const;
const ACTIVE_ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "SNOOZED"] as const;

export async function recheckBackorder(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "backorder",
    event.aggregateId,
  );
  const backorder = await transaction.backorder.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    include: {
      orderLine: true,
      order: { select: { ownerId: true, quoteId: true } },
    },
  });
  if (backorder === null) return;
  const reasonCode = `BACKORDER_READY:${backorder.id}`;
  if (
    !OPEN_BACKORDER_STATUSES.includes(
      backorder.status as (typeof OPEN_BACKORDER_STATUSES)[number],
    )
  ) {
    await transaction.alert.updateMany({
      where: {
        organizationId: event.organizationId,
        quoteId: backorder.order.quoteId,
        reasonCode,
        status: { in: [...ACTIVE_ALERT_STATUSES] },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    return;
  }

  const balances = await transaction.inventoryBalance.findMany({
    where: {
      organizationId: event.organizationId,
      productId: backorder.orderLine.productId,
      variantId: backorder.orderLine.variantId,
      warehouse: { status: "ACTIVE" },
    },
    select: { available: true },
  });
  const available = balances.reduce(
    (total, balance) => total.plus(balance.available),
    ZERO,
  );
  const stockAvailable = available.greaterThan(ZERO);
  const consolidationEligible = stockAvailable;
  const actionable = stockAvailable;
  const existingAlert = await transaction.alert.findFirst({
    where: {
      organizationId: event.organizationId,
      quoteId: backorder.order.quoteId,
      reasonCode,
      status: { in: [...ACTIVE_ALERT_STATUSES] },
    },
  });
  if (!actionable) {
    if (existingAlert !== null) {
      await transaction.alert.update({
        where: { id: existingAlert.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          revision: { increment: 1 },
        },
      });
    }
    return;
  }

  const fullyAllocatable = available.greaterThanOrEqualTo(
    backorder.remainingQuantity,
  );
  const title = "Replenished stock is available for a backorder";
  const message = fullyAllocatable
    ? `${available.toString()} units are available, enough to cover the remaining ${backorder.remainingQuantity.toString()} units`
    : `${available.toString()} units are available for the remaining ${backorder.remainingQuantity.toString()} units`;
  const now = new Date();
  const facts = jsonInput({
    backorderId: backorder.id,
    orderId: backorder.orderId,
    orderLineId: backorder.orderLineId,
    productId: backorder.orderLine.productId,
    variantId: backorder.orderLine.variantId,
    availableQuantity: available.toString(),
    remainingQuantity: backorder.remainingQuantity.toString(),
    fullyAllocatable,
    consolidationEligible,
    checkedAt: now,
  });
  if (existingAlert !== null) {
    await transaction.alert.update({
      where: { id: existingAlert.id },
      data: {
        severity: fullyAllocatable ? "INFO" : "WARNING",
        title,
        message,
        facts,
        status:
          existingAlert.status === "SNOOZED" &&
          (existingAlert.snoozedUntil === null ||
            existingAlert.snoozedUntil <= now)
            ? "OPEN"
            : existingAlert.status,
        resolvedAt: null,
        revision: { increment: 1 },
      },
    });
    return;
  }

  const alert = await transaction.alert.create({
    data: {
      organizationId: event.organizationId,
      quoteId: backorder.order.quoteId,
      type: "PROMISE_SLIPPAGE",
      severity: fullyAllocatable ? "INFO" : "WARNING",
      status: "OPEN",
      reasonCode,
      title,
      message,
      facts,
    },
  });
  await recordActivity(transaction, {
    organizationId: event.organizationId,
    eventType: "alert.created",
    entityType: "Alert",
    entityId: alert.id,
    entityVersion: alert.revision,
    quoteId: backorder.order.quoteId,
    title,
    message,
    metadata: { backorderId: backorder.id, orderId: backorder.orderId },
  });
  const operationsRecipients = await transaction.roleAssignment.findMany({
    where: {
      organizationId: event.organizationId,
      active: true,
      role: "OPERATIONS",
      user: { organizationId: event.organizationId, status: "ACTIVE" },
      userId: { not: backorder.order.ownerId },
    },
    select: { userId: true },
    take: 25,
  });
  if (operationsRecipients.length > 0) {
    await transaction.notification.createMany({
      data: operationsRecipients.map(({ userId }) => ({
        organizationId: event.organizationId,
        recipientUserId: userId,
        channel: "IN_APP" as const,
        type: "BACKORDER_ACTION_AVAILABLE",
        title,
        body: message,
        data: jsonInput({
          alertId: alert.id,
          quoteId: backorder.order.quoteId,
          orderId: backorder.orderId,
          backorderId: backorder.id,
          fullyAllocatable,
          consolidationEligible,
        }),
        status: "QUEUED" as const,
      })),
    });
  }
}
