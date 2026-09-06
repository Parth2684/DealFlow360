import type { Prisma } from "../generated/prisma/client.js";
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  ApprovalDecisionAction,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  BackorderStatus,
  BillingInterval,
  BillingScheduleStatus,
  BillingType,
  ChangeRequestAction,
  ChangeRequestStatus,
  ConfigurationStatus,
  CounterofferStatus,
  CreditNoteStatus,
  ExportFormat,
  ExportJobStatus,
  FulfillmentPlanSource,
  FulfillmentPlanStatus,
  IdempotencyStatus,
  InvoiceStatus,
  InvoiceType,
  MagicLinkScope,
  NegotiationThreadStatus,
  NotificationChannel,
  NotificationStatus,
  NudgeChannel,
  NudgeStatus,
  OrderStatus,
  OutboxEventStatus,
  PaymentMethod,
  PaymentStatus,
  PortalIdentityStatus,
  ProductType,
  ProrationConvention,
  ProrationDirection,
  QuoteStage,
  QuoteVersionStatus,
  RecommendationInteractionType,
  ReportType,
  Role,
  ShipmentStatus,
  StockMovementType,
  StockReservationStatus,
  SubscriptionChangeStatus,
  SubscriptionChangeType,
  SubscriptionStatus,
  TaxBehavior,
  UserStatus,
  Visibility,
  ActorType,
} from "../generated/prisma/client.js";
import { prisma } from "../src/client.js";
import { seedWorkflowScenarios } from "./scenarios.js";
import {
  DEFAULT_DATABASE_SCHEMA,
  getDatabaseSettings,
} from "../src/database-url.js";

export const DEMO_ORGANIZATION_ID = demoId(1);

const ids = {
  organization: DEMO_ORGANIZATION_ID,
  userAdmin: demoId(10),
  userRepresentative: demoId(11),
  userManager: demoId(12),
  userFinance: demoId(13),
  userOperations: demoId(14),
  userCustomer: demoId(15),
  salesTeam: demoId(20),
  tierBronze: demoId(30),
  tierSilver: demoId(31),
  tierGold: demoId(32),
  customerSafe: demoId(40),
  customerOverdue: demoId(41),
  contactSafe: demoId(50),
  contactOverdue: demoId(51),
  portalSafe: demoId(60),
  portalOverdue: demoId(61),
  categoryHardware: demoId(70),
  categoryService: demoId(71),
  categorySubscription: demoId(72),
  taxStandard: demoId(80),
  productHardware: demoId(90),
  productSetup: demoId(91),
  productSupport: demoId(92),
  productBackup: demoId(93),
  productMonitoring: demoId(94),
  variantHardware: demoId(100),
  variantBackup: demoId(101),
  subscriptionPlan: demoId(110),
  priceList: demoId(120),
  priceRuleHardware: demoId(121),
  priceRuleSetup: demoId(122),
  priceRuleSupport: demoId(123),
  priceRuleBackup: demoId(124),
  priceRuleMonitoring: demoId(125),
  discountHardware: demoId(130),
  discountService: demoId(131),
  promotion: demoId(140),
  promotionProduct: demoId(141),
  recommendationRule: demoId(150),
  affinity: demoId(151),
  warehouseEast: demoId(160),
  warehouseWest: demoId(161),
  balanceHardwareEast: demoId(170),
  balanceHardwareWest: demoId(171),
  balanceBackupEast: demoId(172),
  movementHardwareEast: demoId(180),
  movementHardwareWest: demoId(181),
  movementBackupEast: demoId(182),
  quote: demoId(190),
  quoteVersion: demoId(191),
  quoteLineHardware: demoId(192),
  quoteLineSetup: demoId(193),
  quoteLineSupport: demoId(194),
  riskAssessment: demoId(195),
  riskFactHardware: demoId(196),
  riskFactSetup: demoId(197),
  riskFactSupport: demoId(198),
  riskLimitHardware: demoId(199),
  riskLimitSetup: demoId(200),
  approvalPolicy: demoId(201),
  approvalTemplateManager: demoId(202),
  approvalTemplateFinance: demoId(203),
  approvalRequest: demoId(204),
  approvalPolicyMatch: demoId(205),
  approvalStepManager: demoId(206),
  approvalStepFinance: demoId(207),
  healthSnapshot: demoId(210),
  alertStalled: demoId(211),
  alertAnomaly: demoId(212),
  dealEventCreated: demoId(213),
  dealEventDiscount: demoId(214),
  overdueInvoice: demoId(220),
  overdueInvoiceLine: demoId(221),
  latePaidInvoice: demoId(222),
  latePaidInvoiceLine: demoId(223),
  latePayment: demoId(224),
  savedFilter: demoId(230),
} as const;

const effectiveFrom = new Date("2026-01-01T00:00:00.000Z");
const quoteCreatedAt = new Date("2026-08-01T09:00:00.000Z");
const quoteUpdatedAt = new Date("2026-08-05T11:30:00.000Z");
const termsFingerprint = "a".repeat(64);
const MIN_DEMO_PASSWORD_LENGTH = 12;
const MAX_DEMO_PASSWORD_LENGTH = 128;

