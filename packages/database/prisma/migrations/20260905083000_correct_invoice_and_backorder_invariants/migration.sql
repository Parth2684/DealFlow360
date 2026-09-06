-- Recurring schedule generation is unique per subscription period. Proration
-- adjustments are separate commercial events and may legitimately share a period.
DROP INDEX "users_organization_id_email_key";

CREATE UNIQUE INDEX "users_email_key"
ON "users"("email");

DROP INDEX "invoices_recurring_period_key";

CREATE UNIQUE INDEX "invoices_recurring_period_key"
ON "invoices"(
  "organization_id",
  "subscription_id",
  "billing_period_start",
  "billing_period_end"
)
WHERE "type" = 'RECURRING'
  AND "subscription_id" IS NOT NULL
  AND "billing_period_start" IS NOT NULL
  AND "billing_period_end" IS NOT NULL;

-- Open work must retain a positive quantity. A fulfilled backorder reaches zero,
-- while a consolidated record remains linked to the surviving backorder.
ALTER TABLE "backorders"
DROP CONSTRAINT "backorders_quantity_check",
ADD CONSTRAINT "backorders_quantity_check"
CHECK (
  "remaining_quantity" >= 0
  AND (
    "status" NOT IN ('OPEN', 'PARTIALLY_ALLOCATED')
    OR "remaining_quantity" > 0
  )
  AND (
    "status" <> 'FULFILLED'
    OR ("remaining_quantity" = 0 AND "fulfilled_at" IS NOT NULL)
  )
  AND (
    "status" <> 'CONSOLIDATED'
    OR "consolidated_into_id" IS NOT NULL
  )
);
