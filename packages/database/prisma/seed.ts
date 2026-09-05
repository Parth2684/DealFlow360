import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/client.js";
import { createHash } from "crypto";

const DEMO_ORG_SLUG = "dealflow360-demo";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function seedDemoOrganization() {
  const password = await hashPassword("demo1234");

  const org = await prisma.organization.upsert({
    where: { id: DEMO_ORG_SLUG },
    update: {},
    create: {
      id: DEMO_ORG_SLUG,
      name: "DealFlow360 Demo Corp",
      baseCurrency: "USD",
      timezone: "America/New_York",
      settings: { demoMode: true },
    },
  });

  const salesTeam = await prisma.salesTeam.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Enterprise Sales" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Enterprise Sales",
    },
  });

  const users = {
    admin: await upsertUser(org.id, "admin@demo.dealflow360.dev", password, "Alex", "Admin"),
    rep: await upsertUser(org.id, "rep@demo.dealflow360.dev", password, "Sam", "Representative"),
    manager: await upsertUser(org.id, "manager@demo.dealflow360.dev", password, "Morgan", "Manager"),
    finance: await upsertUser(org.id, "finance@demo.dealflow360.dev", password, "Finley", "Finance"),
    operations: await upsertUser(org.id, "ops@demo.dealflow360.dev", password, "Oliver", "Operations"),
  };

  await prisma.salesTeam.update({
    where: { id: salesTeam.id },
    data: { managerId: users.manager.id },
  });

  await upsertRole(org.id, users.admin.id, "ADMIN");
  await upsertRole(org.id, users.rep.id, "SALES_REP", salesTeam.id);
  await upsertRole(org.id, users.manager.id, "SALES_MANAGER", salesTeam.id);
  await upsertRole(org.id, users.finance.id, "FINANCE");
  await upsertRole(org.id, users.operations.id, "OPERATIONS");

  const tiers = {
    bronze: await upsertTier(org.id, "Bronze", "BRONZE", 1),
    silver: await upsertTier(org.id, "Silver", "SILVER", 2),
    gold: await upsertTier(org.id, "Gold", "GOLD", 3),
  };

  const tax = await prisma.tax.create({
    data: {
      organizationId: org.id,
      name: "Standard Sales Tax",
      rate: 8.25,
      behavior: "EXCLUSIVE",
      effectiveFrom: new Date("2024-01-01"),
    },
  });

  const categories = {
    hardware: await upsertCategory(org.id, "Hardware", "HW"),
    service: await upsertCategory(org.id, "Professional Services", "SVC"),
    subscription: await upsertCategory(org.id, "Subscriptions", "SUB"),
  };

  const products = {
    server: await upsertProduct(org.id, categories.hardware.id, tax.id, {
      code: "SRV-PRO-001",
      name: "Enterprise Server Pro",
      type: "HARDWARE",
      standardCost: 4500,
      unit: "each",
    }),
    setup: await upsertProduct(org.id, categories.service.id, tax.id, {
      code: "SVC-SETUP-001",
      name: "Enterprise Setup & Configuration",
      type: "SERVICE",
      standardCost: 800,
      unit: "hour",
    }),
    support: await upsertProduct(org.id, categories.subscription.id, tax.id, {
      code: "SUB-SUPPORT-001",
      name: "Premium Support Plan",
      type: "SUBSCRIPTION",
      standardCost: 50,
      unit: "month",
    }),
    upsellMonitor: await upsertProduct(org.id, categories.hardware.id, tax.id, {
      code: "HW-MON-001",
      name: "Network Monitoring Appliance",
      type: "HARDWARE",
      standardCost: 1200,
      unit: "each",
    }),
    upsellTraining: await upsertProduct(org.id, categories.service.id, tax.id, {
      code: "SVC-TRAIN-001",
      name: "Advanced Admin Training",
      type: "SERVICE",
      standardCost: 400,
      unit: "session",
    }),
  };

  const variants = {
    server: await upsertVariant(org.id, products.server.id, "SRV-PRO-001-STD", "Standard Config"),
    monitor: await upsertVariant(org.id, products.upsellMonitor.id, "HW-MON-001-STD", "Standard"),
  };

  const supportPlan = await prisma.subscriptionPlan.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "SUPPORT-MONTHLY" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Monthly Premium Support",
      code: "SUPPORT-MONTHLY",
      interval: "MONTH",
      intervalCount: 1,
      prorationConvention: "CALENDAR_DAYS",
    },
  });

  const priceList = await prisma.priceList.create({
    data: {
      organizationId: org.id,
      name: "Standard USD Price List",
      currency: "USD",
      effectiveFrom: new Date("2024-01-01"),
      priority: 1,
      priceRules: {
        create: [
          { organizationId: org.id, productId: products.server.id, unitPrice: 7500, minQuantity: 1, effectiveFrom: new Date("2024-01-01") },
          { organizationId: org.id, productId: products.setup.id, unitPrice: 150, minQuantity: 1, effectiveFrom: new Date("2024-01-01") },
          { organizationId: org.id, productId: products.support.id, unitPrice: 299, minQuantity: 1, effectiveFrom: new Date("2024-01-01") },
          { organizationId: org.id, productId: products.upsellMonitor.id, unitPrice: 2499, minQuantity: 1, effectiveFrom: new Date("2024-01-01") },
          { organizationId: org.id, productId: products.upsellTraining.id, unitPrice: 2500, minQuantity: 1, effectiveFrom: new Date("2024-01-01") },
          { organizationId: org.id, tierId: tiers.gold.id, productId: products.server.id, unitPrice: 7200, minQuantity: 1, effectiveFrom: new Date("2024-01-01"), priority: 10 },
        ],
      },
    },
  });

  await prisma.discountLimit.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Gold Hardware Ceiling",
        tierId: tiers.gold.id,
        categoryId: categories.hardware.id,
        maxDiscountPct: 15,
        priority: 10,
        effectiveFrom: new Date("2024-01-01"),
      },
      {
        organizationId: org.id,
        name: "Gold Service Ceiling",
        tierId: tiers.gold.id,
        categoryId: categories.service.id,
        maxDiscountPct: 10,
        priority: 10,
        effectiveFrom: new Date("2024-01-01"),
      },
      {
        organizationId: org.id,
        name: "Gold Subscription Ceiling",
        tierId: tiers.gold.id,
        categoryId: categories.subscription.id,
        maxDiscountPct: 5,
        priority: 10,
        effectiveFrom: new Date("2024-01-01"),
      },
    ],
  });

  const approvalPolicy = await prisma.approvalPolicy.create({
    data: {
      organizationId: org.id,
      name: "Standard Discount Governance",
      version: 1,
      status: "ACTIVE",
      priority: 1,
      effectiveFrom: new Date("2024-01-01"),
      predicates: {
        managerApproval: { blendedExcessGte: 1.5, anyLineExceedsCeiling: true },
        financeApproval: {
          maxLineExcessGte: 8,
          blendedExcessGte: 4,
          marginPercentLt: 25,
          creditExposureGt: 0.8,
        },
      },
      stepTemplates: {
        create: [
          { organizationId: org.id, sequence: 1, requiredCapability: "approval.managerAct", roleHint: "SALES_MANAGER", slaHours: 24 },
          { organizationId: org.id, sequence: 2, requiredCapability: "approval.financeAct", roleHint: "FINANCE", slaHours: 48 },
        ],
      },
    },
  });

  const warehouses = {
    east: await upsertWarehouse(org.id, "East Coast DC", "WH-EAST", { city: "Newark", state: "NJ" }, 1.0, 2),
    west: await upsertWarehouse(org.id, "West Coast DC", "WH-WEST", { city: "Portland", state: "OR" }, 1.2, 3),
  };

  await seedInventory(org.id, warehouses.east.id, products.server.id, variants.server.id, 3, 2);
  await seedInventory(org.id, warehouses.west.id, products.server.id, variants.server.id, 4, 0);
  await seedInventory(org.id, warehouses.east.id, products.upsellMonitor.id, variants.monitor.id, 10, 0);
  await seedInventory(org.id, warehouses.west.id, products.upsellMonitor.id, variants.monitor.id, 5, 0);

  await prisma.promotion.create({
    data: {
      organizationId: org.id,
      name: "Q1 Monitoring Bundle",
      code: "Q1-MON-BUNDLE",
      boostScore: 0.8,
      effectiveFrom: new Date("2024-01-01"),
      effectiveTo: new Date("2026-12-31"),
    },
  });

  await prisma.productAffinity.create({
    data: {
      organizationId: org.id,
      sourceProductId: products.server.id,
      targetProductId: products.upsellMonitor.id,
      affinityScore: 0.85,
    },
  });

  await prisma.recommendationRule.create({
    data: {
      organizationId: org.id,
      name: "Default Upsell Weights",
      weights: { affinity: 0.4, margin: 0.25, promotion: 0.2, availability: 0.15 },
      marginFloor: 20,
    },
  });

  const customerSafe = await upsertCustomer(org.id, tiers.gold.id, salesTeam.id, users.rep.id, {
    name: "Acme Industries (Gold)",
    creditLimit: 500000,
    currentExposure: 125000,
    overdueBalance: 0,
  });

  const customerRisky = await upsertCustomer(org.id, tiers.gold.id, salesTeam.id, users.rep.id, {
    name: "Beta Corp (Overdue)",
    creditLimit: 100000,
    currentExposure: 95000,
    overdueBalance: 45000,
  });

  const contactSafe = await prisma.customerContact.create({
    data: {
      organizationId: org.id,
      customerAccountId: customerSafe.id,
      email: "buyer@acme-industries.demo",
      firstName: "Jordan",
      lastName: "Buyer",
      isPrimary: true,
      portalEnabled: true,
    },
  });

  await prisma.portalIdentity.create({
    data: {
      organizationId: org.id,
      customerContactId: contactSafe.id,
      email: contactSafe.email,
    },
  });

  const quote = await prisma.quote.create({
    data: {
      organizationId: org.id,
      customerAccountId: customerSafe.id,
      ownerId: users.rep.id,
      quoteNumber: "Q-2026-0001",
      stage: "DRAFT",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const version = await prisma.quoteVersion.create({
    data: {
      organizationId: org.id,
      quoteId: quote.id,
      revisionNumber: 1,
      status: "DRAFT",
      currency: "USD",
      paymentTermsDays: 30,
      termsFingerprint: fingerprint([quote.id, "1"]),
      lines: {
        create: [
          buildQuoteLine(org.id, products.server, variants.server, 1, 5, 12, "ONE_TIME"),
          buildQuoteLine(org.id, products.setup, null, 2, 40, 18, "ONE_TIME"),
          buildQuoteLine(org.id, products.support, null, 3, 1, 0, "RECURRING", supportPlan.id),
        ],
      },
    },
    include: { lines: true },
  });

  await prisma.quote.update({
    where: { id: quote.id },
    data: { currentVersionId: version.id },
  });

  await prisma.dealEvent.createMany({
    data: [
      {
        organizationId: org.id,
        quoteId: quote.id,
        eventType: "quote.created",
        title: "Quotation created",
        description: "Demo quotation seeded for hackathon golden path",
        visibility: "INTERNAL",
        actorId: users.rep.id,
      },
      {
        organizationId: org.id,
        quoteId: quote.id,
        eventType: "quote.linesAdded",
        title: "Lines added",
        description: "Hardware, service, and subscription lines configured",
        visibility: "BOTH",
        actorId: users.rep.id,
      },
    ],
  });

  console.log("✅ Demo organization seeded:", org.name);
  console.log("   Users (password: demo1234):");
  console.log("   - admin@demo.dealflow360.dev");
  console.log("   - rep@demo.dealflow360.dev");
  console.log("   - manager@demo.dealflow360.dev");
  console.log("   - finance@demo.dealflow360.dev");
  console.log("   - ops@demo.dealflow360.dev");
  console.log("   Demo quote:", quote.quoteNumber, "(", quote.id, ")");
  console.log("   Price list:", priceList.name);
  console.log("   Approval policy:", approvalPolicy.name);
  console.log("   Risky customer:", customerRisky.name);

  return { org, quote, users, customerSafe, customerRisky };
}

async function upsertUser(
  organizationId: string,
  email: string,
  passwordHash: string,
  firstName: string,
  lastName: string,
) {
  return prisma.user.upsert({
    where: { organizationId_email: { organizationId, email } },
    update: { passwordHash, firstName, lastName },
    create: { organizationId, email, passwordHash, firstName, lastName },
  });
}

async function upsertRole(
  organizationId: string,
  userId: string,
  role: "ADMIN" | "SALES_REP" | "SALES_MANAGER" | "FINANCE" | "OPERATIONS",
  salesTeamId?: string,
) {
  const existing = await prisma.roleAssignment.findFirst({
    where: { organizationId, userId, role },
  });
  if (existing) return existing;
  return prisma.roleAssignment.create({
    data: { organizationId, userId, role, salesTeamId },
  });
}

async function upsertTier(
  organizationId: string,
  name: string,
  code: string,
  priority: number,
) {
  return prisma.customerTier.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: { name, priority },
    create: { organizationId, name, code, priority },
  });
}

