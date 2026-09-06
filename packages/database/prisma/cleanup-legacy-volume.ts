import { prisma } from "../src/client.js";
import {
  getDatabaseSettings,
  DEFAULT_DATABASE_SCHEMA,
} from "../src/database-url.js";
import { DEMO_TABLES_CHILD_FIRST } from "./demo-reset.js";

// Exact reserved IDs from the retired per-table stress fixture. No CASCADE,
// schema operations, or tenant-wide deletes: real references force rollback.
const legacyModels = [
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
];
const demoId = (sequence: number) =>
  `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
const idsFor = (model: string) => {
  const offset = legacyModels.indexOf(model);
  if (offset < 0) throw new Error(`Unknown legacy model: ${model}`);
  return Array.from({ length: 275 }, (_, index) =>
    demoId(1_000_000 + offset * 10_000 + index),
  );
};

export async function cleanupLegacyVolume() {
  const { schema } = getDatabaseSettings();
  if (
    process.env.NODE_ENV === "production" ||
    schema !== DEFAULT_DATABASE_SCHEMA
  )
    throw new Error("Legacy cleanup is restricted to the local demo schema");
  await prisma.$transaction(
    async (tx) => {
      for (const [table, model, column] of [
        ["quotes", "quote", "current_version_id"],
        ["refresh_tokens", "refreshToken", "replaced_by_token_id"],
        ["backorders", "backorder", "consolidated_into_id"],
        ["product_categories", "productCategory", "parent_id"],
      ]) {
        await tx.$executeRawUnsafe(
          `UPDATE "${schema}"."${table}" SET "${column}" = NULL WHERE organization_id = $1::uuid AND id = ANY($2::uuid[])`,
          demoId(1),
          idsFor(model!),
        );
      }
      for (const table of [...DEMO_TABLES_CHILD_FIRST, "organizations"]) {
        const legacyName =
          table === "export_artifacts"
            ? "exportJob"
            : legacyModels.find((name) => {
                const snake = name.replace(
                  /[A-Z]/g,
                  (letter) => `_${letter.toLowerCase()}`,
                );
                return (
                  (snake.endsWith("y")
                    ? `${snake.slice(0, -1)}ies`
                    : snake.endsWith("ch") || snake.endsWith("x")
                      ? `${snake}es`
                      : `${snake}s`) === table
                );
              });
        if (!legacyName) throw new Error(`Missing model for ${table}`);
        const column = table === "export_artifacts" ? "export_job_id" : "id";
        const ids = idsFor(legacyName);
        if (table === "users") {
          // Worker-created notifications are history; retain their recipients.
          await tx.$executeRawUnsafe(
            `DELETE FROM "${schema}"."users" u WHERE u.id = ANY($1::uuid[]) AND u.organization_id = $2::uuid AND NOT EXISTS (SELECT 1 FROM "${schema}"."notifications" n WHERE n.recipient_user_id = u.id)`,
            ids,
            demoId(1),
          );
          continue;
        }
        await tx.$executeRawUnsafe(
          `DELETE FROM "${schema}"."${table}" WHERE "${column}" = ANY($1::uuid[])${table === "organizations" ? "" : " AND organization_id = $2::uuid"}`,
          ...(table === "organizations" ? [ids] : [ids, demoId(1)]),
        );
      }
    },
    { timeout: 120_000 },
  );
}

if (import.meta.main) {
  try {
    await cleanupLegacyVolume();
    console.info("Removed only reserved legacy stress fixtures.");
  } finally {
    await prisma.$disconnect();
  }
}
