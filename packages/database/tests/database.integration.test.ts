import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { prisma } from "../src/client.js";
import {
  DEFAULT_DATABASE_SCHEMA,
  getDatabaseSettings,
} from "../src/database-url.js";
import { DEMO_ORGANIZATION_ID, seedDemo } from "../prisma/seed.js";

const databaseSettings = getDatabaseSettings();

beforeAll(async () => {
  const { schema } = databaseSettings;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Database integration tests are disabled when NODE_ENV=production.",
    );
  }

  const isVerificationSchema = schema.startsWith(
    `${DEFAULT_DATABASE_SCHEMA}_verify_`,
  );

  if (schema !== DEFAULT_DATABASE_SCHEMA && !isVerificationSchema) {
    throw new Error(
      `Database integration tests only run in ${DEFAULT_DATABASE_SCHEMA} or its disposable verification schemas.`,
    );
  }

  await prisma.$transaction((tx) => seedDemo(tx), {
    maxWait: 10_000,
    timeout: 60_000,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("DealFlow360 PostgreSQL foundation", () => {
  test("loads the deterministic mixed-line quotation and approval route", async () => {
    const quote = await prisma.quote.findUniqueOrThrow({
      where: {
        organizationId_quoteNumber: {
          organizationId: DEMO_ORGANIZATION_ID,
          quoteNumber: "Q-2026-0001",
        },
      },
      include: {
        currentVersion: {
          include: {
            approvalRequests: {
              include: { steps: { orderBy: { sequence: "asc" } } },
            },
            lines: { orderBy: { lineNumber: "asc" } },
            riskAssessment: true,
          },
        },
      },
    });

    expect(quote.currentVersion?.lines).toHaveLength(3);
    expect(quote.currentVersion?.total.toFixed(4)).toBe("130862.0000");
    expect(quote.currentVersion?.grossMargin.toFixed(4)).toBe("24450.0000");
    expect(
      quote.currentVersion?.riskAssessment?.maximumLineExcess.toFixed(4),
    ).toBe("8.0000");
    expect(
      quote.currentVersion?.approvalRequests[0]?.steps.map(
        (step) => step.sequence,
      ),
    ).toEqual([1, 2]);
  });

  test("contains the required roles, customer credit cases, and split-warehouse inventory", async () => {
    const [roleCount, customers, hardwareStock, hardwareLine] =
      await Promise.all([
        prisma.roleAssignment.count({
          where: {
            id: { in: [21, 22, 23, 24, 25, 26].map(demoId) },
            organizationId: DEMO_ORGANIZATION_ID,
          },
        }),
        prisma.customerAccount.findMany({
          where: {
            id: { in: [demoId(40), demoId(41)] },
            organizationId: DEMO_ORGANIZATION_ID,
          },
          orderBy: { accountCode: "asc" },
        }),
        prisma.inventoryBalance.aggregate({
          where: {
            id: { in: [demoId(170), demoId(171)] },
            organizationId: DEMO_ORGANIZATION_ID,
          },
          _sum: { available: true },
        }),
        prisma.quoteLine.findUniqueOrThrow({
          where: { id: demoId(192) },
        }),
      ]);

    expect(roleCount).toBe(6);
    expect(customers).toHaveLength(2);
    expect(
      customers.some((customer) => customer.overdueBalance.greaterThan(0)),
    ).toBe(true);
    expect(
      customers.some((customer) => customer.overdueBalance.equals(0)),
    ).toBe(true);
    expect(hardwareStock._sum.available?.toFixed(4)).toBe("11.0000");
    expect(
      hardwareLine.quantity.minus(hardwareStock._sum.available ?? 0).toFixed(4),
    ).toBe("1.0000");
  });

  test("rejects a duplicate organization-wide role assignment with a null team", async () => {
    const duplicateAssignment = (async () => {
      await prisma.roleAssignment.create({
        data: {
          organizationId: DEMO_ORGANIZATION_ID,
          userId: demoId(10),
          role: "ADMIN",
          salesTeamId: null,
        },
      });
    })();

    await expect(duplicateAssignment).rejects.toBeDefined();
  });

  test("rejects an inventory balance whose available amount is inconsistent", async () => {
    const inconsistentBalance = (async () => {
      await prisma.inventoryBalance.create({
        data: {
          organizationId: DEMO_ORGANIZATION_ID,
          warehouseId: demoId(160),
          productId: demoId(90),
          variantId: null,
          onHand: "5",
          reserved: "1",
          available: "5",
          incoming: "0",
        },
      });
    })();

    await expect(inconsistentBalance).rejects.toBeDefined();
  });

  test("prevents a quote from selecting another quote's version", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const otherQuote = await tx.quote.create({
          data: {
            organizationId: DEMO_ORGANIZATION_ID,
            customerAccountId: demoId(40),
            ownerId: demoId(11),
            quoteNumber: `Q-CONSTRAINT-${crypto.randomUUID()}`,
          },
        });

        await tx.quote.update({
          where: { id: otherQuote.id },
          data: { currentVersionId: demoId(191) },
        });
      }),
    ).rejects.toBeDefined();
  });

  test("keeps email-only login identities globally unique", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const otherOrganization = await tx.organization.create({
          data: {
            name: "Constraint test organization",
            slug: `constraint-${crypto.randomUUID()}`,
          },
        });

        await tx.user.create({
          data: {
            organizationId: otherOrganization.id,
            email: "admin@demo.dealflow360.local",
            firstName: "Duplicate",
            lastName: "Identity",
          },
        });
      }),
    ).rejects.toBeDefined();
  });

  test("limits recurring-period uniqueness to recurring invoices", async () => {
    const [{ definition } = { definition: "" }] = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_indexdef(index_class.oid) AS definition
      FROM pg_class AS index_class
      JOIN pg_namespace AS namespace
        ON namespace.oid = index_class.relnamespace
      WHERE index_class.relname = 'invoices_recurring_period_key'
        AND namespace.nspname = ${databaseSettings.schema}
    `;

    expect(normalizeSqlDefinition(definition)).toContain("type = 'RECURRING'");
  });

  test("supports terminal backorders with no remaining quantity", async () => {
    const [{ definition } = { definition: "" }] = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_constraintdef(constraint_row.oid) AS definition
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS table_class
        ON table_class.oid = constraint_row.conrelid
      JOIN pg_namespace AS namespace
        ON namespace.oid = table_class.relnamespace
      WHERE constraint_row.conname = 'backorders_quantity_check'
        AND table_class.relname = 'backorders'
        AND namespace.nspname = ${databaseSettings.schema}
    `;

    const normalizedDefinition = normalizeSqlDefinition(definition);

    expect(normalizedDefinition).toContain("remaining_quantity >= 0");
    expect(normalizedDefinition).toContain("remaining_quantity = 0");
  });
});

function demoId(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

function normalizeSqlDefinition(definition: string): string {
  return definition
    .replaceAll('"', "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replace(/::[A-Za-z_][A-Za-z0-9_]*/g, "")
    .replace(/\s+/g, " ");
}