async function upsertCategory(organizationId: string, name: string, code: string) {
  return prisma.productCategory.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: { name },
    create: { organizationId, name, code },
  });
}

async function upsertProduct(
  organizationId: string,
  categoryId: string,
  taxId: string,
  data: { code: string; name: string; type: "HARDWARE" | "SERVICE" | "SUBSCRIPTION"; standardCost: number; unit: string },
) {
  return prisma.product.upsert({
    where: { organizationId_code: { organizationId, code: data.code } },
    update: { name: data.name, standardCost: data.standardCost },
    create: {
      organizationId,
      categoryId,
      taxId,
      ...data,
    },
  });
}

async function upsertVariant(
  organizationId: string,
  productId: string,
  sku: string,
  name: string,
) {
  return prisma.productVariant.upsert({
    where: { organizationId_sku: { organizationId, sku } },
    update: { name },
    create: { organizationId, productId, sku, name },
  });
}

async function upsertWarehouse(
  organizationId: string,
  name: string,
  code: string,
  address: Record<string, string>,
  shippingCostWeight: number,
  leadTimeDays: number,
) {
  return prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: { name, address, shippingCostWeight, leadTimeDays },
    create: { organizationId, name, code, address, shippingCostWeight, leadTimeDays },
  });
}

async function seedInventory(
  organizationId: string,
  warehouseId: string,
  productId: string,
  variantId: string,
  onHand: number,
  reserved: number,
) {
  const available = onHand - reserved;
  await prisma.inventoryBalance.upsert({
    where: { warehouseId_productId_variantId: { warehouseId, productId, variantId } },
    update: { onHand, reserved, available },
    create: { organizationId, warehouseId, productId, variantId, onHand, reserved, available },
  });
}

