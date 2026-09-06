import type { Prisma } from "@repo/db";

import { forbidden } from "../../shared/errors.js";
import type { InternalPrincipal } from "../../shared/types.js";

function hasOrganizationWideOperationsAccess(
  actor: InternalPrincipal,
): boolean {
  return actor.roles.some((role) =>
    (["ADMIN", "SALES_MANAGER", "FINANCE", "OPERATIONS"] as const).includes(
      role as "ADMIN" | "SALES_MANAGER" | "FINANCE" | "OPERATIONS",
    ),
  );
}

export function orderVisibilityWhere(
  actor: InternalPrincipal,
): Prisma.OrderWhereInput {
  if (hasOrganizationWideOperationsAccess(actor)) return {};
  return {
    OR: [
      { ownerId: actor.userId },
      ...(actor.salesTeamIds.length === 0
        ? []
        : [{ quote: { salesTeamId: { in: actor.salesTeamIds } } }]),
    ],
  };
}

export function invoiceVisibilityWhere(
  actor: InternalPrincipal,
): Prisma.InvoiceWhereInput {
  if (hasOrganizationWideOperationsAccess(actor)) return {};
  return {
    OR: [
      { order: orderVisibilityWhere(actor) },
      {
        orderId: null,
        customerAccount: {
          OR: [
            { assignedRepId: actor.userId },
            { salesTeamId: { in: actor.salesTeamIds } },
          ],
        },
      },
    ],
  };
}

export function assertSalesObjectVisible(
  actor: InternalPrincipal,
  object: { ownerId: string; salesTeamId: string | null },
): void {
  if (hasOrganizationWideOperationsAccess(actor)) return;
  if (object.ownerId === actor.userId) return;
  if (
    object.salesTeamId !== null &&
    actor.salesTeamIds.includes(object.salesTeamId)
  )
    return;
  forbidden(
    "This order or quote is outside your ownership and sales-team scope",
  );
}
