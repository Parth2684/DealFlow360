import { isPastBillingDueDate } from "../../modules/billing/periods.js";
import {
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import type { ClaimedOutboxEvent } from "../job-events.js";
import { lockWorkerEntity } from "../locks.js";

export async function markInvoiceOverdue(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "invoice-due",
    event.aggregateId,
  );
  const invoice = await transaction.invoice.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    include: {
      organization: { select: { timezone: true } },
      order: { select: { quoteId: true } },
    },
  });
  if (invoice === null) return;
  if (
    !["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) ||
    !invoice.balanceDue.greaterThan(0)
  ) {
    return;
  }
  const now = new Date();
  if (
    !isPastBillingDueDate(invoice.dueDate, now, invoice.organization.timezone)
  ) {
    return;
  }

  const changed = await transaction.invoice.updateMany({
    where: {
      id: invoice.id,
      organizationId: event.organizationId,
      revision: invoice.revision,
      dueDate: invoice.dueDate,
      balanceDue: { gt: 0 },
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
    },
    data: { status: "OVERDUE", revision: { increment: 1 } },
  });
  if (changed.count !== 1) {
    throw new Error("The invoice changed while its due status was applied");
  }
  const customerChanged = await transaction.customerAccount.updateMany({
    where: {
      id: invoice.customerAccountId,
      organizationId: event.organizationId,
    },
    data: {
      overdueBalance: { increment: invoice.balanceDue },
      revision: { increment: 1 },
    },
  });
  if (customerChanged.count !== 1) {
    throw new Error(
      "The invoice customer no longer belongs to the organization",
    );
  }
  await recordActivity(transaction, {
    organizationId: event.organizationId,
    eventType: "invoice.due",
    entityType: "Invoice",
    entityId: invoice.id,
    entityVersion: invoice.revision + 1,
    quoteId: invoice.order?.quoteId,
    title: "Invoice overdue",
    metadata: {
      dueDate: invoice.dueDate,
      balanceDue: invoice.balanceDue.toString(),
      currency: invoice.currency,
      timezone: invoice.organization.timezone,
      scheduledEventId: event.id,
    },
  });
}