async function upsertCustomer(
  organizationId: string,
  tierId: string,
  salesTeamId: string,
  assignedRepId: string,
  data: { name: string; creditLimit: number; currentExposure: number; overdueBalance: number },
) {
  const existing = await prisma.customerAccount.findFirst({
    where: { organizationId, name: data.name },
  });
  if (existing) {
    return prisma.customerAccount.update({ where: { id: existing.id }, data });
  }
  return prisma.customerAccount.create({
    data: {
      organizationId,
      tierId,
      salesTeamId,
      assignedRepId,
      preferredCurrency: "USD",
      paymentTermsDays: 30,
      ...data,
    },
  });
}

function buildQuoteLine(
  organizationId: string,
  product: { id: string; name: string; type: "HARDWARE" | "SERVICE" | "SUBSCRIPTION"; standardCost: unknown },
  variant: { id: string; sku: string } | null,
  lineNumber: number,
  quantity: number,
  discountPercent: number,
  billingType: "ONE_TIME" | "RECURRING",
  subscriptionPlanId?: string,
) {
  const unitPrices: Record<string, number> = {
    "SRV-PRO-001": 7200,
    "SVC-SETUP-001": 150,
    "SUB-SUPPORT-001": 299,
  };
  const productCode = product.name.includes("Server") ? "SRV-PRO-001" : product.name.includes("Setup") ? "SVC-SETUP-001" : "SUB-SUPPORT-001";
  const unitPrice = unitPrices[productCode] ?? 100;
  const discountAmount = (unitPrice * quantity * discountPercent) / 100;
  const lineSubtotal = unitPrice * quantity - discountAmount;
  const taxAmount = lineSubtotal * 0.0825;
  const lineTotal = lineSubtotal + taxAmount;

  return {
    organizationId,
    productId: product.id,
    variantId: variant?.id,
    lineNumber,
    productName: product.name,
    productType: product.type,
    sku: variant?.sku ?? null,
    quantity,
    unitPrice,
    unitCost: Number(product.standardCost),
    discountPercent,
    discountAmount,
    taxRate: 8.25,
    taxAmount,
    lineTotal,
    billingType,
    subscriptionPlanId,
  };
}

async function main() {
  await seedDemoOrganization();
}

if (import.meta.main) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
