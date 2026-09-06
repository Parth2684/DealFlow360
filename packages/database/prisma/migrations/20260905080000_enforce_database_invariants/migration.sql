-- Bind a quote's current version to a version that belongs to that same quote.
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_current_version_id_fkey";

CREATE UNIQUE INDEX "quote_versions_id_quote_id_key"
ON "quote_versions"("id", "quote_id");

CREATE UNIQUE INDEX "quotes_current_version_id_id_key"
ON "quotes"("current_version_id", "id");

ALTER TABLE "quotes"
ADD CONSTRAINT "quotes_current_version_id_id_fkey"
FOREIGN KEY ("current_version_id", "id")
REFERENCES "quote_versions"("id", "quote_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_lines"
ADD CONSTRAINT "order_lines_subscription_plan_id_fkey"
FOREIGN KEY ("subscription_plan_id")
REFERENCES "subscription_plans"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL treats NULL values as distinct in ordinary compound unique indexes.
-- These partial indexes close the nullable-scope gaps that Prisma cannot express.
CREATE UNIQUE INDEX "role_assignments_global_scope_key"
ON "role_assignments"("organization_id", "user_id", "role")
WHERE "sales_team_id" IS NULL;

CREATE UNIQUE INDEX "customer_contacts_one_active_primary_key"
ON "customer_contacts"("organization_id", "customer_account_id")
WHERE "is_primary" = TRUE AND "status" <> 'ARCHIVED';

CREATE UNIQUE INDEX "inventory_balances_without_variant_key"
ON "inventory_balances"("organization_id", "warehouse_id", "product_id")
WHERE "variant_id" IS NULL;

CREATE UNIQUE INDEX "invoices_recurring_period_key"
ON "invoices"(
  "organization_id",
  "subscription_id",
  "billing_period_start",
  "billing_period_end"
)
WHERE "subscription_id" IS NOT NULL
  AND "billing_period_start" IS NOT NULL
  AND "billing_period_end" IS NOT NULL;

-- Configuration periods and hierarchy safety.
ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_not_own_parent_check"
CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "taxes"
ADD CONSTRAINT "taxes_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "taxes_rate_check"
CHECK ("rate" >= 0 AND "rate" <= 100);

ALTER TABLE "price_lists"
ADD CONSTRAINT "price_lists_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");

ALTER TABLE "price_rules"
ADD CONSTRAINT "price_rules_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "price_rules_target_check"
CHECK (num_nonnulls("product_id", "category_id") = 1),
ADD CONSTRAINT "price_rules_values_check"
CHECK ("min_quantity" > 0 AND "unit_price" >= 0);

ALTER TABLE "discount_limits"
ADD CONSTRAINT "discount_limits_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "discount_limits_target_check"
CHECK (num_nonnulls("tier_id", "category_id", "product_id") >= 1),
ADD CONSTRAINT "discount_limits_percent_check"
CHECK ("max_discount_percent" >= 0 AND "max_discount_percent" <= 100);

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "promotions_boost_check"
CHECK ("recommendation_boost" >= 0);

ALTER TABLE "approval_policies"
ADD CONSTRAINT "approval_policies_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "approval_policies_version_check"
CHECK ("version" > 0);

ALTER TABLE "recommendation_rules"
ADD CONSTRAINT "recommendation_rules_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "recommendation_rules_weights_check"
CHECK (
  "affinity_weight" >= 0
  AND "margin_weight" >= 0
  AND "promotion_weight" >= 0
  AND "availability_weight" >= 0
  AND "affinity_weight" + "margin_weight" + "promotion_weight" + "availability_weight" = 1
),
ADD CONSTRAINT "recommendation_rules_margin_check"
CHECK ("minimum_margin" >= 0 AND "minimum_margin" <= 100);

ALTER TABLE "product_affinities"
ADD CONSTRAINT "product_affinities_period_check"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
ADD CONSTRAINT "product_affinities_score_check"
CHECK ("affinity_score" >= 0 AND "affinity_score" <= 1),
ADD CONSTRAINT "product_affinities_distinct_products_check"
CHECK ("source_product_id" <> "target_product_id");

ALTER TABLE "subscription_plans"
ADD CONSTRAINT "subscription_plans_interval_check"
CHECK ("interval_count" > 0);

