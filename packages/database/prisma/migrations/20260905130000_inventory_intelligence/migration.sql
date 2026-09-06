ALTER TABLE "recommendation_rules"
ADD COLUMN "stock_age_weight" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "recommendation_rules"
DROP CONSTRAINT "recommendation_rules_weights_check";

ALTER TABLE "recommendation_rules"
ADD CONSTRAINT "recommendation_rules_weights_check"
CHECK (
  "affinity_weight" >= 0
  AND "margin_weight" >= 0
  AND "promotion_weight" >= 0
  AND "availability_weight" >= 0
  AND "stock_age_weight" >= 0
  AND "affinity_weight" + "margin_weight" + "promotion_weight"
    + "availability_weight" + "stock_age_weight" = 1
);

ALTER TABLE "inventory_balances"
ADD COLUMN "incoming_expected_at" TIMESTAMPTZ(3),
ADD COLUMN "stocked_since" TIMESTAMPTZ(3);

UPDATE "inventory_balances" AS balance
SET "stocked_since" = COALESCE(
  (
    SELECT MIN(movement."occurred_at")
    FROM "stock_movements" AS movement
    WHERE movement."inventory_balance_id" = balance."id"
      AND movement."type" = 'RECEIPT'
      AND movement."quantity" > 0
      AND movement."occurred_at" > COALESCE(
        (
          SELECT MAX(empty_movement."occurred_at")
          FROM "stock_movements" AS empty_movement
          WHERE empty_movement."inventory_balance_id" = balance."id"
            AND empty_movement."on_hand_after" = 0
        ),
        '-infinity'::timestamptz
      )
  ),
  balance."created_at"
)
WHERE balance."on_hand" > 0;

-- Existing incoming values had no ETA field, so they cannot truthfully support
-- promise-date calculations. Clear those unverifiable projections before the
-- complete quantity/ETA invariant is installed.
UPDATE "inventory_balances"
SET "incoming" = 0
WHERE "incoming" > 0
  AND "incoming_expected_at" IS NULL;

ALTER TABLE "inventory_balances"
ADD CONSTRAINT "inventory_balances_stocked_since_check"
CHECK (
  ("on_hand" = 0 AND "stocked_since" IS NULL)
  OR ("on_hand" > 0 AND "stocked_since" IS NOT NULL)
),
ADD CONSTRAINT "inventory_balances_incoming_eta_check"
CHECK (
  ("incoming" = 0 AND "incoming_expected_at" IS NULL)
  OR ("incoming" > 0 AND "incoming_expected_at" IS NOT NULL)
);

CREATE INDEX "inventory_balances_organization_id_incoming_expected_at_idx"
ON "inventory_balances"("organization_id", "incoming_expected_at");
