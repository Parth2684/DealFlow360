import { Prisma } from "../generated/prisma/client.js";
import { createHash } from "node:crypto";

const id = (sequence: number) =>
  `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
const organizationId = id(1);

/** Coherent, repeatable sales scenarios. Existing business records are never reset. */
export async function seedWorkflowScenarios(tx: Prisma.TransactionClient) {
  const products = await tx.product.findMany({
    where: { id: { in: [90, 91, 92].map(id) } },
    include: { variants: true },
  });
  const plan = await tx.subscriptionPlan.findUniqueOrThrow({
    where: { id: id(110) },
  });
  const now = new Date();
  const day = 86_400_000;
  const states = [
    "DRAFT",
    "READY_TO_SEND",
    "SENT",
    "UNDER_NEGOTIATION",
    "CUSTOMER_ACCEPTED",
    "CONFIRMED",
  ] as const;
  for (const [index, stage] of states.entries()) {
    const base = 300 + index * 30;
    const quoteId = id(base);
    if (
      await tx.quote.findUnique({
        where: { id: quoteId },
        select: { id: true },
      })
    )
      continue;
    const customerId = index === 3 ? id(41) : id(40);
    const portalId = index === 3 ? id(61) : id(60);
    const customer = await tx.customerAccount.findUniqueOrThrow({
      where: { id: customerId },
    });
    const versionId = id(base + 1);
    const createdAt = new Date(now.getTime() - (10 - index) * day);
    const lines = [90, 91, 92].map((productSequence, lineIndex) => {
      const product = products.find((item) => item.id === id(productSequence))!;
      const quantity = new Prisma.Decimal(productSequence === 90 ? 2 : 1);
      const price = new Prisma.Decimal(
        productSequence === 90 ? 10000 : productSequence === 91 ? 5000 : 1200,
      );
      const subtotal = quantity.mul(price);
      const tax = subtotal.mul("0.18");
      const cost = quantity.mul(product.standardCost);
      return {
        id: id(base + 2 + lineIndex),
        organizationId,
        quoteVersionId: versionId,
        productId: product.id,
        variantId: productSequence === 90 ? id(100) : null,
        lineNumber: lineIndex + 1,
        productCode: product.code,
        productName: product.name,
        productDescription: product.description,
        productType: product.type,
        categoryCode:
          productSequence === 90
            ? "HARDWARE"
            : productSequence === 91
              ? "SERVICE"
              : "SUBSCRIPTION",
        sku: productSequence === 90 ? "EDGE-SERVER-STD" : null,
        unit: product.unit,
        quantity,
        listUnitPrice: price,
        unitPrice: price,
        unitCost: product.standardCost,
        discountPercent: "0",
        lineDiscountAmount: "0",
        preTaxSubtotal: subtotal,
        taxCode: "STANDARD-18",
        taxRate: "18",
        taxBehavior: "EXCLUSIVE" as const,
        taxAmount: tax,
        total: subtotal.plus(tax),
        costTotal: cost,
        grossMargin: subtotal.minus(cost),
        billingType:
          productSequence === 92
            ? ("RECURRING" as const)
            : ("ONE_TIME" as const),
        subscriptionPlanId: productSequence === 92 ? plan.id : null,
        subscriptionSnapshot:
          productSequence === 92
            ? ({
                planCode: plan.code,
                planName: plan.name,
                interval: plan.interval,
                intervalCount: plan.intervalCount,
                prorationConvention: plan.prorationConvention,
                cancellationRules: plan.cancellationRules,
                refundRules: plan.refundRules,
              } as Prisma.InputJsonObject)
            : Prisma.JsonNull,
        pricingSnapshot: { source: "catalog", priceListCode: "DEMO-USD" },
        createdAt,
      };
    });
    const sum = (
      field:
        "preTaxSubtotal" | "taxAmount" | "total" | "costTotal" | "grossMargin",
    ) =>
      lines.reduce(
        (total, line) => total.plus(line[field]),
        new Prisma.Decimal(0),
      );
    const totals = {
      subtotal: sum("preTaxSubtotal"),
      taxTotal: sum("taxAmount"),
      total: sum("total"),
      costTotal: sum("costTotal"),
      grossMargin: sum("grossMargin"),
      marginPercent: sum("grossMargin")
        .div(sum("preTaxSubtotal"))
        .mul(100)
        .toDecimalPlaces(4),
    };
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          customerId,
          paymentTermsDays: 30,
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
          })),
        }),
      )
      .digest("hex");
    await tx.quote.create({
      data: {
        id: quoteId,
        organizationId,
        customerAccountId: customerId,
        ownerId: id(11),
        salesTeamId: id(20),
        quoteNumber: `Q-2026-${String(index + 2).padStart(4, "0")}`,
        stage,
        expiresAt: new Date(now.getTime() + 45 * day),
        createdAt,
      },
    });
    await tx.quoteVersion.create({
      data: {
        id: versionId,
        organizationId,
        quoteId,
        customerAccountId: customerId,
        createdById: id(11),
        revisionNumber: 1,
        status:
          stage === "DRAFT"
            ? "DRAFT"
            : ["CUSTOMER_ACCEPTED", "CONFIRMED"].includes(stage)
              ? "CUSTOMER_ACCEPTED"
              : "READY_TO_SEND",
        currency: "USD",
        paymentTermsDays: 30,
        customerSnapshot: {
          name: customer.name,
          accountCode: customer.accountCode,
        },
        pricingSnapshot: { priceListCode: "DEMO-USD" },
        ...totals,
        termsFingerprint: fingerprint,
        notes: [
          "Branch office expansion",
          "Network refresh proposal",
          "New office deployment",
          "Service renewal discussion",
          "Approved expansion order",
          "Head office hardware and support",
        ][index],
        createdAt,
      },
    });
    await tx.quoteLine.createMany({ data: lines });
    await tx.quote.update({
      where: { id: quoteId },
      data: { currentVersionId: versionId },
    });
    if (
      ["SENT", "UNDER_NEGOTIATION", "CUSTOMER_ACCEPTED", "CONFIRMED"].includes(
        stage,
      )
    ) {
      await tx.negotiationThread.create({
        data: {
          id: id(base + 5),
          organizationId,
          quoteId,
          customerAccountId: customerId,
        },
      });
      await tx.dealEvent.create({
        data: {
          organizationId,
          quoteId,
          eventType: "quote.sent",
          title: "Quotation shared with customer",
          actorType: "USER",
          actorId: id(11),
          visibility: "BOTH",
          sourceEntityType: "Quote",
          sourceEntityId: quoteId,
          sourceVersion: 1,
          occurredAt: createdAt,
        },
      });
    }
    if (stage === "UNDER_NEGOTIATION") {
      await tx.changeRequest.create({
        data: {
          id: id(base + 6),
          organizationId,
          threadId: id(base + 5),
          sourceQuoteVersionId: versionId,
          sourceTermsFingerprint: fingerprint,
          requestedByPortalId: portalId,
          message:
            "Can you offer a 5% discount on the servers for our renewal?",
          items: {
            create: {
              organizationId,
              quoteLineId: lines[0]!.id,
              action: "CHANGE_DISCOUNT",
              requestedDiscountPercent: "5",
            },
          },
        },
      });
    }
    if (["CUSTOMER_ACCEPTED", "CONFIRMED"].includes(stage)) {
      await tx.customerAcceptance.create({
        data: {
          organizationId,
          quoteId,
          quoteVersionId: versionId,
          portalIdentityId: portalId,
          acceptedFingerprint: fingerprint,
        },
      });
    }
    if (stage !== "CONFIRMED") continue;
    const orderId = id(base + 7);
    await tx.order.create({
      data: {
        id: orderId,
        organizationId,
        quoteId,
        quoteVersionId: versionId,
        customerAccountId: customerId,
        ownerId: id(11),
        confirmedById: id(11),
        orderNumber: "ORD-2026-0001",
        status: "ALLOCATION_PENDING",
        termsFingerprint: fingerprint,
        customerName: customer.name,
        currency: "USD",
        timezone: "UTC",
        paymentTermsDays: 30,
        ...totals,
      },
    });
    for (const [lineIndex, line] of lines.entries()) {
      await tx.orderLine.create({
        data: {
          id: id(base + 8 + lineIndex),
          organizationId,
          orderId,
          quoteLineId: line.id,
          productId: line.productId,
          variantId: line.variantId,
          subscriptionPlanId: line.subscriptionPlanId,
          position: line.lineNumber,
          productCode: line.productCode,
          productName: line.productName,
          sku: line.sku,
          unit: line.unit,
          billingType: line.billingType,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          discountPercent: "0",
          discountAmount: "0",
          taxRate: "18",
          taxBehavior: "EXCLUSIVE",
          taxAmount: line.taxAmount,
          total: line.total,
          costTotal: line.costTotal,
          subscriptionSnapshot: line.subscriptionSnapshot,
          taxCode: line.taxCode,
          subtotal: line.preTaxSubtotal,
        },
      });
    }
    const invoiceId = id(base + 11);
    await tx.invoice.create({
      data: {
        id: invoiceId,
        organizationId,
        orderId,
        customerAccountId: customerId,
        invoiceNumber: "INV-2026-0003",
        type: "ONE_TIME",
        status: "DRAFT",
        currency: "USD",
        dueDate: new Date(now.getTime() + 30 * day),
        subtotal: "25000",
        taxAmount: "4500",
        total: "29500",
        balanceDue: "29500",
      },
    });
    await tx.invoiceLine.createMany({
      data: lines
        .slice(0, 2)
        .map((line, lineIndex) => ({
          organizationId,
          invoiceId,
          orderLineId: id(base + 8 + lineIndex),
          position: line.lineNumber,
          description: line.productName,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          billingType: line.billingType,
          taxSnapshot: { rate: "18", behavior: "EXCLUSIVE" },
          taxAmount: line.taxAmount,
          subtotal: line.preTaxSubtotal,
          total: line.total,
        })),
    });
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const subscriptionId = id(base + 12);
    await tx.subscription.create({
      data: {
        id: subscriptionId,
        organizationId,
        orderId,
        customerAccountId: customerId,
        subscriptionPlanId: plan.id,
        subscriptionNumber: "SUB-2026-0001",
        status: "ACTIVE",
        currency: "USD",
        timezone: "UTC",
        startedAt: periodStart,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
        planSnapshot: lines[2]!.subscriptionSnapshot as Prisma.InputJsonObject,
      },
    });
    await tx.subscriptionItem.create({
      data: {
        organizationId,
        subscriptionId,
        orderLineId: id(base + 10),
        productId: id(92),
        subscriptionPlanId: plan.id,
        productName: lines[2]!.productName,
        unit: lines[2]!.unit,
        quantity: "1",
        unitPrice: "1200",
        activeFrom: periodStart,
      },
    });
    await tx.billingSchedule.create({
      data: {
        organizationId,
        subscriptionId,
        periodStart,
        periodEnd,
        dueDate: periodEnd,
        currency: "USD",
        amount: "1200",
        generationStatus: "PENDING",
      },
    });
  }
}