-- Identity, customer, and scoped-token rules.
ALTER TABLE "customer_accounts"
ADD CONSTRAINT "customer_accounts_credit_check"
CHECK (
  "payment_terms_days" >= 0
  AND "credit_limit" >= 0
  AND "current_exposure" >= 0
  AND "overdue_balance" >= 0
  AND "revision" > 0
);

ALTER TABLE "magic_link_tokens"
ADD CONSTRAINT "magic_link_tokens_scope_check"
CHECK (
  ("scope" = 'QUOTE' AND "quote_id" IS NOT NULL)
  OR ("scope" = 'CUSTOMER' AND "quote_id" IS NULL)
),
ADD CONSTRAINT "magic_link_tokens_usage_check"
CHECK ("max_uses" > 0 AND "use_count" >= 0 AND "use_count" <= "max_uses");

-- Commercial snapshot and approval facts.
ALTER TABLE "quotes"
ADD CONSTRAINT "quotes_revision_check"
CHECK ("current_revision" > 0 AND "revision" > 0);

ALTER TABLE "quote_versions"
ADD CONSTRAINT "quote_versions_values_check"
CHECK (
  "revision_number" > 0
  AND "payment_terms_days" >= 0
  AND "subtotal" >= 0
  AND "order_discount_total" >= 0
  AND "line_discount_total" >= 0
  AND "tax_total" >= 0
  AND "total" >= 0
  AND "cost_total" >= 0
);

ALTER TABLE "quote_lines"
ADD CONSTRAINT "quote_lines_values_check"
CHECK (
  "line_number" > 0
  AND "quantity" > 0
  AND "list_unit_price" >= 0
  AND "unit_price" >= 0
  AND "unit_cost" >= 0
  AND "discount_percent" >= 0
  AND "discount_percent" <= 100
  AND "line_discount_amount" >= 0
  AND "allocated_order_discount" >= 0
  AND "pre_tax_subtotal" >= 0
  AND "tax_rate" >= 0
  AND "tax_rate" <= 100
  AND "tax_amount" >= 0
  AND "total" >= 0
  AND "cost_total" >= 0
),
ADD CONSTRAINT "quote_lines_recurring_plan_check"
CHECK (
  ("billing_type" = 'RECURRING' AND "subscription_plan_id" IS NOT NULL AND "subscription_snapshot" IS NOT NULL)
  OR "billing_type" = 'ONE_TIME'
);

ALTER TABLE "quote_risk_assessments"
ADD CONSTRAINT "quote_risk_assessments_values_check"
CHECK (
  "blended_excess" >= 0
  AND "maximum_line_excess" >= 0
  AND "credit_exposure" >= 0
  AND "credit_utilization_percent" >= 0
  AND "overdue_balance" >= 0
  AND "representative_anomaly" >= 0
);

ALTER TABLE "quote_line_risk_facts"
ADD CONSTRAINT "quote_line_risk_facts_values_check"
CHECK (
  "applied_discount_percent" >= 0
  AND "applied_discount_percent" <= 100
  AND "allowed_discount_percent" >= 0
  AND "allowed_discount_percent" <= 100
  AND "excess_discount_percent" >= 0
  AND "pre_discount_value" >= 0
  AND "weight" >= 0
  AND "weight" <= 1
  AND "weighted_excess" >= 0
);

ALTER TABLE "approval_step_templates"
ADD CONSTRAINT "approval_step_templates_values_check"
CHECK ("sequence" > 0 AND ("due_after_hours" IS NULL OR "due_after_hours" > 0));

ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_sequence_check"
CHECK ("current_sequence" IS NULL OR "current_sequence" > 0);

ALTER TABLE "approval_steps"
ADD CONSTRAINT "approval_steps_sequence_check"
CHECK ("sequence" > 0);

-- Negotiation payload consistency.
ALTER TABLE "negotiation_messages"
ADD CONSTRAINT "negotiation_messages_author_check"
CHECK (
  ("author_type" = 'USER' AND "author_user_id" IS NOT NULL AND "portal_identity_id" IS NULL)
  OR ("author_type" = 'PORTAL' AND "author_user_id" IS NULL AND "portal_identity_id" IS NOT NULL)
  OR ("author_type" = 'SYSTEM' AND "author_user_id" IS NULL AND "portal_identity_id" IS NULL)
);

