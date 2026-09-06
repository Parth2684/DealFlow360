import { test, expect } from "bun:test";
import { prisma } from "@repo/db";
import { ROLE_CAPABILITIES } from "@repo/common";
import {
  createQuote,
  addQuoteLine,
} from "../src/modules/quotations/service.js";
import { submitQuote, sendQuote } from "../src/modules/quotations/workflow.js";
import { confirmOrderFromQuote } from "../src/modules/operations/order-confirmation.js";
import { buildRecommendedPreview } from "../src/modules/operations/allocation.js";
import {
  reservePreview,
  shipShipment,
} from "../src/modules/operations/fulfillment.js";
import { issueInvoice, recordPayment } from "../src/modules/billing/service.js";
import type { InternalPrincipal } from "../src/shared/types.js";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor: InternalPrincipal = {
  kind: "internal",
  organizationId: id(1),
  userId: id(10),
  sessionId: crypto.randomUUID(),
  sessionExpiresAt: new Date(Date.now() + 60_000),
  email: "admin@demo.dealflow360.local",
  firstName: "Demo",
  lastName: "Administrator",
  roles: ["ADMIN"],
  capabilities: [...ROLE_CAPABILITIES.ADMIN],
  salesTeamIds: [id(20)],
  csrfHash: "",
};

test("quotation → acceptance → order → stock reservation → shipment → invoice → payment", async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development database required");
  const rollback = new Error("ROLLBACK_SUCCESSFUL_WORKFLOW_TEST");
  try {
    await prisma.$transaction(
      async (tx) => {
        let quote = await createQuote(tx, actor, {
          customerAccountId: id(40),
          currency: "USD",
          paymentTermsDays: 30,
        });
        quote = await addQuoteLine(tx, actor, quote.id, {
          revision: quote.revision,
          productId: id(90),
          variantId: id(100),
          quantity: "1",
          discountPercent: "0",
          billingType: "ONE_TIME",
        });
        quote = await addQuoteLine(tx, actor, quote.id, {
          revision: quote.revision,
          productId: id(92),
          subscriptionPlanId: id(110),
          quantity: "1",
          discountPercent: "0",
          billingType: "RECURRING",
        });
        const submitted = await submitQuote(
          tx,
          actor,
          quote.id,
          quote.revision,
        );
        expect(submitted.autoApproved).toBe(true);
        quote = await sendQuote(tx, actor, quote.id, submitted.quote.revision);
        expect(quote.stage).toBe("SENT");
        await tx.customerAcceptance.create({
          data: {
            organizationId: id(1),
            quoteId: quote.id,
            quoteVersionId: quote.currentVersion.id,
            portalIdentityId: id(60),
            acceptedFingerprint: quote.currentVersion.termsFingerprint,
          },
        });
        await tx.quoteVersion.update({
          where: { id: quote.currentVersion.id },
          data: { status: "CUSTOMER_ACCEPTED" },
        });
        await tx.quote.update({
          where: { id: quote.id },
          data: { stage: "CUSTOMER_ACCEPTED" },
        });
        const confirmed = await confirmOrderFromQuote(
          tx,
          id(1),
          quote.id,
          quote.revision,
          actor,
        );
        expect(confirmed.order.status).toBe("ALLOCATION_PENDING");
        expect(
          await tx.subscription.count({
            where: { orderId: confirmed.order.id },
          }),
        ).toBe(1);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: confirmed.order.id },
          include: {
            lines: { include: { product: true }, orderBy: { position: "asc" } },
          },
        });
        const balances = await tx.inventoryBalance.findMany({
          where: { organizationId: id(1), productId: id(90) },
          include: { warehouse: true },
        });
        const preview = buildRecommendedPreview(order, balances);
        const reserved = await reservePreview(
          tx,
          id(1),
          order.id,
          preview.dto.id,
          preview.dto.revision,
          actor,
        );
        expect(reserved.reservations.length).toBeGreaterThan(0);
        const shipments = await tx.shipment.findMany({
          where: { orderId: order.id },
        });
        for (const shipment of shipments) {
          const shipped = await shipShipment(
            tx,
            id(1),
            shipment.id,
            "TEST-TRACKING",
            actor,
          );
          expect(shipped.status).toBe("SHIPPED");
        }
        const invoice = await tx.invoice.findFirstOrThrow({
          where: { orderId: order.id, type: "ONE_TIME" },
        });
        const issued = await issueInvoice(
          tx,
          id(1),
          invoice.id,
          invoice.revision,
          actor,
        );
        expect(issued.status).toBe("ISSUED");
        await recordPayment(
          tx,
          id(1),
          invoice.id,
          {
            amount: issued.balanceDue,
            method: "BANK_TRANSFER",
            paymentDate: new Date().toISOString(),
            reference: "TEST-RECEIPT",
          },
          actor,
        );
        const paid = await tx.invoice.findUniqueOrThrow({
          where: { id: invoice.id },
        });
        expect(paid.status).toBe("PAID");
        expect(paid.balanceDue.toString()).toBe("0");
        throw rollback;
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