function demoId(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

export async function seedDemo(tx: Prisma.TransactionClient): Promise<void> {
  const passwordHash = await getDemoPasswordHash();

  await tx.organization.upsert({
    where: { id: ids.organization },
    update: {
      baseCurrency: "USD",
      name: "DealFlow360 Demo Organization",
      settings: { demo: true, locale: "en-US" },
      slug: "dealflow360-demo",
      timezone: "UTC",
    },
    create: {
      id: ids.organization,
      baseCurrency: "USD",
      name: "DealFlow360 Demo Organization",
      settings: { demo: true, locale: "en-US" },
      slug: "dealflow360-demo",
      timezone: "UTC",
    },
  });

  const users = [
    demoUser(
      ids.userAdmin,
      "admin@demo.dealflow360.local",
      "Ada",
      "Admin",
      passwordHash,
    ),
    demoUser(
      ids.userRepresentative,
      "representative@demo.dealflow360.local",
      "Ravi",
      "Representative",
      passwordHash,
    ),
    demoUser(
      ids.userManager,
      "manager@demo.dealflow360.local",
      "Maya",
      "Manager",
      passwordHash,
    ),
    demoUser(
      ids.userFinance,
      "finance@demo.dealflow360.local",
      "Farah",
      "Finance",
      passwordHash,
    ),
    demoUser(
      ids.userOperations,
      "operations@demo.dealflow360.local",
      "Owen",
      "Operations",
      passwordHash,
    ),
    demoUser(
      ids.userCustomer,
      "customer@demo.dealflow360.local",
      "Casey",
      "Customer",
      passwordHash,
    ),
  ];

  for (const user of users) {
    const { id, ...data } = user;

    await tx.user.upsert({
      where: { id },
      update: {
        ...data,
        ...(passwordHash === null ? { passwordHash: undefined } : {}),
      },
      create: user,
    });
  }

  await tx.salesTeam.upsert({
    where: { id: ids.salesTeam },
    update: {
      managerId: ids.userManager,
      name: "Enterprise Sales",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      id: ids.salesTeam,
      organizationId: ids.organization,
      managerId: ids.userManager,
      name: "Enterprise Sales",
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await tx.roleAssignment.createMany({
    data: [
      roleAssignment(demoId(21), ids.userAdmin, Role.ADMIN),
      roleAssignment(
        demoId(22),
        ids.userRepresentative,
        Role.SALES_REP,
        ids.salesTeam,
      ),
      roleAssignment(
        demoId(23),
        ids.userManager,
        Role.SALES_MANAGER,
        ids.salesTeam,
      ),
      roleAssignment(demoId(24), ids.userFinance, Role.FINANCE),
      roleAssignment(demoId(25), ids.userOperations, Role.OPERATIONS),
      roleAssignment(demoId(26), ids.userCustomer, Role.CUSTOMER),
    ],
    skipDuplicates: true,
  });

  await tx.customerTier.createMany({
    data: [
      customerTier(ids.tierBronze, "BRONZE", "Bronze", 10),
      customerTier(ids.tierSilver, "SILVER", "Silver", 20),
      customerTier(ids.tierGold, "GOLD", "Gold", 30),
    ],
    skipDuplicates: true,
  });

  await tx.customerAccount.createMany({
    data: [
      {
        id: ids.customerSafe,
        organizationId: ids.organization,
        tierId: ids.tierGold,
        salesTeamId: ids.salesTeam,
        assignedRepId: ids.userRepresentative,
        accountCode: "ALDER-SAFE",
        name: "Alder Ridge Systems",
        preferredCurrency: "USD",
        paymentTermsDays: 30,
        creditLimit: "250000",
        currentExposure: "20000",
        overdueBalance: "0",
        status: ConfigurationStatus.ACTIVE,
      },
      {
        id: ids.customerOverdue,
        organizationId: ids.organization,
        tierId: ids.tierGold,
        salesTeamId: ids.salesTeam,
        assignedRepId: ids.userRepresentative,
        accountCode: "NORTHSTAR-RISK",
        name: "Northstar Retail",
        preferredCurrency: "USD",
        paymentTermsDays: 15,
        creditLimit: "50000",
        currentExposure: "60000",
        overdueBalance: "20000",
        status: ConfigurationStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.customerContact.createMany({
    data: [
      {
        id: ids.contactSafe,
        organizationId: ids.organization,
        customerAccountId: ids.customerSafe,
        email: "buyer@alderridge.demo",
        firstName: "Casey",
        lastName: "Buyer",
        isPrimary: true,
        portalEnabled: true,
        status: ConfigurationStatus.ACTIVE,
      },
      {
        id: ids.contactOverdue,
        organizationId: ids.organization,
        customerAccountId: ids.customerOverdue,
        email: "buyer@northstar.demo",
        firstName: "Nora",
        lastName: "Buyer",
        isPrimary: true,
        portalEnabled: true,
        status: ConfigurationStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.portalIdentity.createMany({
    data: [
      {
        id: ids.portalSafe,
        organizationId: ids.organization,
        customerContactId: ids.contactSafe,
        email: "buyer@alderridge.demo",
        status: PortalIdentityStatus.ACTIVE,
      },
      {
        id: ids.portalOverdue,
        organizationId: ids.organization,
        customerContactId: ids.contactOverdue,
        email: "buyer@northstar.demo",
        status: PortalIdentityStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.tax.upsert({
    where: { id: ids.taxStandard },
    update: {
      code: "STANDARD-18",
      name: "Standard 18%",
      rate: "18",
      behavior: TaxBehavior.EXCLUSIVE,
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      id: ids.taxStandard,
      organizationId: ids.organization,
      code: "STANDARD-18",
      name: "Standard 18%",
      rate: "18",
      behavior: TaxBehavior.EXCLUSIVE,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await tx.productCategory.createMany({
    data: [
      category(ids.categoryHardware, "HARDWARE", "Hardware"),
      category(ids.categoryService, "SERVICE", "Services"),
      category(ids.categorySubscription, "SUBSCRIPTION", "Subscriptions"),
    ],
    skipDuplicates: true,
  });

  await tx.product.createMany({
    data: [
      product(
        ids.productHardware,
        ids.categoryHardware,
        "EDGE-SERVER",
        "Edge Server",
        ProductType.HARDWARE,
        "6800",
      ),
      product(
        ids.productSetup,
        ids.categoryService,
        "SETUP-SVC",
        "Implementation Setup",
        ProductType.SERVICE,
        "4400",
        "service",
      ),
      product(
        ids.productSupport,
        ids.categorySubscription,
        "SUPPORT-PRO",
        "Premier Support",
        ProductType.SUBSCRIPTION,
        "450",
        "month",
      ),
      product(
        ids.productBackup,
        ids.categoryHardware,
        "BACKUP-APL",
        "Backup Appliance",
        ProductType.HARDWARE,
        "1900",
      ),
      product(
        ids.productMonitoring,
        ids.categoryService,
        "SEC-MON",
        "Security Monitoring",
        ProductType.SERVICE,
        "350",
        "month",
      ),
    ],
    skipDuplicates: true,
  });

  await tx.productVariant.createMany({
    data: [
      {
        id: ids.variantHardware,
        organizationId: ids.organization,
        productId: ids.productHardware,
        sku: "EDGE-SERVER-STD",
        name: "Standard configuration",
        attributes: { memory: "64 GB", storage: "2 TB" },
        priceSurcharge: "0",
        status: ConfigurationStatus.ACTIVE,
      },
      {
        id: ids.variantBackup,
        organizationId: ids.organization,
        productId: ids.productBackup,
        sku: "BACKUP-APL-STD",
        name: "Standard configuration",
        attributes: { capacity: "8 TB" },
        priceSurcharge: "0",
        status: ConfigurationStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.subscriptionPlan.upsert({
    where: { id: ids.subscriptionPlan },
    update: {
      code: "MONTHLY-CALENDAR",
      name: "Monthly Calendar Billing",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      id: ids.subscriptionPlan,
      organizationId: ids.organization,
      code: "MONTHLY-CALENDAR",
      name: "Monthly Calendar Billing",
      interval: BillingInterval.MONTH,
      intervalCount: 1,
      prorationConvention: ProrationConvention.CALENDAR_DAYS,
      cancellationRules: { noticeDays: 30 },
      refundRules: { unusedDays: "credit" },
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await seedPricingAndInventory(tx);
  await seedQuoteAndGovernance(tx);
  await seedHealthAndCredit(tx);
  await seedWorkflowScenarios(tx);
  // Synthetic per-table volume is opt-in and must not pollute ordinary demos.
  if (process.env.SEED_STRESS_DATA === "true") await seedBulkVolume(tx);
}

async function seedPricingAndInventory(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.priceList.upsert({
    where: { id: ids.priceList },
    update: { name: "Demo USD Price List", status: ConfigurationStatus.ACTIVE },
    create: {
      id: ids.priceList,
      organizationId: ids.organization,
      code: "DEMO-USD",
      name: "Demo USD Price List",
      currency: "USD",
      priority: 100,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await tx.priceRule.createMany({
    data: [
      priceRule(ids.priceRuleHardware, ids.productHardware, "10000", 100),
      priceRule(ids.priceRuleSetup, ids.productSetup, "5000", 90),
      priceRule(ids.priceRuleSupport, ids.productSupport, "1200", 80),
      priceRule(ids.priceRuleBackup, ids.productBackup, "3000", 70),
      priceRule(ids.priceRuleMonitoring, ids.productMonitoring, "900", 60),
    ],
    skipDuplicates: true,
  });

  await tx.discountLimit.createMany({
    data: [
      {
        id: ids.discountHardware,
        organizationId: ids.organization,
        name: "Gold hardware ceiling",
        tierId: ids.tierGold,
        categoryId: ids.categoryHardware,
        maxDiscountPercent: "15",
        priority: 100,
        effectiveFrom,
        status: ConfigurationStatus.ACTIVE,
      },
      {
        id: ids.discountService,
        organizationId: ids.organization,
        name: "Gold service ceiling",
        tierId: ids.tierGold,
        categoryId: ids.categoryService,
        maxDiscountPercent: "10",
        priority: 100,
        effectiveFrom,
        status: ConfigurationStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.promotion.upsert({
    where: { id: ids.promotion },
    update: {
      name: "Backup Readiness Boost",
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      id: ids.promotion,
      organizationId: ids.organization,
      code: "BACKUP-BOOST",
      name: "Backup Readiness Boost",
      conditions: { requiresProductCode: "EDGE-SERVER" },
      benefit: { recommendationOnly: true },
      recommendationBoost: "0.75",
      priority: 100,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await tx.promotionProduct.createMany({
    data: [
      {
        id: ids.promotionProduct,
        organizationId: ids.organization,
        promotionId: ids.promotion,
        productId: ids.productBackup,
      },
    ],
    skipDuplicates: true,
  });

  await tx.recommendationRule.upsert({
    where: { id: ids.recommendationRule },
    update: {
      name: "Explainable weighted ranker",
      affinityWeight: "0.35",
      marginWeight: "0.20",
      promotionWeight: "0.15",
      availabilityWeight: "0.15",
      stockAgeWeight: "0.15",
      conditions: {
        excludeDuplicates: true,
        requireAvailabilityForHardware: true,
        availabilityTargetUnits: 10,
        stockAgeTargetDays: 90,
      },
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      id: ids.recommendationRule,
      organizationId: ids.organization,
      code: "WEIGHTED-RANKER",
      name: "Explainable weighted ranker",
      version: 1,
      priority: 100,
      affinityWeight: "0.35",
      marginWeight: "0.20",
      promotionWeight: "0.15",
      availabilityWeight: "0.15",
      stockAgeWeight: "0.15",
      minimumMargin: "15",
      conditions: {
        excludeDuplicates: true,
        requireAvailabilityForHardware: true,
        availabilityTargetUnits: 10,
        stockAgeTargetDays: 90,
      },
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    },
  });

  await tx.productAffinity.createMany({
    data: [
      {
        id: ids.affinity,
        organizationId: ids.organization,
        sourceProductId: ids.productHardware,
        targetProductId: ids.productBackup,
        affinityScore: "0.90",
        coPurchaseCount: 24,
        effectiveFrom,
        status: ConfigurationStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.warehouse.createMany({
    data: [
      {
        id: ids.warehouseEast,
        organizationId: ids.organization,
        code: "EAST",
        name: "East Warehouse",
        address: { city: "New York", country: "US" },
        shippingCostWeight: "1.00",
        leadTimeDays: 2,
        status: ConfigurationStatus.ACTIVE,
      },
      {
        id: ids.warehouseWest,
        organizationId: ids.organization,
        code: "WEST",
        name: "West Warehouse",
        address: { city: "San Francisco", country: "US" },
        shippingCostWeight: "1.20",
        leadTimeDays: 3,
        status: ConfigurationStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  await tx.inventoryBalance.createMany({
    data: [
      inventoryBalance(
        ids.balanceHardwareEast,
        ids.warehouseEast,
        ids.productHardware,
        ids.variantHardware,
        "7",
      ),
      inventoryBalance(
        ids.balanceHardwareWest,
        ids.warehouseWest,
        ids.productHardware,
        ids.variantHardware,
        "4",
        {
          incoming: "8",
          incomingExpectedAt: new Date("2026-09-10T12:00:00.000Z"),
        },
      ),
      inventoryBalance(
        ids.balanceBackupEast,
        ids.warehouseEast,
        ids.productBackup,
        ids.variantBackup,
        "3",
      ),
    ],
    skipDuplicates: true,
  });

  await tx.stockMovement.createMany({
    data: [
      openingMovement(
        ids.movementHardwareEast,
        ids.balanceHardwareEast,
        ids.warehouseEast,
        ids.productHardware,
        ids.variantHardware,
        "7",
      ),
      openingMovement(
        ids.movementHardwareWest,
        ids.balanceHardwareWest,
        ids.warehouseWest,
        ids.productHardware,
        ids.variantHardware,
        "4",
      ),
      openingMovement(
        ids.movementBackupEast,
        ids.balanceBackupEast,
        ids.warehouseEast,
        ids.productBackup,
        ids.variantBackup,
        "3",
      ),
    ],
    skipDuplicates: true,
  });
}

async function seedQuoteAndGovernance(
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (
    await tx.quote.findUnique({
      where: { id: ids.quote },
      select: { id: true },
    })
  )
    return;
  await tx.quote.upsert({
    where: { id: ids.quote },
    update: {
      customerAccountId: ids.customerSafe,
      currentRevision: 1,
      ownerId: ids.userRepresentative,
      stage: QuoteStage.PENDING_APPROVAL,
    },
    create: {
      id: ids.quote,
      organizationId: ids.organization,
      customerAccountId: ids.customerSafe,
      ownerId: ids.userRepresentative,
      salesTeamId: ids.salesTeam,
      quoteNumber: "Q-2026-0001",
      stage: QuoteStage.PENDING_APPROVAL,
      currentRevision: 1,
      expiresAt: new Date("2026-12-31T23:59:59.000Z"),
      createdAt: quoteCreatedAt,
      updatedAt: quoteUpdatedAt,
    },
  });

  await tx.quoteVersion.createMany({
    data: [
      {
        id: ids.quoteVersion,
        organizationId: ids.organization,
        quoteId: ids.quote,
        customerAccountId: ids.customerSafe,
        createdById: ids.userRepresentative,
        revisionNumber: 1,
        status: QuoteVersionStatus.PENDING_APPROVAL,
        currency: "USD",
        paymentTermsDays: 30,
        customerSnapshot: {
          accountCode: "ALDER-SAFE",
          name: "Alder Ridge Systems",
          tierCode: "GOLD",
        },
        pricingSnapshot: {
          priceListCode: "DEMO-USD",
          calculatedBy: "seed-fixture",
        },
        subtotal: "110900",
        orderDiscountTotal: "0",
        lineDiscountTotal: "15300",
        taxTotal: "19962",
        total: "130862",
        costTotal: "86450",
        grossMargin: "24450",
        marginPercent: "22.0469",
        riskFacts: {
          blendedExcess: "0.3170",
          maximumLineExcess: "8.0000",
        },
        policySnapshot: { policyCode: "DEMO-GOVERNANCE", version: 1 },
        termsFingerprint,
        notes:
          "Seeded mixed-line quotation for the manager-plus-finance demo path.",
        createdAt: quoteUpdatedAt,
      },
    ],
    skipDuplicates: true,
  });

  await tx.quoteLine.createMany({
    data: [
      {
        id: ids.quoteLineHardware,
        organizationId: ids.organization,
        quoteVersionId: ids.quoteVersion,
        productId: ids.productHardware,
        variantId: ids.variantHardware,
        lineNumber: 1,
        productCode: "EDGE-SERVER",
        productName: "Edge Server",
        productDescription: "Production-ready edge compute hardware",
        productType: ProductType.HARDWARE,
        categoryCode: "HARDWARE",
        sku: "EDGE-SERVER-STD",
        unit: "each",
        quantity: "12",
        listUnitPrice: "10000",
        unitPrice: "10000",
        unitCost: "6800",
        discountPercent: "12",
        lineDiscountAmount: "14400",
        preTaxSubtotal: "105600",
        taxCode: "STANDARD-18",
        taxRate: "18",
        taxBehavior: TaxBehavior.EXCLUSIVE,
        taxAmount: "19008",
        total: "124608",
        costTotal: "81600",
        grossMargin: "24000",
        billingType: BillingType.ONE_TIME,
        pricingSnapshot: {
          priceRuleId: ids.priceRuleHardware,
          priceListCode: "DEMO-USD",
        },
        createdAt: quoteUpdatedAt,
      },
      {
        id: ids.quoteLineSetup,
        organizationId: ids.organization,
        quoteVersionId: ids.quoteVersion,
        productId: ids.productSetup,
        lineNumber: 2,
        productCode: "SETUP-SVC",
        productName: "Implementation Setup",
        productDescription: "Thin-margin implementation service",
        productType: ProductType.SERVICE,
        categoryCode: "SERVICE",
        unit: "service",
        quantity: "1",
        listUnitPrice: "5000",
        unitPrice: "5000",
        unitCost: "4400",
        discountPercent: "18",
        lineDiscountAmount: "900",
        preTaxSubtotal: "4100",
        taxCode: "STANDARD-18",
        taxRate: "18",
        taxBehavior: TaxBehavior.EXCLUSIVE,
        taxAmount: "738",
        total: "4838",
        costTotal: "4400",
        grossMargin: "-300",
        billingType: BillingType.ONE_TIME,
        pricingSnapshot: {
          priceRuleId: ids.priceRuleSetup,
          priceListCode: "DEMO-USD",
        },
        createdAt: quoteUpdatedAt,
      },
      {
        id: ids.quoteLineSupport,
        organizationId: ids.organization,
        quoteVersionId: ids.quoteVersion,
        productId: ids.productSupport,
        subscriptionPlanId: ids.subscriptionPlan,
        lineNumber: 3,
        productCode: "SUPPORT-PRO",
        productName: "Premier Support",
        productDescription: "Recurring support and response coverage",
        productType: ProductType.SUBSCRIPTION,
        categoryCode: "SUBSCRIPTION",
        unit: "month",
        quantity: "1",
        listUnitPrice: "1200",
        unitPrice: "1200",
        unitCost: "450",
        discountPercent: "0",
        lineDiscountAmount: "0",
        preTaxSubtotal: "1200",
        taxCode: "STANDARD-18",
        taxRate: "18",
        taxBehavior: TaxBehavior.EXCLUSIVE,
        taxAmount: "216",
        total: "1416",
        costTotal: "450",
        grossMargin: "750",
        billingType: BillingType.RECURRING,
        pricingSnapshot: {
          priceRuleId: ids.priceRuleSupport,
          priceListCode: "DEMO-USD",
        },
        subscriptionSnapshot: {
          planCode: "MONTHLY-CALENDAR",
          interval: BillingInterval.MONTH,
          intervalCount: 1,
          prorationConvention: ProrationConvention.CALENDAR_DAYS,
        },
        createdAt: quoteUpdatedAt,
      },
    ],
    skipDuplicates: true,
  });

  await tx.quote.update({
    where: { id: ids.quote },
    data: { currentVersionId: ids.quoteVersion, currentRevision: 1 },
  });

  await tx.quoteRiskAssessment.createMany({
    data: [
      {
        id: ids.riskAssessment,
        organizationId: ids.organization,
        quoteVersionId: ids.quoteVersion,
        blendedExcess: "0.3170",
        maximumLineExcess: "8",
        postDiscountMarginPercent: "22.0469",
        creditExposure: "20000",
        creditUtilizationPercent: "8",
        overdueBalance: "0",
        representativeAnomaly: "0.25",
        requiredRoute: [Role.SALES_MANAGER, Role.FINANCE],
        reasonCodes: ["LINE_OVER_LIMIT", "MAX_EXCESS_FINANCE_THRESHOLD"],
        thresholdSafeSuggestion: {
          lineId: ids.quoteLineSetup,
          discountPercent: "10",
          lineAdjustments: [
            { lineId: ids.quoteLineSetup, discountPercent: "10" },
          ],
          projectedMarginPercent: "22.5740",
          projectedBlendedExcess: "0",
          projectedMaximumLineExcess: "0",
          verifiedNoApprovalRoute: true,
          explanation:
            "Reduce the setup-service discount to its 10% ceiling; the seeded active policy route then has no matching discount violation.",
        },
        calculatedAt: quoteUpdatedAt,
      },
    ],
    skipDuplicates: true,
  });

  await tx.quoteLineRiskFact.createMany({
    data: [
      {
        id: ids.riskFactHardware,
        organizationId: ids.organization,
        assessmentId: ids.riskAssessment,
        quoteLineId: ids.quoteLineHardware,
        appliedDiscountPercent: "12",
        allowedDiscountPercent: "15",
        excessDiscountPercent: "0",
        preDiscountValue: "120000",
        weight: "0.9509",
        weightedExcess: "0",
        reasonCodes: [],
      },
      {
        id: ids.riskFactSetup,
        organizationId: ids.organization,
        assessmentId: ids.riskAssessment,
        quoteLineId: ids.quoteLineSetup,
        appliedDiscountPercent: "18",
        allowedDiscountPercent: "10",
        excessDiscountPercent: "8",
        preDiscountValue: "5000",
        weight: "0.0396",
        weightedExcess: "0.3170",
        reasonCodes: ["SERVICE_DISCOUNT_OVER_LIMIT"],
      },
      {
        id: ids.riskFactSupport,
        organizationId: ids.organization,
        assessmentId: ids.riskAssessment,
        quoteLineId: ids.quoteLineSupport,
        appliedDiscountPercent: "0",
        allowedDiscountPercent: "0",
        excessDiscountPercent: "0",
        preDiscountValue: "1200",
        weight: "0.0095",
        weightedExcess: "0",
        reasonCodes: [],
      },
    ],
    skipDuplicates: true,
  });

  await tx.quoteLineRiskLimitMatch.createMany({
    data: [
      {
        id: ids.riskLimitHardware,
        organizationId: ids.organization,
        lineRiskFactId: ids.riskFactHardware,
        quoteLineId: ids.quoteLineHardware,
        discountLimitId: ids.discountHardware,
        ruleSnapshot: {
          name: "Gold hardware ceiling",
          maxDiscountPercent: "15",
        },
        reason: "The Gold-tier hardware ceiling is 15%.",
      },
      {
        id: ids.riskLimitSetup,
        organizationId: ids.organization,
        lineRiskFactId: ids.riskFactSetup,
        quoteLineId: ids.quoteLineSetup,
        discountLimitId: ids.discountService,
        ruleSnapshot: {
          name: "Gold service ceiling",
          maxDiscountPercent: "10",
        },
        reason:
          "The 18% service discount exceeds the Gold-tier 10% ceiling by 8 points.",
      },
    ],
    skipDuplicates: true,
  });

  await tx.approvalPolicy.upsert({
    where: { id: ids.approvalPolicy },
    update: {
      name: "Demo discount governance",
      predicates: {
        manager: { anyLineAboveCeiling: true, blendedExcessAtLeast: "1.5" },
        finance: {
          maximumLineExcessAtLeast: "8",
          blendedExcessAtLeast: "4",
          creditUtilizationAtLeast: "100",
          overdueBalanceAbove: "0",
          latePaidInvoiceCountAtLeast: "1",
          failedPaymentCountAtLeast: "1",
        },
      },
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      id: ids.approvalPolicy,
      organizationId: ids.organization,
      code: "DEMO-GOVERNANCE",
      version: 1,
      name: "Demo discount governance",
      predicates: {
        manager: { anyLineAboveCeiling: true, blendedExcessAtLeast: "1.5" },
        finance: {
          maximumLineExcessAtLeast: "8",
          blendedExcessAtLeast: "4",
          creditUtilizationAtLeast: "100",
          overdueBalanceAbove: "0",
          latePaidInvoiceCountAtLeast: "1",
          failedPaymentCountAtLeast: "1",
        },
      },
      priority: 100,
      status: ConfigurationStatus.ACTIVE,
      effectiveFrom,
    },
  });

  await tx.approvalStepTemplate.createMany({
    data: [
      {
        id: ids.approvalTemplateManager,
        organizationId: ids.organization,
        approvalPolicyId: ids.approvalPolicy,
        sequence: 1,
        requiredRole: Role.SALES_MANAGER,
        requiredCapability: "approval.managerAct",
        assigneeStrategy: "SALES_TEAM_MANAGER",
        dueAfterHours: 24,
      },
      {
        id: ids.approvalTemplateFinance,
        organizationId: ids.organization,
        approvalPolicyId: ids.approvalPolicy,
        sequence: 2,
        requiredRole: Role.FINANCE,
        requiredCapability: "approval.financeAct",
        assigneeStrategy: "ORGANIZATION_FINANCE",
        dueAfterHours: 24,
      },
    ],
    skipDuplicates: true,
  });

  await tx.approvalRequest.createMany({
    data: [
      {
        id: ids.approvalRequest,
        organizationId: ids.organization,
        quoteId: ids.quote,
        quoteVersionId: ids.quoteVersion,
        termsFingerprint,
        status: ApprovalRequestStatus.IN_PROGRESS,
        currentSequence: 1,
        ruleFacts: { maximumLineExcess: "8", blendedExcess: "0.3170" },
        requiredRoute: [Role.SALES_MANAGER, Role.FINANCE],
        decisionExplanation: {
          primaryReason:
            "The setup-service discount is 8 points above its ceiling.",
        },
        requestedAt: quoteUpdatedAt,
      },
    ],
    skipDuplicates: true,
  });

  await tx.approvalRequestPolicyMatch.createMany({
    data: [
      {
        id: ids.approvalPolicyMatch,
        organizationId: ids.organization,
        approvalRequestId: ids.approvalRequest,
        approvalPolicyId: ids.approvalPolicy,
        policyVersion: 1,
        matchedFacts: {
          lineId: ids.quoteLineSetup,
          excessDiscountPercent: "8",
        },
        reason:
          "Service discount exceeds its ceiling and meets the finance maximum-excess threshold.",
      },
    ],
    skipDuplicates: true,
  });

  await tx.approvalStep.createMany({
    data: [
      {
        id: ids.approvalStepManager,
        organizationId: ids.organization,
        approvalRequestId: ids.approvalRequest,
        approvalStepTemplateId: ids.approvalTemplateManager,
        sequence: 1,
        requiredCapability: "approval.managerAct",
        requiredRole: Role.SALES_MANAGER,
        assigneeId: ids.userManager,
        status: ApprovalStepStatus.ACTIVE,
        dueAt: new Date("2026-09-06T11:30:00.000Z"),
        activatedAt: quoteUpdatedAt,
      },
      {
        id: ids.approvalStepFinance,
        organizationId: ids.organization,
        approvalRequestId: ids.approvalRequest,
        approvalStepTemplateId: ids.approvalTemplateFinance,
        sequence: 2,
        requiredCapability: "approval.financeAct",
        requiredRole: Role.FINANCE,
        assigneeId: ids.userFinance,
        status: ApprovalStepStatus.WAITING,
        dueAt: new Date("2026-09-07T11:30:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });
}

async function seedHealthAndCredit(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.dealEvent.createMany({
    data: [
      {
        id: ids.dealEventCreated,
        organizationId: ids.organization,
        quoteId: ids.quote,
        visibility: Visibility.BOTH,
        eventType: "quote.created",
        title: "Quotation created",
        message:
          "A mixed hardware, service, and subscription quotation was created.",
        actorType: ActorType.USER,
        actorId: ids.userRepresentative,
        sourceEntityType: "Quote",
        sourceEntityId: ids.quote,
        sourceVersion: 1,
        metadata: { customerSafe: true },
        occurredAt: quoteCreatedAt,
      },
      {
        id: ids.dealEventDiscount,
        organizationId: ids.organization,
        quoteId: ids.quote,
        visibility: Visibility.INTERNAL,
        eventType: "deal.activityRecorded",
        title: "Discount anomaly detected",
        message:
          "The service discount exceeds the configured Gold-tier ceiling.",
        actorType: ActorType.SYSTEM,
        sourceEntityType: "QuoteVersion",
        sourceEntityId: ids.quoteVersion,
        sourceVersion: 1,
        metadata: { reasonCode: "SERVICE_DISCOUNT_OVER_LIMIT" },
        occurredAt: quoteUpdatedAt,
      },
    ],
    skipDuplicates: true,
  });

  await tx.dealHealthSnapshot.createMany({
    data: [
      {
        id: ids.healthSnapshot,
        organizationId: ids.organization,
        quoteId: ids.quote,
        reason: "Scheduled demo health evaluation",
        healthScore: "42",
        stalledDays: 31,
        discountAnomalyScore: "0.82",
        approvalSlaHoursOverdue: 0,
        promiseSlippageDays: 0,
        creditExposure: "20000",
        facts: {
          staleSince: "2026-08-05",
          anomalyReason: "SERVICE_DISCOUNT_OVER_LIMIT",
        },
        calculatedAt: new Date("2026-09-05T08:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await tx.alert.createMany({
    data: [
      {
        id: ids.alertStalled,
        organizationId: ids.organization,
        quoteId: ids.quote,
        dealHealthSnapshotId: ids.healthSnapshot,
        type: AlertType.STALLED_DEAL,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        reasonCode: "NO_RECENT_ACTIVITY",
        title: "Deal has stalled",
        message:
          "This quotation has had no customer-facing activity for 31 days.",
        facts: { stalledDays: 31 },
        detectedAt: new Date("2026-09-05T08:00:00.000Z"),
      },
      {
        id: ids.alertAnomaly,
        organizationId: ids.organization,
        quoteId: ids.quote,
        dealHealthSnapshotId: ids.healthSnapshot,
        type: AlertType.DISCOUNT_ANOMALY,
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.OPEN,
        reasonCode: "SERVICE_DISCOUNT_OVER_LIMIT",
        title: "Unusual service discount",
        message:
          "The setup-service discount is 8 points above the allowed ceiling.",
        facts: { appliedDiscount: "18", allowedDiscount: "10" },
        detectedAt: new Date("2026-09-05T08:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await tx.invoice.createMany({
    data: [
      {
        id: ids.overdueInvoice,
        organizationId: ids.organization,
        customerAccountId: ids.customerOverdue,
        invoiceNumber: "INV-2026-OVERDUE",
        type: InvoiceType.ONE_TIME,
        status: InvoiceStatus.OVERDUE,
        currency: "USD",
        subtotal: "20000",
        discountAmount: "0",
        taxAmount: "0",
        total: "20000",
        amountPaid: "0",
        balanceDue: "20000",
        calculationSnapshot: { source: "historical-demo-balance" },
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
        issuedAt: new Date("2026-07-01T09:00:00.000Z"),
      },
      {
        id: ids.latePaidInvoice,
        organizationId: ids.organization,
        customerAccountId: ids.customerOverdue,
        invoiceNumber: "INV-2026-LATE-PAID",
        type: InvoiceType.ONE_TIME,
        status: InvoiceStatus.PAID,
        currency: "USD",
        subtotal: "5000",
        discountAmount: "0",
        taxAmount: "0",
        total: "5000",
        amountPaid: "5000",
        balanceDue: "0",
        calculationSnapshot: { source: "historical-demo-payment" },
        dueDate: new Date("2026-06-01T00:00:00.000Z"),
        issuedAt: new Date("2026-05-01T09:00:00.000Z"),
        paidAt: new Date("2026-06-20T09:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await tx.invoiceLine.createMany({
    data: [
      {
        id: ids.overdueInvoiceLine,
        organizationId: ids.organization,
        invoiceId: ids.overdueInvoice,
        position: 1,
        description: "Historical unpaid implementation balance",
        unit: "service",
        billingType: BillingType.ONE_TIME,
        quantity: "1",
        unitPrice: "20000",
        discountAmount: "0",
        subtotal: "20000",
        taxSnapshot: { behavior: TaxBehavior.EXCLUSIVE, rate: "0" },
        taxAmount: "0",
        total: "20000",
      },
      {
        id: ids.latePaidInvoiceLine,
        organizationId: ids.organization,
        invoiceId: ids.latePaidInvoice,
        position: 1,
        description: "Historical implementation payment",
        unit: "service",
        billingType: BillingType.ONE_TIME,
        quantity: "1",
        unitPrice: "5000",
        discountAmount: "0",
        subtotal: "5000",
        taxSnapshot: { behavior: TaxBehavior.EXCLUSIVE, rate: "0" },
        taxAmount: "0",
        total: "5000",
      },
    ],
    skipDuplicates: true,
  });

  await tx.payment.createMany({
    data: [
      {
        id: ids.latePayment,
        organizationId: ids.organization,
        invoiceId: ids.latePaidInvoice,
        recordedById: ids.userFinance,
        amount: "5000",
        currency: "USD",
        method: PaymentMethod.BANK_TRANSFER,
        reference: "DEMO-LATE-PAYMENT",
        status: PaymentStatus.RECORDED,
        paymentDate: new Date("2026-06-20T09:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await tx.savedReportFilter.createMany({
    data: [
      {
        id: ids.savedFilter,
        organizationId: ids.organization,
        userId: ids.userFinance,
        name: "Open overdue invoices",
        reportType: ReportType.INVOICES,
        filters: { status: InvoiceStatus.OVERDUE },
      },
    ],
    skipDuplicates: true,
  });
}

function demoUser(
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  passwordHash: string | null,
) {
  return {
    id,
    organizationId: ids.organization,
    email: normalizeEmail(email),
    passwordHash,
    firstName,
    lastName,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: effectiveFrom,
  };
}

function normalizeEmail(email: string): string {
  return email.toLowerCase();
}

async function getDemoPasswordHash(): Promise<string | null> {
  const demoPassword = process.env.DEMO_PASSWORD;

  if (!demoPassword) {
    console.warn(
      "DEMO_PASSWORD is not set; password sign-in is disabled for seeded users.",
    );
    return null;
  }

  if (
    demoPassword.length < MIN_DEMO_PASSWORD_LENGTH ||
    demoPassword.length > MAX_DEMO_PASSWORD_LENGTH
  ) {
    throw new Error(
      `DEMO_PASSWORD must be between ${MIN_DEMO_PASSWORD_LENGTH} and ${MAX_DEMO_PASSWORD_LENGTH} characters.`,
    );
  }

  return Bun.password.hash(demoPassword, { algorithm: "argon2id" });
}

function roleAssignment(
  id: string,
  userId: string,
  role: Role,
  salesTeamId?: string,
) {
  return {
    id,
    organizationId: ids.organization,
    userId,
    role,
    salesTeamId,
    active: true,
  };
}

function customerTier(
  id: string,
  code: string,
  name: string,
  priority: number,
) {
  return {
    id,
    organizationId: ids.organization,
    code,
    name,
    priority,
    status: ConfigurationStatus.ACTIVE,
  };
}

function category(id: string, code: string, name: string) {
  return {
    id,
    organizationId: ids.organization,
    code,
    name,
    status: ConfigurationStatus.ACTIVE,
  };
}

function product(
  id: string,
  categoryId: string,
  code: string,
  name: string,
  type: ProductType,
  standardCost: string,
  unit = "each",
) {
  return {
    id,
    organizationId: ids.organization,
    categoryId,
    taxId: ids.taxStandard,
    code,
    name,
    type,
    unit,
    standardCost,
    status: ConfigurationStatus.ACTIVE,
  };
}

function priceRule(
  id: string,
  productId: string,
  unitPrice: string,
  priority: number,
) {
  return {
    id,
    organizationId: ids.organization,
    priceListId: ids.priceList,
    productId,
    tierId: ids.tierGold,
    minQuantity: "1",
    unitPrice,
    priority,
    effectiveFrom,
    status: ConfigurationStatus.ACTIVE,
  };
}

function inventoryBalance(
  id: string,
  warehouseId: string,
  productId: string,
  variantId: string,
  quantity: string,
  incoming: {
    incoming: string;
    incomingExpectedAt: Date;
  } | null = null,
) {
  return {
    id,
    organizationId: ids.organization,
    warehouseId,
    productId,
    variantId,
    onHand: quantity,
    reserved: "0",
    available: quantity,
    incoming: incoming?.incoming ?? "0",
    incomingExpectedAt: incoming?.incomingExpectedAt ?? null,
    stockedSince: effectiveFrom,
  };
}

function openingMovement(
  id: string,
  inventoryBalanceId: string,
  warehouseId: string,
  productId: string,
  variantId: string,
  quantity: string,
) {
  return {
    id,
    organizationId: ids.organization,
    inventoryBalanceId,
    warehouseId,
    productId,
    variantId,
    type: "RECEIPT" as const,
    quantity,
    reference: "DEMO-OPENING-STOCK",
    reason: "Deterministic opening inventory for the two-warehouse demo.",
    onHandAfter: quantity,
    reservedAfter: "0",
    metadata: { seeded: true },
    occurredAt: effectiveFrom,
  };
}

// ---------------------------------------------------------------------------
// Bulk demo volume.
//
// Every table receives BULK_ROWS rows so list views, pagination, filters, and
// reports have realistic volume to work against. Identifiers come from a
// reserved block that starts far above the curated records above, so the two
// sets never collide, and every insert uses `skipDuplicates` so re-seeding
// stays idempotent.
// ---------------------------------------------------------------------------

const BULK_ROWS = 275;
const BULK_ID_BASE = 1_000_000;
const BULK_ID_STRIDE = 10_000;

const BULK_TABLES = [
  "organization",
  "customerTier",
  "productCategory",
  "tax",
  "salesTeam",
  "user",
  "warehouse",
  "subscriptionPlan",
  "priceList",
  "approvalPolicy",
  "roleAssignment",
  "product",
  "productVariant",
  "priceRule",
  "discountLimit",
  "promotion",
  "promotionProduct",
  "recommendationRule",
  "productAffinity",
  "approvalStepTemplate",
  "inventoryBalance",
  "stockMovement",
  "customerAccount",
  "customerContact",
  "portalIdentity",
  "session",
  "refreshToken",
  "portalSession",
  "magicLinkToken",
  "quote",
  "quoteVersion",
  "quoteLine",
  "quoteRiskAssessment",
  "quoteLineRiskFact",
  "quoteLineRiskLimitMatch",
  "approvalRequest",
  "approvalRequestPolicyMatch",
  "approvalStep",
  "approvalDecision",
  "recommendationInteraction",
  "negotiationThread",
  "negotiationMessage",
  "changeRequest",
  "changeRequestItem",
  "counteroffer",
  "counterofferItem",
  "customerAcceptance",
  "order",
  "orderLine",
  "fulfillmentPlan",
  "fulfillmentAllocation",
  "stockReservation",
  "shipment",
  "shipmentItem",
  "backorder",
  "subscription",
  "subscriptionItem",
  "subscriptionChange",
  "billingSchedule",
  "invoice",
  "invoiceLine",
  "creditNote",
  "creditNoteLine",
  "payment",
  "dealHealthSnapshot",
  "alert",
  "nudge",
  "auditEvent",
  "dealEvent",
  "outboxEvent",
  "idempotencyRecord",
  "exportJob",
  "notification",
  "savedReportFilter",
] as const;

type BulkTable = (typeof BULK_TABLES)[number];

const BULK_FIRST_NAMES = [
  "Ada",
  "Ravi",
  "Maya",
  "Farah",
  "Owen",
  "Casey",
  "Nadia",
  "Luis",
  "Priya",
  "Tomas",
  "Ingrid",
  "Kenji",
  "Sofia",
  "Marcus",
  "Leila",
  "Devon",
  "Anika",
  "Hugo",
  "Zara",
  "Elias",
] as const;

const BULK_LAST_NAMES = [
  "Nakamura",
  "Okafor",
  "Lindqvist",
  "Moreau",
  "Castellanos",
  "Rahman",
  "Bianchi",
  "Novak",
  "Silva",
  "Petrov",
  "Hoffman",
  "Duarte",
  "Kowalski",
  "Ferreira",
  "Andersen",
  "Varga",
  "Mensah",
  "Rossi",
  "Klein",
  "Tanaka",
] as const;

const BULK_COMPANY_PREFIXES = [
  "Alder Ridge",
  "Northstar",
  "Blue Harbor",
  "Ironwood",
  "Cedar Point",
  "Silverline",
  "Granite Bay",
  "Redwood",
  "Copperfield",
  "Lakeshore",
  "Summit Park",
  "Fairview",
  "Brightwater",
  "Stonebridge",
  "Highland",
  "Meridian",
  "Clearfield",
  "Westgate",
  "Emberhill",
  "Kingsford",
] as const;

const BULK_COMPANY_SUFFIXES = [
  "Systems",
  "Retail",
  "Logistics",
  "Industries",
  "Manufacturing",
  "Networks",
  "Analytics",
  "Robotics",
  "Health",
  "Energy",
] as const;

const BULK_CITIES = [
  "Austin",
  "Portland",
  "Denver",
  "Columbus",
  "Raleigh",
  "Tacoma",
  "Boise",
  "Omaha",
  "Fresno",
  "Albany",
] as const;

function bulkId(table: BulkTable, row: number): string {
  return demoId(
    BULK_ID_BASE + BULK_TABLES.indexOf(table) * BULK_ID_STRIDE + row,
  );
}

function bulkRows<T>(
  build: (index: number) => T,
  count: number = BULK_ROWS,
): T[] {
  return Array.from({ length: count }, (_, index) => build(index));
}

function cycle<T>(values: readonly [T, ...T[]], index: number): T {
  return values[index % values.length] ?? values[0];
}

function bulkCode(prefix: string, index: number): string {
  return `${prefix}-${(index + 1).toString().padStart(4, "0")}`;
}

/**
 * Token columns are unique and sized for a hash. The separators keep
 * `prefix-1-` and `prefix-10-` distinct once the padding is applied.
 */
function bulkHash(prefix: string, index: number): string {
  return `${prefix}-${index}-`.padEnd(64, "0").slice(0, 64);
}

const bulkEpoch = new Date("2026-02-01T00:00:00.000Z");
const DAY_MS = 86_400_000;

function bulkDate(dayOffset: number): Date {
  return new Date(bulkEpoch.getTime() + dayOffset * DAY_MS);
}

function bulkAmount(base: number, index: number, step = 25): string {
  return (base + index * step).toFixed(2);
}

function bulkCompanyName(index: number): string {
  return `${cycle(BULK_COMPANY_PREFIXES, index)} ${cycle(BULK_COMPANY_SUFFIXES, Math.floor(index / BULK_COMPANY_PREFIXES.length))} ${index + 1}`;
}

function bulkPlanSnapshot(index: number): Prisma.InputJsonValue {
  return {
    planCode: bulkCode("BULK-PLAN", index),
    interval: BillingInterval.MONTH,
    intervalCount: 1,
    prorationConvention: ProrationConvention.CALENDAR_DAYS,
  };
}

async function seedBulkVolume(tx: Prisma.TransactionClient): Promise<void> {
  await seedBulkFoundation(tx);
  await seedBulkCatalog(tx);
  await seedBulkCustomers(tx);
  await seedBulkQuotes(tx);
  await seedBulkOrders(tx);
  await seedBulkBilling(tx);
  await seedBulkOperations(tx);
}

async function seedBulkFoundation(tx: Prisma.TransactionClient): Promise<void> {
  // Additional tenants stay empty on purpose: the demo organization owns every
  // record below so `demo:reset` can still clear the workspace in one pass.
  await tx.organization.createMany({
    data: bulkRows((index) => ({
      id: bulkId("organization", index),
      name: `${bulkCompanyName(index)} Tenant`,
      slug: bulkCode("bulk-tenant", index),
      baseCurrency: "USD",
      timezone: "UTC",
      settings: { bulk: true },
    })),
    skipDuplicates: true,
  });

  await tx.user.createMany({
    data: bulkRows((index) => ({
      id: bulkId("user", index),
      organizationId: ids.organization,
      email: normalizeEmail(`bulk.user.${index + 1}@demo.dealflow360.local`),
      passwordHash: null,
      firstName: cycle(BULK_FIRST_NAMES, index),
      lastName: cycle(
        BULK_LAST_NAMES,
        index + Math.floor(index / BULK_LAST_NAMES.length),
      ),
      status: cycle(
        [
          UserStatus.ACTIVE,
          UserStatus.ACTIVE,
          UserStatus.ACTIVE,
          UserStatus.INVITED,
        ],
        index,
      ),
      emailVerifiedAt: effectiveFrom,
    })),
    skipDuplicates: true,
  });

  await tx.salesTeam.createMany({
    data: bulkRows((index) => ({
      id: bulkId("salesTeam", index),
      organizationId: ids.organization,
      managerId: bulkId("user", index),
      name: `${cycle(BULK_COMPANY_PREFIXES, index)} Territory ${index + 1}`,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.roleAssignment.createMany({
    data: bulkRows((index) => ({
      id: bulkId("roleAssignment", index),
      organizationId: ids.organization,
      userId: bulkId("user", index),
      role: cycle(
        [Role.SALES_REP, Role.SALES_MANAGER, Role.FINANCE, Role.OPERATIONS],
        index,
      ),
      salesTeamId: bulkId("salesTeam", index),
      active: true,
    })),
    skipDuplicates: true,
  });

  await tx.customerTier.createMany({
    data: bulkRows((index) => ({
      id: bulkId("customerTier", index),
      organizationId: ids.organization,
      code: bulkCode("TIER", index),
      name: `Segment ${index + 1}`,
      priority: 100 + index,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.productCategory.createMany({
    data: bulkRows((index) => ({
      id: bulkId("productCategory", index),
      organizationId: ids.organization,
      parentId: null,
      code: bulkCode("CAT", index),
      name: `Catalog Group ${index + 1}`,
      description: `Deterministic bulk catalog group ${index + 1}.`,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.tax.createMany({
    data: bulkRows((index) => ({
      id: bulkId("tax", index),
      organizationId: ids.organization,
      code: bulkCode("TAX", index),
      name: `Rate ${(index % 26) + 5}%`,
      rate: ((index % 26) + 5).toFixed(2),
      behavior: cycle([TaxBehavior.EXCLUSIVE, TaxBehavior.INCLUSIVE], index),
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.warehouse.createMany({
    data: bulkRows((index) => ({
      id: bulkId("warehouse", index),
      organizationId: ids.organization,
      code: bulkCode("WH", index),
      name: `${cycle(BULK_CITIES, index)} Distribution ${index + 1}`,
      address: {
        city: cycle(BULK_CITIES, index),
        country: "US",
        line1: `${100 + index} Industrial Way`,
      },
      shippingCostWeight: (1 + (index % 5) * 0.25).toFixed(2),
      leadTimeDays: 1 + (index % 10),
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.subscriptionPlan.createMany({
    data: bulkRows((index) => ({
      id: bulkId("subscriptionPlan", index),
      organizationId: ids.organization,
      code: bulkCode("BULK-PLAN", index),
      name: `Managed Plan ${index + 1}`,
      interval: cycle(
        [BillingInterval.MONTH, BillingInterval.YEAR, BillingInterval.WEEK],
        index,
      ),
      intervalCount: 1,
      prorationConvention: cycle(
        [
          ProrationConvention.CALENDAR_DAYS,
          ProrationConvention.THIRTY_DAY_MONTH,
        ],
        index,
      ),
      cancellationRules: { noticeDays: 30 },
      refundRules: { unusedDays: "credit" },
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.priceList.createMany({
    data: bulkRows((index) => ({
      id: bulkId("priceList", index),
      organizationId: ids.organization,
      code: bulkCode("PL", index),
      name: `Regional Price List ${index + 1}`,
      currency: "USD",
      priority: 10 + index,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.approvalPolicy.createMany({
    data: bulkRows((index) => ({
      id: bulkId("approvalPolicy", index),
      organizationId: ids.organization,
      code: bulkCode("POLICY", index),
      version: 1,
      name: `Discount Guardrail ${index + 1}`,
      predicates: { maxDiscountPercent: 10 + (index % 20) },
      priority: 10 + index,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.approvalStepTemplate.createMany({
    data: bulkRows((index) => ({
      id: bulkId("approvalStepTemplate", index),
      organizationId: ids.organization,
      approvalPolicyId: bulkId("approvalPolicy", index),
      sequence: 1,
      requiredRole: cycle([Role.SALES_MANAGER, Role.FINANCE], index),
      requiredCapability: cycle(
        ["approval.managerAct", "approval.financeAct"],
        index,
      ),
      assigneeStrategy: "SALES_TEAM_MANAGER",
      dueAfterHours: 24 + (index % 48),
    })),
    skipDuplicates: true,
  });
}

async function seedBulkCatalog(tx: Prisma.TransactionClient): Promise<void> {
  await tx.product.createMany({
    data: bulkRows((index) => ({
      id: bulkId("product", index),
      organizationId: ids.organization,
      categoryId: bulkId("productCategory", index),
      taxId: bulkId("tax", index),
      code: bulkCode("SKU", index),
      name: `Catalog Item ${index + 1}`,
      description: `Deterministic bulk catalog item ${index + 1}.`,
      type: cycle(
        [ProductType.HARDWARE, ProductType.SERVICE, ProductType.SUBSCRIPTION],
        index,
      ),
      unit: cycle(["each", "service", "month"], index),
      standardCost: bulkAmount(400, index, 15),
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.productVariant.createMany({
    data: bulkRows((index) => ({
      id: bulkId("productVariant", index),
      organizationId: ids.organization,
      productId: bulkId("product", index),
      sku: bulkCode("VAR", index),
      name: `Variant ${index + 1}`,
      attributes: { tier: cycle(["standard", "plus", "max"], index) },
      priceSurcharge: bulkAmount(0, index % 10, 20),
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  // `price_rules_target_check` allows exactly one of product or category.
  await tx.priceRule.createMany({
    data: bulkRows((index) => ({
      id: bulkId("priceRule", index),
      organizationId: ids.organization,
      priceListId: bulkId("priceList", index),
      productId: bulkId("product", index),
      categoryId: null,
      tierId: bulkId("customerTier", index),
      minQuantity: "1",
      unitPrice: bulkAmount(650, index, 20),
      priority: 10 + index,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.discountLimit.createMany({
    data: bulkRows((index) => ({
      id: bulkId("discountLimit", index),
      organizationId: ids.organization,
      name: `Bulk Discount Ceiling ${index + 1}`,
      tierId: bulkId("customerTier", index),
      categoryId: null,
      productId: bulkId("product", index),
      maxDiscountPercent: (5 + (index % 25)).toFixed(2),
      priority: 10 + index,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.promotion.createMany({
    data: bulkRows((index) => ({
      id: bulkId("promotion", index),
      organizationId: ids.organization,
      code: bulkCode("PROMO", index),
      name: `Seasonal Offer ${index + 1}`,
      priority: 10 + index,
      conditions: { minimumQuantity: 1 + (index % 5) },
      benefit: { discountPercent: 2 + (index % 8) },
      recommendationBoost: (index % 5).toFixed(2),
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.promotionProduct.createMany({
    data: bulkRows((index) => ({
      id: bulkId("promotionProduct", index),
      organizationId: ids.organization,
      promotionId: bulkId("promotion", index),
      productId: bulkId("product", index),
    })),
    skipDuplicates: true,
  });

  // `recommendation_rules_weights_check` requires the five weights to total 1.
  await tx.recommendationRule.createMany({
    data: bulkRows((index) => ({
      id: bulkId("recommendationRule", index),
      organizationId: ids.organization,
      productId: bulkId("product", index),
      code: bulkCode("RECO", index),
      name: `Attach Rule ${index + 1}`,
      version: 1,
      priority: 10 + index,
      affinityWeight: "0.2",
      marginWeight: "0.2",
      promotionWeight: "0.2",
      availabilityWeight: "0.2",
      stockAgeWeight: "0.2",
      minimumMargin: (10 + (index % 20)).toFixed(2),
      conditions: { minimumAvailability: 1 },
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  // `product_affinities_distinct_products_check` forbids self-pairing.
  await tx.productAffinity.createMany({
    data: bulkRows((index) => ({
      id: bulkId("productAffinity", index),
      organizationId: ids.organization,
      sourceProductId: bulkId("product", index),
      targetProductId: bulkId("product", (index + 1) % BULK_ROWS),
      affinityScore: (0.1 + (index % 9) * 0.1).toFixed(4),
      coPurchaseCount: 5 + index,
      effectiveFrom,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  // `inventory_balances_values_check` ties available to on hand minus reserved,
  // and the stocked/incoming checks require the matching timestamps.
  await tx.inventoryBalance.createMany({
    data: bulkRows((index) => ({
      id: bulkId("inventoryBalance", index),
      organizationId: ids.organization,
      warehouseId: bulkId("warehouse", index),
      productId: bulkId("product", index),
      variantId: bulkId("productVariant", index),
      onHand: "120",
      reserved: "20",
      available: "100",
      incoming: "40",
      incomingExpectedAt: bulkDate(30 + (index % 30)),
      stockedSince: bulkDate(index % 60),
    })),
    skipDuplicates: true,
  });

  await tx.stockMovement.createMany({
    data: bulkRows((index) => ({
      id: bulkId("stockMovement", index),
      organizationId: ids.organization,
      inventoryBalanceId: bulkId("inventoryBalance", index),
      warehouseId: bulkId("warehouse", index),
      productId: bulkId("product", index),
      variantId: bulkId("productVariant", index),
      actorId: bulkId("user", index),
      type: cycle(
        [StockMovementType.RECEIPT, StockMovementType.ADJUSTMENT],
        index,
      ),
      quantity: "120",
      reference: bulkCode("MOVE", index),
      reason: "Deterministic bulk opening stock.",
      onHandAfter: "120",
      reservedAfter: "20",
      metadata: { bulk: true },
      occurredAt: bulkDate(index % 60),
    })),
    skipDuplicates: true,
  });
}

interface BulkLineMath {
  costTotal: string;
  discountPercent: string;
  grossMargin: string;
  lineDiscountAmount: string;
  listUnitPrice: string;
  preTaxSubtotal: string;
  quantity: string;
  taxAmount: string;
  taxRate: string;
  total: string;
  unitCost: string;
  unitPrice: string;
}

/**
 * One shared calculation keeps a bulk quote line, its order line, and the
 * version totals consistent with the value checks in the schema.
 */
function bulkLineMath(index: number): BulkLineMath {
  const quantity = 1 + (index % 5);
  const listUnitPrice = 1000 + (index % 20) * 50;
  const discountPercent = index % 15;
  const unitPrice = listUnitPrice * (1 - discountPercent / 100);
  const unitCost = listUnitPrice * 0.6;
  const preTaxSubtotal = unitPrice * quantity;
  const taxRate = 18;
  const taxAmount = preTaxSubtotal * (taxRate / 100);

  return {
    costTotal: (unitCost * quantity).toFixed(2),
    discountPercent: discountPercent.toFixed(2),
    grossMargin: (preTaxSubtotal - unitCost * quantity).toFixed(2),
    lineDiscountAmount: ((listUnitPrice - unitPrice) * quantity).toFixed(2),
    listUnitPrice: listUnitPrice.toFixed(2),
    preTaxSubtotal: preTaxSubtotal.toFixed(2),
    quantity: quantity.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    taxRate: taxRate.toFixed(2),
    total: (preTaxSubtotal + taxAmount).toFixed(2),
    unitCost: unitCost.toFixed(2),
    unitPrice: unitPrice.toFixed(2),
  };
}

async function seedBulkCustomers(tx: Prisma.TransactionClient): Promise<void> {
  await tx.customerAccount.createMany({
    data: bulkRows((index) => ({
      id: bulkId("customerAccount", index),
      organizationId: ids.organization,
      tierId: bulkId("customerTier", index),
      salesTeamId: bulkId("salesTeam", index),
      assignedRepId: bulkId("user", index),
      accountCode: bulkCode("ACCT", index),
      name: bulkCompanyName(index),
      preferredCurrency: "USD",
      paymentTermsDays: cycle([15, 30, 45, 60], index),
      creditLimit: bulkAmount(50_000, index, 1_000),
      currentExposure: bulkAmount(5_000, index, 250),
      overdueBalance:
        index % 4 === 0 ? bulkAmount(1_000, index % 20, 500) : "0",
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  // One primary contact per account satisfies
  // `customer_contacts_one_active_primary_key`.
  await tx.customerContact.createMany({
    data: bulkRows((index) => ({
      id: bulkId("customerContact", index),
      organizationId: ids.organization,
      customerAccountId: bulkId("customerAccount", index),
      email: normalizeEmail(`bulk.buyer.${index + 1}@customer.demo`),
      firstName: cycle(BULK_FIRST_NAMES, index + 7),
      lastName: cycle(BULK_LAST_NAMES, index + 3),
      isPrimary: true,
      portalEnabled: true,
      status: ConfigurationStatus.ACTIVE,
    })),
    skipDuplicates: true,
  });

  await tx.portalIdentity.createMany({
    data: bulkRows((index) => ({
      id: bulkId("portalIdentity", index),
      organizationId: ids.organization,
      customerContactId: bulkId("customerContact", index),
      email: normalizeEmail(`bulk.buyer.${index + 1}@customer.demo`),
      status: PortalIdentityStatus.ACTIVE,
      lastLoginAt: bulkDate(index % 45),
    })),
    skipDuplicates: true,
  });

  await tx.session.createMany({
    data: bulkRows((index) => ({
      id: bulkId("session", index),
      organizationId: ids.organization,
      userId: bulkId("user", index),
      tokenHash: bulkHash("bulksession", index),
      expiresAt: bulkDate(400 + index),
      lastSeenAt: bulkDate(index % 45),
      metadata: { bulk: true },
    })),
    skipDuplicates: true,
  });

  await tx.refreshToken.createMany({
    data: bulkRows((index) => ({
      id: bulkId("refreshToken", index),
      organizationId: ids.organization,
      sessionId: bulkId("session", index),
      tokenHash: bulkHash("bulkrefresh", index),
      familyId: bulkId("session", index),
      expiresAt: bulkDate(400 + index),
    })),
    skipDuplicates: true,
  });

  await tx.portalSession.createMany({
    data: bulkRows((index) => ({
      id: bulkId("portalSession", index),
      organizationId: ids.organization,
      portalIdentityId: bulkId("portalIdentity", index),
      customerAccountId: bulkId("customerAccount", index),
      quoteId: null,
      tokenHash: bulkHash("bulkportal", index),
      expiresAt: bulkDate(400 + index),
    })),
    skipDuplicates: true,
  });

  // `magic_link_tokens_scope_check` pairs the CUSTOMER scope with a null quote.
  await tx.magicLinkToken.createMany({
    data: bulkRows((index) => ({
      id: bulkId("magicLinkToken", index),
      organizationId: ids.organization,
      portalIdentityId: bulkId("portalIdentity", index),
      customerAccountId: bulkId("customerAccount", index),
      quoteId: null,
      tokenHash: bulkHash("bulkmagic", index),
      scope: MagicLinkScope.CUSTOMER,
      maxUses: 3,
      useCount: index % 3,
      expiresAt: bulkDate(400 + index),
    })),
    skipDuplicates: true,
  });
}

async function seedBulkQuotes(tx: Prisma.TransactionClient): Promise<void> {
  await tx.quote.createMany({
    data: bulkRows((index) => ({
      id: bulkId("quote", index),
      organizationId: ids.organization,
      customerAccountId: bulkId("customerAccount", index),
      ownerId: bulkId("user", index),
      salesTeamId: bulkId("salesTeam", index),
      quoteNumber: bulkCode("Q-BULK", index),
      stage: cycle(
        [
          QuoteStage.DRAFT,
          QuoteStage.PENDING_APPROVAL,
          QuoteStage.REVISION_REQUIRED,
          QuoteStage.READY_TO_SEND,
          QuoteStage.SENT,
          QuoteStage.UNDER_NEGOTIATION,
          QuoteStage.CUSTOMER_ACCEPTED,
          QuoteStage.CONFIRMED,
          QuoteStage.EXPIRED,
          QuoteStage.CANCELLED,
        ],
        index,
      ),
      currentVersionId: null,
      currentRevision: 1,
      expiresAt: bulkDate(90 + (index % 60)),
      createdAt: bulkDate(index % 90),
      updatedAt: bulkDate((index % 90) + 2),
    })),
    skipDuplicates: true,
  });

  await tx.quoteVersion.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);

      return {
        id: bulkId("quoteVersion", index),
        organizationId: ids.organization,
        quoteId: bulkId("quote", index),
        customerAccountId: bulkId("customerAccount", index),
        createdById: bulkId("user", index),
        revisionNumber: 1,
        status: cycle(
          [
            QuoteVersionStatus.DRAFT,
            QuoteVersionStatus.PENDING_APPROVAL,
            QuoteVersionStatus.REVISION_REQUIRED,
            QuoteVersionStatus.READY_TO_SEND,
            QuoteVersionStatus.APPROVED,
            QuoteVersionStatus.CUSTOMER_ACCEPTED,
          ],
          index,
        ),
        currency: "USD",
        paymentTermsDays: cycle([15, 30, 45, 60], index),
        customerSnapshot: { name: bulkCompanyName(index) },
        pricingSnapshot: { priceListCode: bulkCode("PL", index) },
        subtotal: math.preTaxSubtotal,
        orderDiscountTotal: "0",
        lineDiscountTotal: math.lineDiscountAmount,
        taxTotal: math.taxAmount,
        total: math.total,
        costTotal: math.costTotal,
        grossMargin: math.grossMargin,
        marginPercent: (
          (Number(math.grossMargin) /
            Math.max(Number(math.preTaxSubtotal), 1)) *
          100
        ).toFixed(2),
        riskFacts: { blendedExcess: index % 12 },
        policySnapshot: { policyCode: bulkCode("POLICY", index) },
        termsFingerprint: bulkHash("terms", index),
        notes: `Bulk demo revision for quote ${index + 1}.`,
        createdAt: bulkDate(index % 90),
      };
    }),
    skipDuplicates: true,
  });

  // The composite foreign key requires the version row to exist before a quote
  // can point at it, so the pointer is set once versions are in place.
  for (let index = 0; index < BULK_ROWS; index += 1) {
    await tx.quote.update({
      data: { currentVersionId: bulkId("quoteVersion", index) },
      where: { id: bulkId("quote", index) },
    });
  }

  // `quote_lines_recurring_plan_check` requires a plan and snapshot whenever the
  // billing type is RECURRING, which every bulk line uses so the subscription
  // and billing chains below have a source.
  await tx.quoteLine.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);

      return {
        id: bulkId("quoteLine", index),
        organizationId: ids.organization,
        quoteVersionId: bulkId("quoteVersion", index),
        productId: bulkId("product", index),
        variantId: bulkId("productVariant", index),
        subscriptionPlanId: bulkId("subscriptionPlan", index),
        lineNumber: 1,
        productCode: bulkCode("SKU", index),
        productName: `Catalog Item ${index + 1}`,
        productDescription: `Deterministic bulk catalog item ${index + 1}.`,
        productType: ProductType.SUBSCRIPTION,
        categoryCode: bulkCode("CAT", index),
        sku: bulkCode("VAR", index),
        unit: "month",
        quantity: math.quantity,
        listUnitPrice: math.listUnitPrice,
        unitPrice: math.unitPrice,
        unitCost: math.unitCost,
        discountPercent: math.discountPercent,
        lineDiscountAmount: math.lineDiscountAmount,
        allocatedOrderDiscount: "0",
        preTaxSubtotal: math.preTaxSubtotal,
        taxCode: bulkCode("TAX", index),
        taxRate: math.taxRate,
        taxBehavior: TaxBehavior.EXCLUSIVE,
        taxAmount: math.taxAmount,
        total: math.total,
        costTotal: math.costTotal,
        grossMargin: math.grossMargin,
        billingType: BillingType.RECURRING,
        pricingSnapshot: { source: "BULK" },
        subscriptionSnapshot: bulkPlanSnapshot(index),
        createdAt: bulkDate(index % 90),
      };
    }),
    skipDuplicates: true,
  });

  await tx.quoteRiskAssessment.createMany({
    data: bulkRows((index) => ({
      id: bulkId("quoteRiskAssessment", index),
      organizationId: ids.organization,
      quoteVersionId: bulkId("quoteVersion", index),
      blendedExcess: (index % 12).toFixed(2),
      maximumLineExcess: (index % 12).toFixed(2),
      postDiscountMarginPercent: (20 + (index % 25)).toFixed(2),
      creditExposure: bulkAmount(5_000, index, 250),
      creditUtilizationPercent: (index % 100).toFixed(2),
      overdueBalance:
        index % 4 === 0 ? bulkAmount(1_000, index % 20, 500) : "0",
      representativeAnomaly: ((index % 30) / 100).toFixed(4),
      requiredRoute: { steps: ["SALES_MANAGER"] },
      calculatedAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.quoteLineRiskFact.createMany({
    data: bulkRows((index) => {
      const applied = index % 15;
      const allowed = 10;

      return {
        id: bulkId("quoteLineRiskFact", index),
        organizationId: ids.organization,
        assessmentId: bulkId("quoteRiskAssessment", index),
        quoteLineId: bulkId("quoteLine", index),
        appliedDiscountPercent: applied.toFixed(2),
        allowedDiscountPercent: allowed.toFixed(2),
        excessDiscountPercent: Math.max(0, applied - allowed).toFixed(2),
        preDiscountValue: bulkLineMath(index).preTaxSubtotal,
        weight: "1.0000",
        weightedExcess: Math.max(0, applied - allowed).toFixed(4),
        createdAt: bulkDate(index % 90),
      };
    }),
    skipDuplicates: true,
  });

  await tx.quoteLineRiskLimitMatch.createMany({
    data: bulkRows((index) => ({
      id: bulkId("quoteLineRiskLimitMatch", index),
      organizationId: ids.organization,
      lineRiskFactId: bulkId("quoteLineRiskFact", index),
      quoteLineId: bulkId("quoteLine", index),
      discountLimitId: bulkId("discountLimit", index),
      ruleSnapshot: { maxDiscountPercent: 5 + (index % 25) },
      reason: "Bulk discount ceiling evaluated for this line.",
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.approvalRequest.createMany({
    data: bulkRows((index) => ({
      id: bulkId("approvalRequest", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      quoteVersionId: bulkId("quoteVersion", index),
      termsFingerprint: bulkHash("terms", index),
      status: cycle(
        [
          ApprovalRequestStatus.PENDING,
          ApprovalRequestStatus.IN_PROGRESS,
          ApprovalRequestStatus.APPROVED,
          ApprovalRequestStatus.REJECTED,
          ApprovalRequestStatus.REVISION_REQUIRED,
        ],
        index,
      ),
      currentSequence: 1,
      ruleFacts: { blendedExcess: index % 12 },
      requiredRoute: { steps: ["SALES_MANAGER"] },
      decisionExplanation: { reasons: ["bulk demo volume"] },
      requestedAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.approvalRequestPolicyMatch.createMany({
    data: bulkRows((index) => ({
      id: bulkId("approvalRequestPolicyMatch", index),
      organizationId: ids.organization,
      approvalRequestId: bulkId("approvalRequest", index),
      approvalPolicyId: bulkId("approvalPolicy", index),
      policyVersion: 1,
      matchedFacts: { blendedExcess: index % 12 },
      reason: "Blended discount exceeded the configured ceiling.",
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.approvalStep.createMany({
    data: bulkRows((index) => ({
      id: bulkId("approvalStep", index),
      organizationId: ids.organization,
      approvalRequestId: bulkId("approvalRequest", index),
      approvalStepTemplateId: bulkId("approvalStepTemplate", index),
      sequence: 1,
      requiredCapability: cycle(
        ["approval.managerAct", "approval.financeAct"],
        index,
      ),
      requiredRole: cycle([Role.SALES_MANAGER, Role.FINANCE], index),
      assigneeId: bulkId("user", index),
      status: cycle(
        [
          ApprovalStepStatus.ACTIVE,
          ApprovalStepStatus.APPROVED,
          ApprovalStepStatus.WAITING,
          ApprovalStepStatus.REJECTED,
        ],
        index,
      ),
      dueAt: bulkDate((index % 90) + 3),
      activatedAt: bulkDate(index % 90),
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.approvalDecision.createMany({
    data: bulkRows((index) => ({
      id: bulkId("approvalDecision", index),
      organizationId: ids.organization,
      approvalRequestId: bulkId("approvalRequest", index),
      approvalStepId: bulkId("approvalStep", index),
      actorId: bulkId("user", index),
      action: cycle(
        [
          ApprovalDecisionAction.APPROVE,
          ApprovalDecisionAction.REJECT,
          ApprovalDecisionAction.REQUEST_REVISION,
        ],
        index,
      ),
      reason: "Recorded for bulk demo volume.",
      createdAt: bulkDate((index % 90) + 1),
    })),
    skipDuplicates: true,
  });

  await tx.recommendationInteraction.createMany({
    data: bulkRows((index) => ({
      id: bulkId("recommendationInteraction", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      quoteVersionId: bulkId("quoteVersion", index),
      productId: bulkId("product", (index + 2) % BULK_ROWS),
      actorType: ActorType.USER,
      actorId: bulkId("user", index),
      interaction: cycle(
        [
          RecommendationInteractionType.IMPRESSION,
          RecommendationInteractionType.ACCEPTANCE,
          RecommendationInteractionType.DISMISSAL,
        ],
        index,
      ),
      scoreSnapshot: { score: (index % 100) / 100 },
      expectedMarginDelta: bulkAmount(50, index % 40, 10),
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.negotiationThread.createMany({
    data: bulkRows((index) => ({
      id: bulkId("negotiationThread", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      customerAccountId: bulkId("customerAccount", index),
      status: cycle(
        [NegotiationThreadStatus.OPEN, NegotiationThreadStatus.CLOSED],
        index,
      ),
      openedAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  // `negotiation_messages_author_check` binds the author type to exactly one
  // author column.
  await tx.negotiationMessage.createMany({
    data: bulkRows((index) => ({
      id: bulkId("negotiationMessage", index),
      organizationId: ids.organization,
      threadId: bulkId("negotiationThread", index),
      quoteVersionId: bulkId("quoteVersion", index),
      quoteLineId: bulkId("quoteLine", index),
      authorType: ActorType.USER,
      authorUserId: bulkId("user", index),
      portalIdentityId: null,
      body: `Bulk negotiation note ${index + 1} covering pricing and terms.`,
      visibility: cycle([Visibility.BOTH, Visibility.INTERNAL], index),
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.changeRequest.createMany({
    data: bulkRows((index) => ({
      id: bulkId("changeRequest", index),
      organizationId: ids.organization,
      threadId: bulkId("negotiationThread", index),
      sourceQuoteVersionId: bulkId("quoteVersion", index),
      sourceTermsFingerprint: bulkHash("terms", index),
      requestedByPortalId: bulkId("portalIdentity", index),
      message: `Please revisit line pricing for quote ${index + 1}.`,
      status: cycle(
        [
          ChangeRequestStatus.PENDING,
          ChangeRequestStatus.COUNTERED,
          ChangeRequestStatus.ACCEPTED,
          ChangeRequestStatus.REJECTED,
        ],
        index,
      ),
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  // `change_request_items_payload_check` requires a positive quantity for the
  // CHANGE_QUANTITY action.
  await tx.changeRequestItem.createMany({
    data: bulkRows((index) => ({
      id: bulkId("changeRequestItem", index),
      organizationId: ids.organization,
      changeRequestId: bulkId("changeRequest", index),
      quoteLineId: bulkId("quoteLine", index),
      action: ChangeRequestAction.CHANGE_QUANTITY,
      requestedQuantity: (2 + (index % 6)).toFixed(2),
      createdAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.counteroffer.createMany({
    data: bulkRows((index) => ({
      id: bulkId("counteroffer", index),
      organizationId: ids.organization,
      changeRequestId: bulkId("changeRequest", index),
      sourceQuoteVersionId: bulkId("quoteVersion", index),
      sourceTermsFingerprint: bulkHash("terms", index),
      offeredByUserId: bulkId("user", index),
      message: `Counteroffer ${index + 1} with a revised volume commitment.`,
      status: cycle(
        [
          CounterofferStatus.PENDING,
          CounterofferStatus.ACCEPTED,
          CounterofferStatus.REJECTED,
          CounterofferStatus.EXPIRED,
        ],
        index,
      ),
      createdAt: bulkDate((index % 90) + 1),
    })),
    skipDuplicates: true,
  });

  // `counteroffer_items_payload_check` needs at least one proposed value.
  await tx.counterofferItem.createMany({
    data: bulkRows((index) => ({
      id: bulkId("counterofferItem", index),
      organizationId: ids.organization,
      counterofferId: bulkId("counteroffer", index),
      quoteLineId: bulkId("quoteLine", index),
      proposedQuantity: (2 + (index % 6)).toFixed(2),
      proposedDiscountPercent: (index % 12).toFixed(2),
      createdAt: bulkDate((index % 90) + 1),
    })),
    skipDuplicates: true,
  });

  await tx.customerAcceptance.createMany({
    data: bulkRows((index) => ({
      id: bulkId("customerAcceptance", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      quoteVersionId: bulkId("quoteVersion", index),
      portalIdentityId: bulkId("portalIdentity", index),
      acceptedFingerprint: bulkHash("terms", index),
      acceptedAt: bulkDate((index % 90) + 4),
    })),
    skipDuplicates: true,
  });
}

async function seedBulkOrders(tx: Prisma.TransactionClient): Promise<void> {
  await tx.order.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);

      return {
        id: bulkId("order", index),
        organizationId: ids.organization,
        quoteId: bulkId("quote", index),
        quoteVersionId: bulkId("quoteVersion", index),
        customerAccountId: bulkId("customerAccount", index),
        ownerId: bulkId("user", index),
        confirmedById: bulkId("user", index),
        orderNumber: bulkCode("SO-BULK", index),
        status: cycle(
          [
            OrderStatus.CONFIRMED,
            OrderStatus.ALLOCATION_PENDING,
            OrderStatus.RESERVED,
            OrderStatus.PARTIALLY_FULFILLED,
            OrderStatus.FULFILLED,
            OrderStatus.CANCELLED,
          ],
          index,
        ),
        termsFingerprint: bulkHash("terms", index),
        customerName: bulkCompanyName(index),
        currency: "USD",
        timezone: "UTC",
        paymentTermsDays: cycle([15, 30, 45, 60], index),
        subtotal: math.preTaxSubtotal,
        discountTotal: math.lineDiscountAmount,
        taxTotal: math.taxAmount,
        total: math.total,
        costTotal: math.costTotal,
        grossMargin: math.grossMargin,
        marginPercent: (
          (Number(math.grossMargin) /
            Math.max(Number(math.preTaxSubtotal), 1)) *
          100
        ).toFixed(2),
        confirmedAt: bulkDate((index % 90) + 5),
        createdAt: bulkDate((index % 90) + 5),
      };
    }),
    skipDuplicates: true,
  });

  // `order_lines_recurring_plan_check` mirrors the quote line rule.
  await tx.orderLine.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);

      return {
        id: bulkId("orderLine", index),
        organizationId: ids.organization,
        orderId: bulkId("order", index),
        quoteLineId: bulkId("quoteLine", index),
        productId: bulkId("product", index),
        variantId: bulkId("productVariant", index),
        subscriptionPlanId: bulkId("subscriptionPlan", index),
        position: 1,
        productCode: bulkCode("SKU", index),
        productName: `Catalog Item ${index + 1}`,
        productDescription: `Deterministic bulk catalog item ${index + 1}.`,
        sku: bulkCode("VAR", index),
        unit: "month",
        quantity: math.quantity,
        billingType: BillingType.RECURRING,
        subscriptionSnapshot: bulkPlanSnapshot(index),
        unitPrice: math.unitPrice,
        unitCost: math.unitCost,
        discountPercent: math.discountPercent,
        discountAmount: math.lineDiscountAmount,
        taxCode: bulkCode("TAX", index),
        taxRate: math.taxRate,
        taxBehavior: TaxBehavior.EXCLUSIVE,
        subtotal: math.preTaxSubtotal,
        taxAmount: math.taxAmount,
        total: math.total,
        costTotal: math.costTotal,
        createdAt: bulkDate((index % 90) + 5),
      };
    }),
    skipDuplicates: true,
  });

  // RECOMMENDED keeps `fulfillment_plans_manual_reason_check` satisfied without
  // an override reason.
  await tx.fulfillmentPlan.createMany({
    data: bulkRows((index) => ({
      id: bulkId("fulfillmentPlan", index),
      organizationId: ids.organization,
      orderId: bulkId("order", index),
      revision: 1,
      status: cycle(
        [
          FulfillmentPlanStatus.PREVIEW,
          FulfillmentPlanStatus.ACCEPTED,
          FulfillmentPlanStatus.SUPERSEDED,
        ],
        index,
      ),
      source: FulfillmentPlanSource.RECOMMENDED,
      recommendationSnapshot: { strategy: "LOWEST_COST" },
      availabilitySnapshot: { available: 100 },
      unfulfilledQuantity: "0",
      shipmentCount: 1,
      estimatedShippingCost: bulkAmount(40, index % 30, 5),
      estimatedPromiseAt: bulkDate((index % 90) + 12),
      acceptedById: bulkId("user", index),
      acceptedAt: bulkDate((index % 90) + 6),
      createdAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });

  await tx.fulfillmentAllocation.createMany({
    data: bulkRows((index) => ({
      id: bulkId("fulfillmentAllocation", index),
      organizationId: ids.organization,
      fulfillmentPlanId: bulkId("fulfillmentPlan", index),
      orderLineId: bulkId("orderLine", index),
      warehouseId: bulkId("warehouse", index),
      quantity: (1 + (index % 5)).toFixed(2),
      availableAtPreview: "100",
      estimatedCost: bulkAmount(40, index % 30, 5),
      estimatedDate: bulkDate((index % 90) + 12),
      createdAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });

  await tx.stockReservation.createMany({
    data: bulkRows((index) => ({
      id: bulkId("stockReservation", index),
      organizationId: ids.organization,
      orderLineId: bulkId("orderLine", index),
      warehouseId: bulkId("warehouse", index),
      inventoryBalanceId: bulkId("inventoryBalance", index),
      fulfillmentAllocationId: bulkId("fulfillmentAllocation", index),
      quantity: (1 + (index % 5)).toFixed(2),
      status: cycle(
        [
          StockReservationStatus.ACTIVE,
          StockReservationStatus.SHIPPED,
          StockReservationStatus.RELEASED,
        ],
        index,
      ),
      reservedAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });

  await tx.shipment.createMany({
    data: bulkRows((index) => ({
      id: bulkId("shipment", index),
      organizationId: ids.organization,
      orderId: bulkId("order", index),
      warehouseId: bulkId("warehouse", index),
      shipmentNumber: bulkCode("SH-BULK", index),
      status: cycle(
        [
          ShipmentStatus.PLANNED,
          ShipmentStatus.READY,
          ShipmentStatus.SHIPPED,
          ShipmentStatus.DELIVERED,
        ],
        index,
      ),
      promisedDate: bulkDate((index % 90) + 12),
      actualDate: index % 4 >= 2 ? bulkDate((index % 90) + 13) : null,
      trackingNumber: bulkCode("TRK", index),
      estimatedShippingCost: bulkAmount(40, index % 30, 5),
      createdAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });

  await tx.shipmentItem.createMany({
    data: bulkRows((index) => ({
      id: bulkId("shipmentItem", index),
      organizationId: ids.organization,
      shipmentId: bulkId("shipment", index),
      orderLineId: bulkId("orderLine", index),
      stockReservationId: bulkId("stockReservation", index),
      quantity: (1 + (index % 5)).toFixed(2),
      createdAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });

  // `backorders_quantity_check` keeps OPEN work strictly positive.
  await tx.backorder.createMany({
    data: bulkRows((index) => ({
      id: bulkId("backorder", index),
      organizationId: ids.organization,
      orderId: bulkId("order", index),
      orderLineId: bulkId("orderLine", index),
      remainingQuantity: (1 + (index % 4)).toFixed(2),
      status: cycle(
        [BackorderStatus.OPEN, BackorderStatus.PARTIALLY_ALLOCATED],
        index,
      ),
      expectedAt: bulkDate((index % 90) + 20),
      createdAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });
}

async function seedBulkBilling(tx: Prisma.TransactionClient): Promise<void> {
  await tx.subscription.createMany({
    data: bulkRows((index) => ({
      id: bulkId("subscription", index),
      organizationId: ids.organization,
      orderId: bulkId("order", index),
      customerAccountId: bulkId("customerAccount", index),
      subscriptionPlanId: bulkId("subscriptionPlan", index),
      subscriptionNumber: bulkCode("SUB-BULK", index),
      status: cycle(
        [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PENDING,
          SubscriptionStatus.CHANGE_SCHEDULED,
          SubscriptionStatus.CANCELLATION_SCHEDULED,
          SubscriptionStatus.CANCELLED,
        ],
        index,
      ),
      currency: "USD",
      timezone: "UTC",
      planSnapshot: bulkPlanSnapshot(index),
      startedAt: bulkDate((index % 90) + 6),
      currentPeriodStart: bulkDate((index % 90) + 6),
      currentPeriodEnd: bulkDate((index % 90) + 36),
      nextBillingAt: bulkDate((index % 90) + 36),
      billingAnchorDay: 1 + (index % 28),
      createdAt: bulkDate((index % 90) + 6),
    })),
    skipDuplicates: true,
  });

  await tx.subscriptionItem.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);

      return {
        id: bulkId("subscriptionItem", index),
        organizationId: ids.organization,
        subscriptionId: bulkId("subscription", index),
        orderLineId: bulkId("orderLine", index),
        productId: bulkId("product", index),
        variantId: bulkId("productVariant", index),
        subscriptionPlanId: bulkId("subscriptionPlan", index),
        sku: bulkCode("VAR", index),
        productName: `Catalog Item ${index + 1}`,
        unit: "month",
        quantity: math.quantity,
        unitPrice: math.unitPrice,
        taxSnapshot: { code: bulkCode("TAX", index), rate: 18 },
        activeFrom: bulkDate((index % 90) + 6),
        activeTo: null,
      };
    }),
    skipDuplicates: true,
  });

  // `subscription_changes_days_check` bounds the billable days by the period.
  await tx.subscriptionChange.createMany({
    data: bulkRows((index) => ({
      id: bulkId("subscriptionChange", index),
      organizationId: ids.organization,
      subscriptionId: bulkId("subscription", index),
      subscriptionItemId: bulkId("subscriptionItem", index),
      actorId: bulkId("user", index),
      type: cycle(
        [
          SubscriptionChangeType.QUANTITY_CHANGE,
          SubscriptionChangeType.PLAN_CHANGE,
          SubscriptionChangeType.CANCELLATION,
        ],
        index,
      ),
      status: SubscriptionChangeStatus.APPLIED,
      effectiveAt: bulkDate((index % 90) + 16),
      reason: "Bulk demo subscription adjustment.",
      oldQuantity: (1 + (index % 5)).toFixed(2),
      newQuantity: (2 + (index % 5)).toFixed(2),
      periodStart: bulkDate((index % 90) + 6),
      periodEnd: bulkDate((index % 90) + 36),
      timezone: "UTC",
      remainingBillableDays: index % 31,
      totalDays: 30,
      prorationConvention: ProrationConvention.CALENDAR_DAYS,
      unroundedAmount: bulkAmount(100, index % 40, 7),
      roundedAmount: bulkAmount(100, index % 40, 7),
      direction: cycle(
        [
          ProrationDirection.DEBIT,
          ProrationDirection.CREDIT,
          ProrationDirection.NONE,
        ],
        index,
      ),
      calculationSnapshot: { convention: "CALENDAR_DAYS" },
      createdAt: bulkDate((index % 90) + 16),
    })),
    skipDuplicates: true,
  });

  // RECURRING invoices must carry a subscription and a complete billing period.
  await tx.invoice.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);
      const total = Number(math.total);
      const status = cycle(
        [
          InvoiceStatus.ISSUED,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
          InvoiceStatus.OVERDUE,
        ],
        index,
      );
      const amountPaid =
        status === InvoiceStatus.PAID
          ? total
          : status === InvoiceStatus.PARTIALLY_PAID
            ? Math.round(total * 50) / 100
            : 0;

      return {
        id: bulkId("invoice", index),
        organizationId: ids.organization,
        customerAccountId: bulkId("customerAccount", index),
        orderId: bulkId("order", index),
        subscriptionId: bulkId("subscription", index),
        invoiceNumber: bulkCode("INV-BULK", index),
        type: InvoiceType.RECURRING,
        status,
        currency: "USD",
        billingPeriodStart: bulkDate((index % 90) + 6),
        billingPeriodEnd: bulkDate((index % 90) + 36),
        subtotal: math.preTaxSubtotal,
        discountAmount: "0",
        taxAmount: math.taxAmount,
        total: math.total,
        amountPaid: amountPaid.toFixed(2),
        balanceDue: (total - amountPaid).toFixed(2),
        calculationSnapshot: { source: "BULK" },
        dueDate: bulkDate((index % 90) + 46),
        issuedAt: bulkDate((index % 90) + 16),
        paidAt:
          status === InvoiceStatus.PAID ? bulkDate((index % 90) + 26) : null,
        createdAt: bulkDate((index % 90) + 16),
      };
    }),
    skipDuplicates: true,
  });

  await tx.invoiceLine.createMany({
    data: bulkRows((index) => {
      const math = bulkLineMath(index);

      return {
        id: bulkId("invoiceLine", index),
        organizationId: ids.organization,
        invoiceId: bulkId("invoice", index),
        orderLineId: bulkId("orderLine", index),
        subscriptionItemId: bulkId("subscriptionItem", index),
        position: 1,
        description: `Catalog Item ${index + 1} subscription period`,
        sku: bulkCode("VAR", index),
        unit: "month",
        billingType: BillingType.RECURRING,
        quantity: math.quantity,
        unitPrice: math.unitPrice,
        discountAmount: "0",
        subtotal: math.preTaxSubtotal,
        taxSnapshot: { code: bulkCode("TAX", index), rate: 18 },
        taxAmount: math.taxAmount,
        total: math.total,
        billingPeriodStart: bulkDate((index % 90) + 6),
        billingPeriodEnd: bulkDate((index % 90) + 36),
        createdAt: bulkDate((index % 90) + 16),
      };
    }),
    skipDuplicates: true,
  });

  await tx.billingSchedule.createMany({
    data: bulkRows((index) => ({
      id: bulkId("billingSchedule", index),
      organizationId: ids.organization,
      subscriptionId: bulkId("subscription", index),
      invoiceId: bulkId("invoice", index),
      periodStart: bulkDate((index % 90) + 6),
      periodEnd: bulkDate((index % 90) + 36),
      dueDate: bulkDate((index % 90) + 46),
      amount: bulkLineMath(index).total,
      currency: "USD",
      generationStatus: BillingScheduleStatus.GENERATED,
      calculationSnapshot: { source: "BULK" },
      generatedAt: bulkDate((index % 90) + 16),
    })),
    skipDuplicates: true,
  });

  await tx.creditNote.createMany({
    data: bulkRows((index) => {
      const credit = Math.round(Number(bulkLineMath(index).total) * 10) / 100;

      return {
        id: bulkId("creditNote", index),
        organizationId: ids.organization,
        sourceInvoiceId: bulkId("invoice", index),
        creditNoteNumber: bulkCode("CN-BULK", index),
        status: cycle(
          [
            CreditNoteStatus.ISSUED,
            CreditNoteStatus.APPLIED,
            CreditNoteStatus.DRAFT,
          ],
          index,
        ),
        currency: "USD",
        subtotal: credit.toFixed(2),
        taxAmount: "0",
        total: credit.toFixed(2),
        reason: "Bulk demo goodwill adjustment.",
        issuedAt: bulkDate((index % 90) + 20),
        createdAt: bulkDate((index % 90) + 20),
      };
    }),
    skipDuplicates: true,
  });

  await tx.creditNoteLine.createMany({
    data: bulkRows((index) => {
      const credit = Math.round(Number(bulkLineMath(index).total) * 10) / 100;

      return {
        id: bulkId("creditNoteLine", index),
        organizationId: ids.organization,
        creditNoteId: bulkId("creditNote", index),
        sourceInvoiceLineId: bulkId("invoiceLine", index),
        position: 1,
        description: `Goodwill credit for catalog item ${index + 1}`,
        quantity: "1",
        unitAmount: credit.toFixed(2),
        taxAmount: "0",
        total: credit.toFixed(2),
        createdAt: bulkDate((index % 90) + 20),
      };
    }),
    skipDuplicates: true,
  });

  // `payments_amount_check` requires a strictly positive amount.
  await tx.payment.createMany({
    data: bulkRows((index) => ({
      id: bulkId("payment", index),
      organizationId: ids.organization,
      invoiceId: bulkId("invoice", index),
      recordedById: bulkId("user", index),
      amount: Math.max(
        Math.round(Number(bulkLineMath(index).total) * 25) / 100,
        1,
      ).toFixed(2),
      currency: "USD",
      method: cycle(
        [
          PaymentMethod.BANK_TRANSFER,
          PaymentMethod.CREDIT_CARD,
          PaymentMethod.CHECK,
          PaymentMethod.OTHER,
        ],
        index,
      ),
      reference: bulkCode("PAY", index),
      status: cycle(
        [
          PaymentStatus.RECORDED,
          PaymentStatus.RECORDED,
          PaymentStatus.REVERSED,
        ],
        index,
      ),
      paymentDate: bulkDate((index % 90) + 22),
      createdAt: bulkDate((index % 90) + 22),
    })),
    skipDuplicates: true,
  });
}

async function seedBulkOperations(tx: Prisma.TransactionClient): Promise<void> {
  await tx.dealHealthSnapshot.createMany({
    data: bulkRows((index) => ({
      id: bulkId("dealHealthSnapshot", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      reason: cycle(
        ["STALLED_DEAL", "DISCOUNT_ANOMALY", "APPROVAL_SLA", "CREDIT_EXPOSURE"],
        index,
      ),
      healthScore: (index % 101).toFixed(2),
      stalledDays: index % 30,
      discountAnomalyScore: ((index % 40) / 100).toFixed(4),
      approvalSlaHoursOverdue: index % 48,
      promiseSlippageDays: index % 12,
      creditExposure: bulkAmount(5_000, index, 250),
      facts: { bulk: true },
      calculatedAt: bulkDate((index % 90) + 8),
    })),
    skipDuplicates: true,
  });

  await tx.alert.createMany({
    data: bulkRows((index) => ({
      id: bulkId("alert", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      dealHealthSnapshotId: bulkId("dealHealthSnapshot", index),
      type: cycle(
        [
          AlertType.STALLED_DEAL,
          AlertType.DISCOUNT_ANOMALY,
          AlertType.APPROVAL_SLA,
          AlertType.PROMISE_SLIPPAGE,
          AlertType.CREDIT_EXPOSURE,
        ],
        index,
      ),
      severity: cycle(
        [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.CRITICAL],
        index,
      ),
      status: cycle(
        [
          AlertStatus.OPEN,
          AlertStatus.ACKNOWLEDGED,
          AlertStatus.SNOOZED,
          AlertStatus.RESOLVED,
        ],
        index,
      ),
      reasonCode: cycle(
        ["STALLED", "ANOMALY", "SLA_BREACH", "SLIPPAGE", "EXPOSURE"],
        index,
      ),
      title: `Bulk alert ${index + 1}`,
      message: `Deterministic bulk alert ${index + 1} raised for review.`,
      facts: { bulk: true },
      detectedAt: bulkDate((index % 90) + 8),
    })),
    skipDuplicates: true,
  });

  // `nudges_recipient_check` allows exactly one recipient column.
  await tx.nudge.createMany({
    data: bulkRows((index) => ({
      id: bulkId("nudge", index),
      organizationId: ids.organization,
      alertId: bulkId("alert", index),
      requestedById: bulkId("user", index),
      recipientUserId: bulkId("user", (index + 1) % BULK_ROWS),
      recipientContactId: null,
      channel: cycle([NudgeChannel.IN_APP, NudgeChannel.EMAIL], index),
      message: `Please review bulk alert ${index + 1}.`,
      status: cycle([NudgeStatus.SENT, NudgeStatus.QUEUED], index),
      requestedAt: bulkDate((index % 90) + 9),
      sentAt: index % 2 === 0 ? bulkDate((index % 90) + 9) : null,
    })),
    skipDuplicates: true,
  });

  await tx.auditEvent.createMany({
    data: bulkRows((index) => ({
      id: bulkId("auditEvent", index),
      organizationId: ids.organization,
      actorType: ActorType.USER,
      actorId: bulkId("user", index),
      actorName: `${cycle(BULK_FIRST_NAMES, index)} ${cycle(BULK_LAST_NAMES, index)}`,
      entityType: "Quote",
      entityId: bulkId("quote", index),
      entityVersion: 1,
      termsFingerprint: bulkHash("terms", index),
      eventType: cycle(
        ["quote.created", "quote.updated", "quote.submitted", "quote.approved"],
        index,
      ),
      reason: "Bulk demo audit trail.",
      metadata: { bulk: true },
      occurredAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  await tx.dealEvent.createMany({
    data: bulkRows((index) => ({
      id: bulkId("dealEvent", index),
      organizationId: ids.organization,
      quoteId: bulkId("quote", index),
      visibility: cycle([Visibility.BOTH, Visibility.INTERNAL], index),
      eventType: cycle(
        ["quote.created", "quote.sent", "quote.negotiated", "quote.confirmed"],
        index,
      ),
      title: `Bulk timeline entry ${index + 1}`,
      message: `Deterministic bulk timeline entry ${index + 1}.`,
      actorType: ActorType.USER,
      actorId: bulkId("user", index),
      sourceEntityType: "QuoteVersion",
      sourceEntityId: bulkId("quoteVersion", index),
      sourceVersion: 1,
      metadata: { bulk: true },
      occurredAt: bulkDate(index % 90),
    })),
    skipDuplicates: true,
  });

  // `outbox_events_attempts_check` keeps attempts within the retry budget.
  await tx.outboxEvent.createMany({
    data: bulkRows((index) => ({
      id: bulkId("outboxEvent", index),
      organizationId: ids.organization,
      eventType: cycle(
        ["quote.confirmed", "order.created", "invoice.issued"],
        index,
      ),
      aggregateType: "Quote",
      aggregateId: bulkId("quote", index),
      deduplicationKey: bulkCode("bulk-outbox", index),
      payload: { quoteId: bulkId("quote", index), bulk: true },
      status: cycle(
        [
          OutboxEventStatus.PROCESSED,
          OutboxEventStatus.PENDING,
          OutboxEventStatus.FAILED,
        ],
        index,
      ),
      attempts: index % 4,
      maxAttempts: 5,
      availableAt: bulkDate(index % 90),
      processedAt: index % 3 === 0 ? bulkDate((index % 90) + 1) : null,
    })),
    skipDuplicates: true,
  });

  await tx.idempotencyRecord.createMany({
    data: bulkRows((index) => ({
      id: bulkId("idempotencyRecord", index),
      organizationId: ids.organization,
      key: bulkCode("bulk-idem", index),
      actorType: ActorType.USER,
      actorId: bulkId("user", index),
      command: cycle(["quote.submit", "quote.confirm", "invoice.pay"], index),
      requestFingerprint: bulkHash("request", index),
      status: cycle(
        [IdempotencyStatus.COMPLETED, IdempotencyStatus.IN_PROGRESS],
        index,
      ),
      resultEntityType: "Quote",
      resultEntityId: bulkId("quote", index),
      responseStatus: cycle([200, 201, 409], index),
      responseBody: { ok: true },
      expiresAt: bulkDate(400 + index),
    })),
    skipDuplicates: true,
  });

  await tx.exportJob.createMany({
    data: bulkRows((index) => ({
      id: bulkId("exportJob", index),
      organizationId: ids.organization,
      requestedById: bulkId("user", index),
      reportType: cycle(
        [
          ReportType.QUOTES,
          ReportType.ORDERS,
          ReportType.INVOICES,
          ReportType.CUSTOMERS,
          ReportType.INVENTORY,
        ],
        index,
      ),
      format: cycle(
        [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
        index,
      ),
      filters: { bulk: true },
      status: ExportJobStatus.COMPLETED,
      progress: 100,
      resultLocation: `artifact://${bulkId("exportJob", index)}`,
      startedAt: bulkDate((index % 90) + 10),
      completedAt: bulkDate((index % 90) + 10),
      expiresAt: bulkDate(400 + index),
    })),
    skipDuplicates: true,
  });

  await tx.exportArtifact.createMany({
    data: bulkRows((index) => ({
      exportJobId: bulkId("exportJob", index),
      organizationId: ids.organization,
      content: new TextEncoder().encode(
        `quote_number,total\n${bulkCode("Q-BULK", index)},${bulkLineMath(index).total}\n`,
      ),
      contentType: "text/csv",
      filename: `${bulkCode("bulk-export", index)}.csv`,
      rowCount: 1,
      createdAt: bulkDate((index % 90) + 10),
    })),
    skipDuplicates: true,
  });

  // `notifications_recipient_check` allows exactly one recipient column.
  await tx.notification.createMany({
    data: bulkRows((index) => ({
      id: bulkId("notification", index),
      organizationId: ids.organization,
      recipientUserId: bulkId("user", index),
      recipientPortalIdentityId: null,
      channel: cycle(
        [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        index,
      ),
      type: cycle(
        ["approval.requested", "quote.accepted", "invoice.overdue"],
        index,
      ),
      title: `Bulk notification ${index + 1}`,
      body: `Deterministic bulk notification ${index + 1}.`,
      data: { quoteId: bulkId("quote", index) },
      status: cycle(
        [NotificationStatus.SENT, NotificationStatus.QUEUED],
        index,
      ),
      readAt: index % 3 === 0 ? bulkDate((index % 90) + 11) : null,
      sentAt: bulkDate((index % 90) + 11),
      createdAt: bulkDate((index % 90) + 11),
    })),
    skipDuplicates: true,
  });

  await tx.savedReportFilter.createMany({
    data: bulkRows((index) => ({
      id: bulkId("savedReportFilter", index),
      organizationId: ids.organization,
      userId: bulkId("user", index),
      name: `Bulk saved view ${index + 1}`,
      reportType: cycle(
        [
          ReportType.QUOTES,
          ReportType.ORDERS,
          ReportType.INVOICES,
          ReportType.CUSTOMERS,
          ReportType.INVENTORY,
        ],
        index,
      ),
      filters: { bulk: true, index },
    })),
    skipDuplicates: true,
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled when NODE_ENV=production.");
  }

  const { schema } = getDatabaseSettings();
  const isVerificationSchema = schema.startsWith(
    `${DEFAULT_DATABASE_SCHEMA}_verify_`,
  );

  if (schema !== DEFAULT_DATABASE_SCHEMA && !isVerificationSchema) {
    throw new Error(
      `Demo seeding only runs in ${DEFAULT_DATABASE_SCHEMA} or its disposable verification schemas.`,
    );
  }

  await prisma.$transaction((tx) => seedDemo(tx), {
    maxWait: 10_000,
    timeout: 60_000,
  });

  console.info("DealFlow360 demo data is ready.");
}

if (import.meta.main) {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}