ALTER TABLE "change_request_items"
ADD CONSTRAINT "change_request_items_payload_check"
CHECK (
  ("action" = 'REMOVE')
  OR ("action" = 'CHANGE_QUANTITY' AND "requested_quantity" > 0)
  OR ("action" = 'CHANGE_PRICE' AND "requested_unit_price" >= 0)
  OR (
    "action" = 'CHANGE_DISCOUNT'
    AND "requested_discount_percent" >= 0
    AND "requested_discount_percent" <= 100
  )
  OR ("action" = 'CHANGE_TERMS' AND "requested_terms" IS NOT NULL)
);

ALTER TABLE "counteroffer_items"
ADD CONSTRAINT "counteroffer_items_payload_check"
CHECK (
  num_nonnulls("proposed_quantity", "proposed_unit_price", "proposed_discount_percent") >= 1
  AND ("proposed_quantity" IS NULL OR "proposed_quantity" > 0)
  AND ("proposed_unit_price" IS NULL OR "proposed_unit_price" >= 0)
  AND (
    "proposed_discount_percent" IS NULL
    OR ("proposed_discount_percent" >= 0 AND "proposed_discount_percent" <= 100)
  )
);

-- Order, stock, and fulfillment safety.
ALTER TABLE "orders"
ADD CONSTRAINT "orders_values_check"
CHECK (
  "payment_terms_days" >= 0
  AND "subtotal" >= 0
  AND "discount_total" >= 0
  AND "tax_total" >= 0
  AND "total" >= 0
  AND "cost_total" >= 0
  AND "revision" > 0
);

ALTER TABLE "order_lines"
ADD CONSTRAINT "order_lines_values_check"
CHECK (
  "position" > 0
  AND "quantity" > 0
  AND "unit_price" >= 0
  AND "unit_cost" >= 0
  AND "discount_percent" >= 0
  AND "discount_percent" <= 100
  AND "discount_amount" >= 0
  AND "tax_rate" >= 0
  AND "tax_rate" <= 100
  AND "subtotal" >= 0
  AND "tax_amount" >= 0
  AND "total" >= 0
  AND "cost_total" >= 0
),
ADD CONSTRAINT "order_lines_recurring_plan_check"
CHECK (
  ("billing_type" = 'RECURRING' AND "subscription_plan_id" IS NOT NULL AND "subscription_snapshot" IS NOT NULL)
  OR "billing_type" = 'ONE_TIME'
);

ALTER TABLE "warehouses"
ADD CONSTRAINT "warehouses_values_check"
CHECK ("shipping_cost_weight" >= 0 AND "lead_time_days" >= 0 AND "revision" > 0);

ALTER TABLE "inventory_balances"
ADD CONSTRAINT "inventory_balances_values_check"
CHECK (
  "on_hand" >= 0
  AND "reserved" >= 0
  AND "reserved" <= "on_hand"
  AND "available" = "on_hand" - "reserved"
  AND "incoming" >= 0
  AND "revision" > 0
);

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_values_check"
CHECK ("quantity" <> 0 AND "on_hand_after" >= 0 AND "reserved_after" >= 0);

ALTER TABLE "fulfillment_plans"
ADD CONSTRAINT "fulfillment_plans_values_check"
CHECK (
  "revision" > 0
  AND "unfulfilled_quantity" >= 0
  AND "shipment_count" >= 0
  AND "estimated_shipping_cost" >= 0
),
ADD CONSTRAINT "fulfillment_plans_manual_reason_check"
CHECK (
  "source" <> 'MANUAL'
  OR ("override_reason" IS NOT NULL AND length(trim("override_reason")) > 0)
);

ALTER TABLE "fulfillment_allocations"
ADD CONSTRAINT "fulfillment_allocations_values_check"
CHECK ("quantity" > 0 AND "available_at_preview" >= 0 AND "estimated_cost" >= 0);

ALTER TABLE "stock_reservations"
ADD CONSTRAINT "stock_reservations_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "shipment_items"
ADD CONSTRAINT "shipment_items_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "shipments"
ADD CONSTRAINT "shipments_cost_check"
CHECK ("estimated_shipping_cost" >= 0);

ALTER TABLE "backorders"
ADD CONSTRAINT "backorders_quantity_check"
CHECK ("remaining_quantity" > 0);

