import { prisma } from "../src/client.js";
import {
  DEFAULT_DATABASE_SCHEMA,
  getDatabaseSettings,
} from "../src/database-url.js";
import { DEMO_ORGANIZATION_ID, seedDemo } from "./seed.js";

export const DEMO_TABLES_CHILD_FIRST = [
  "notifications",
  "saved_report_filters",
  "export_artifacts",
  "export_jobs",
  "idempotency_records",
  "outbox_events",
  "deal_events",
  "audit_events",
  "nudges",
  "alerts",
  "deal_health_snapshots",
  "payments",
  "credit_note_lines",
  "credit_notes",
  "billing_schedules",
  "invoice_lines",
  "invoices",
  "subscription_changes",
  "subscription_items",
  "subscriptions",
  "shipment_items",
  "stock_movements",
  "stock_reservations",
  "shipments",
  "backorders",
  "fulfillment_allocations",
  "fulfillment_plans",
  "inventory_balances",
  "warehouses",
  "order_lines",
  "orders",
  "customer_acceptances",
  "counteroffer_items",
  "counteroffers",
  "change_request_items",
  "change_requests",
  "negotiation_messages",
  "negotiation_threads",
  "recommendation_interactions",
  "approval_decisions",
  "approval_steps",
  "approval_request_policy_matches",
  "approval_requests",
  "approval_step_templates",
  "approval_policies",
  "quote_line_risk_limit_matches",
  "quote_line_risk_facts",
  "quote_risk_assessments",
  "quote_lines",
  "quote_versions",
  "portal_sessions",
  "magic_link_tokens",
  "quotes",
  "refresh_tokens",
  "sessions",
  "promotion_products",
  "promotions",
  "product_affinities",
  "recommendation_rules",
  "discount_limits",
  "price_rules",
  "price_lists",
  "product_variants",
  "products",
  "subscription_plans",
  "taxes",
  "product_categories",
  "portal_identities",
  "customer_contacts",
  "customer_accounts",
  "customer_tiers",
  "role_assignments",
  "sales_teams",
  "users",
] as const;

async function resetDemo(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo reset is disabled when NODE_ENV=production.");
  }

  const { schema } = getDatabaseSettings();

  if (schema === "public" || schema !== DEFAULT_DATABASE_SCHEMA) {
    throw new Error(
      `The demo reset only runs in the isolated ${DEFAULT_DATABASE_SCHEMA} schema.`,
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}"."quotes" SET "current_version_id" = NULL WHERE "organization_id" = $1`,
        DEMO_ORGANIZATION_ID,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}"."refresh_tokens" SET "replaced_by_token_id" = NULL WHERE "organization_id" = $1`,
        DEMO_ORGANIZATION_ID,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}"."backorders" SET "consolidated_into_id" = NULL WHERE "organization_id" = $1`,
        DEMO_ORGANIZATION_ID,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}"."product_categories" SET "parent_id" = NULL WHERE "organization_id" = $1`,
        DEMO_ORGANIZATION_ID,
      );

      for (const table of DEMO_TABLES_CHILD_FIRST) {
        await tx.$executeRawUnsafe(
          `DELETE FROM "${schema}"."${table}" WHERE "organization_id" = $1`,
          DEMO_ORGANIZATION_ID,
        );
      }

      await tx.organization.deleteMany({
        where: { id: DEMO_ORGANIZATION_ID },
      });

      await seedDemo(tx);
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  );

  console.info("DealFlow360 demo organization was safely recreated.");
}

if (import.meta.main) {
  try {
    await resetDemo();
  } finally {
    await prisma.$disconnect();
  }
}