-- Subscription, invoice, credit, and payment safety.
ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_period_check"
CHECK ("current_period_end" > "current_period_start"),
ADD CONSTRAINT "subscriptions_anchor_check"
CHECK ("billing_anchor_day" IS NULL OR "billing_anchor_day" BETWEEN 1 AND 31),
ADD CONSTRAINT "subscriptions_revision_check"
CHECK ("revision" > 0);

ALTER TABLE "subscription_items"
ADD CONSTRAINT "subscription_items_values_check"
CHECK (
  "quantity" > 0
  AND "unit_price" >= 0
  AND ("active_to" IS NULL OR "active_to" > "active_from")
);

ALTER TABLE "subscription_changes"
ADD CONSTRAINT "subscription_changes_period_check"
CHECK ("period_end" > "period_start"),
ADD CONSTRAINT "subscription_changes_days_check"
CHECK (
  "remaining_billable_days" >= 0
  AND "total_days" > 0
  AND "remaining_billable_days" <= "total_days"
  AND "unrounded_amount" >= 0
  AND "rounded_amount" >= 0
);

ALTER TABLE "billing_schedules"
ADD CONSTRAINT "billing_schedules_values_check"
CHECK ("period_end" > "period_start" AND "amount" >= 0);

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_values_check"
CHECK (
  "subtotal" >= 0
  AND "discount_amount" >= 0
  AND "tax_amount" >= 0
  AND "total" >= 0
  AND "amount_paid" >= 0
  AND "amount_paid" <= "total"
  AND "balance_due" >= 0
  AND "balance_due" <= "total"
  AND "revision" > 0
),
ADD CONSTRAINT "invoices_period_check"
CHECK (
  ("billing_period_start" IS NULL AND "billing_period_end" IS NULL)
  OR (
    "billing_period_start" IS NOT NULL
    AND "billing_period_end" IS NOT NULL
    AND "billing_period_end" > "billing_period_start"
  )
),
ADD CONSTRAINT "invoices_recurring_source_check"
CHECK (
  "type" = 'ONE_TIME'
  OR (
    "subscription_id" IS NOT NULL
    AND "billing_period_start" IS NOT NULL
    AND "billing_period_end" IS NOT NULL
  )
);

ALTER TABLE "invoice_lines"
ADD CONSTRAINT "invoice_lines_values_check"
CHECK (
  "position" > 0
  AND "quantity" > 0
  AND "unit_price" >= 0
  AND "discount_amount" >= 0
  AND "subtotal" >= 0
  AND "tax_amount" >= 0
  AND "total" >= 0
);

ALTER TABLE "credit_notes"
ADD CONSTRAINT "credit_notes_values_check"
CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "total" >= 0);

ALTER TABLE "credit_note_lines"
ADD CONSTRAINT "credit_note_lines_values_check"
CHECK (
  "position" > 0
  AND "quantity" > 0
  AND "unit_amount" >= 0
  AND "tax_amount" >= 0
  AND "total" >= 0
);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_check"
CHECK ("amount" > 0);

-- Worker, reporting, and recipient bounds.
ALTER TABLE "deal_health_snapshots"
ADD CONSTRAINT "deal_health_snapshots_score_check"
CHECK (
  "health_score" >= 0
  AND "health_score" <= 100
  AND "stalled_days" >= 0
  AND "discount_anomaly_score" >= 0
  AND "approval_sla_hours_overdue" >= 0
  AND "promise_slippage_days" >= 0
  AND "credit_exposure" >= 0
);

ALTER TABLE "nudges"
ADD CONSTRAINT "nudges_recipient_check"
CHECK (num_nonnulls("recipient_user_id", "recipient_contact_id") = 1);

ALTER TABLE "outbox_events"
ADD CONSTRAINT "outbox_events_attempts_check"
CHECK ("attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts");

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_response_status_check"
CHECK ("response_status" IS NULL OR "response_status" BETWEEN 100 AND 599);

ALTER TABLE "export_jobs"
ADD CONSTRAINT "export_jobs_progress_check"
CHECK ("progress" BETWEEN 0 AND 100);

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipient_check"
CHECK (num_nonnulls("recipient_user_id", "recipient_portal_identity_id") = 1);
