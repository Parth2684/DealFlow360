-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HARDWARE', 'SERVICE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "TaxBehavior" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "QuoteStage" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'READY_TO_SEND', 'SENT', 'UNDER_NEGOTIATION', 'CUSTOMER_ACCEPTED', 'CONFIRMED', 'REVISION_REQUIRED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionAction" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_REVISION');

-- CreateEnum
CREATE TYPE "NegotiationThreadStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('PRICE', 'DISCOUNT', 'QUANTITY', 'TERMS', 'COMMENT');

-- CreateEnum
CREATE TYPE "RecommendationInteractionType" AS ENUM ('IMPRESSION', 'DISMISS', 'ACCEPT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'RESERVATION', 'RELEASE', 'SHIPMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RELEASED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "FulfillmentPlanStatus" AS ENUM ('PREVIEW', 'ACCEPTED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackorderStatus" AS ENUM ('OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'ALLOCATING', 'FULFILLING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "BillingScheduleStatus" AS ENUM ('PENDING', 'GENERATED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "ProrationConvention" AS ENUM ('CALENDAR_DAYS', 'THIRTY_DAY_MONTH');

-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'XLS');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DealEventVisibility" AS ENUM ('INTERNAL', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MagicLinkScope" AS ENUM ('QUOTE', 'CUSTOMER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "sales_team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_teams" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manager_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_identities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_contact_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "portal_identity_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "scope" "MagicLinkScope" NOT NULL,
    "quote_id" TEXT,
    "customer_account_id" TEXT,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tiers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "sales_team_id" TEXT,
    "assigned_rep_id" TEXT,
    "preferred_currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "credit_limit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "current_exposure" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "overdue_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "portal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "standard_cost" DECIMAL(19,4) NOT NULL,
    "tax_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "price_surcharge" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(19,4) NOT NULL,
    "behavior" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "product_id" TEXT,
    "category_id" TEXT,
    "tier_id" TEXT,
    "min_quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "boost_score" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "interval" "SubscriptionInterval" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "proration_convention" "ProrationConvention" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "cancellation_rules" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_limits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier_id" TEXT,
    "category_id" TEXT,
    "product_id" TEXT,
    "max_discount_pct" DECIMAL(19,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_account_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "stage" "QuoteStage" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "status" "QuoteVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "margin_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "risk_facts" JSONB NOT NULL DEFAULT '{}',
    "policy_version" TEXT,
    "terms_fingerprint" TEXT NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "line_number" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "sku" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,
    "discount_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "billing_type" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
    "subscription_plan_id" TEXT,
    "risk_contribution" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "predicates" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_step_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "approval_policy_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "required_capability" TEXT NOT NULL,
    "role_hint" "Role",
    "sla_hours" INTEGER,

    CONSTRAINT "approval_step_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "terms_fingerprint" TEXT NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rule_facts" JSONB NOT NULL DEFAULT '{}',
    "matched_policies" JSONB NOT NULL DEFAULT '[]',
    "route_reason" TEXT,
    "explainer_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "required_capability" TEXT NOT NULL,
    "assignee_id" TEXT,
    "delegate_id" TEXT,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "approval_step_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "ApprovalDecisionAction" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_threads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "status" "NegotiationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiation_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "negotiation_thread_id" TEXT NOT NULL,
    "author_type" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "quote_line_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "quote_line_id" TEXT,
    "type" "ChangeRequestType" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_value" JSONB NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_interactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "interaction" "RecommendationInteractionType" NOT NULL,
    "margin_delta" DECIMAL(19,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" JSONB NOT NULL DEFAULT '{}',
    "shipping_cost_weight" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "on_hand" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "available" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "incoming" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "FulfillmentPlanStatus" NOT NULL DEFAULT 'PREVIEW',
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "objective_values" JSONB NOT NULL DEFAULT '{}',
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "fulfillment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_allocations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fulfillment_plan_id" TEXT NOT NULL,
    "order_line_id" TEXT,
    "quote_line_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "assigned_quantity" DECIMAL(19,4) NOT NULL,
    "estimated_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "promised_date" TIMESTAMP(3),

    CONSTRAINT "fulfillment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "promised_date" TIMESTAMP(3),
    "shipped_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backorders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_line_id" TEXT,
    "quote_line_id" TEXT NOT NULL,
    "remaining_qty" DECIMAL(19,4) NOT NULL,
    "status" "BackorderStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backorders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "customer_account_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "terms_fingerprint" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "quote_line_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "line_number" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "billing_type" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_account_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "subscription_plan_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" "BillingScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT,
    "subscription_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "credit_number" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(19,4) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "recorded_by_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_affinities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_product_id" TEXT NOT NULL,
    "target_product_id" TEXT NOT NULL,
    "affinity_score" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_affinities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_id" TEXT,
    "weights" JSONB NOT NULL DEFAULT '{}',
    "margin_floor" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_health_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_id" TEXT,
    "alert_type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "before_summary" JSONB,
    "after_summary" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quote_id" TEXT,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "DealEventVisibility" NOT NULL DEFAULT 'INTERNAL',
    "actor_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "dedupe_key" TEXT,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_id" TEXT,
    "route" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "result_ref" TEXT,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "format" "ExportFormat" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "result_location" TEXT,
    "error" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE INDEX "role_assignments_organization_id_role_idx" ON "role_assignments"("organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_organization_id_user_id_role_sales_team_id_key" ON "role_assignments"("organization_id", "user_id", "role", "sales_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_teams_organization_id_name_key" ON "sales_teams"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_organization_id_user_id_idx" ON "sessions"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_organization_id_user_id_idx" ON "refresh_tokens"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_identities_customer_contact_id_key" ON "portal_identities"("customer_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_identities_organization_id_email_key" ON "portal_identities"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_key" ON "magic_link_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "magic_link_tokens_organization_id_expires_at_idx" ON "magic_link_tokens"("organization_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tiers_organization_id_code_key" ON "customer_tiers"("organization_id", "code");

-- CreateIndex
CREATE INDEX "customer_accounts_organization_id_tier_id_idx" ON "customer_accounts"("organization_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_contacts_organization_id_customer_account_id_email_key" ON "customer_contacts"("organization_id", "customer_account_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_organization_id_code_key" ON "product_categories"("organization_id", "code");

-- CreateIndex
CREATE INDEX "products_organization_id_type_active_idx" ON "products"("organization_id", "type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_code_key" ON "products"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_organization_id_sku_key" ON "product_variants"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "taxes_organization_id_effective_from_effective_to_idx" ON "taxes"("organization_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "price_lists_organization_id_active_effective_from_idx" ON "price_lists"("organization_id", "active", "effective_from");

-- CreateIndex
CREATE INDEX "price_rules_price_list_id_product_id_category_id_tier_id_idx" ON "price_rules"("price_list_id", "product_id", "category_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_organization_id_code_key" ON "promotions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_organization_id_code_key" ON "subscription_plans"("organization_id", "code");

-- CreateIndex
CREATE INDEX "discount_limits_organization_id_tier_id_category_id_product_idx" ON "discount_limits"("organization_id", "tier_id", "category_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_current_version_id_key" ON "quotes"("current_version_id");

-- CreateIndex
CREATE INDEX "quotes_organization_id_stage_owner_id_idx" ON "quotes"("organization_id", "stage", "owner_id");

-- CreateIndex
CREATE INDEX "quotes_organization_id_updated_at_idx" ON "quotes"("organization_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_organization_id_quote_number_key" ON "quotes"("organization_id", "quote_number");

-- CreateIndex
CREATE INDEX "quote_versions_organization_id_status_idx" ON "quote_versions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quote_versions_quote_id_revision_number_key" ON "quote_versions"("quote_id", "revision_number");

-- CreateIndex
CREATE INDEX "quote_lines_quote_version_id_line_number_idx" ON "quote_lines"("quote_version_id", "line_number");

-- CreateIndex
CREATE INDEX "approval_policies_organization_id_status_priority_idx" ON "approval_policies"("organization_id", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "approval_step_templates_approval_policy_id_sequence_key" ON "approval_step_templates"("approval_policy_id", "sequence");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_status_idx" ON "approval_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_terms_fingerprint_idx" ON "approval_requests"("terms_fingerprint");

-- CreateIndex
CREATE INDEX "approval_steps_organization_id_assignee_id_status_idx" ON "approval_steps"("organization_id", "assignee_id", "status");

-- CreateIndex
CREATE INDEX "approval_steps_due_at_status_idx" ON "approval_steps"("due_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approval_request_id_sequence_key" ON "approval_steps"("approval_request_id", "sequence");

-- CreateIndex
CREATE INDEX "approval_decisions_approval_request_id_created_at_idx" ON "approval_decisions"("approval_request_id", "created_at");

-- CreateIndex
CREATE INDEX "negotiation_threads_organization_id_quote_id_idx" ON "negotiation_threads"("organization_id", "quote_id");

-- CreateIndex
CREATE INDEX "negotiation_messages_negotiation_thread_id_created_at_idx" ON "negotiation_messages"("negotiation_thread_id", "created_at");

-- CreateIndex
CREATE INDEX "change_requests_organization_id_status_idx" ON "change_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "recommendation_interactions_quote_id_product_id_idx" ON "recommendation_interactions"("quote_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organization_id_code_key" ON "warehouses"("organization_id", "code");

-- CreateIndex
CREATE INDEX "inventory_balances_organization_id_product_id_idx" ON "inventory_balances"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_warehouse_id_product_id_variant_id_key" ON "inventory_balances"("warehouse_id", "product_id", "variant_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_warehouse_id_created_at_idx" ON "stock_movements"("organization_id", "warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_reservations_organization_id_warehouse_id_status_idx" ON "stock_reservations"("organization_id", "warehouse_id", "status");

-- CreateIndex
CREATE INDEX "fulfillment_plans_organization_id_order_id_idx" ON "fulfillment_plans"("organization_id", "order_id");

-- CreateIndex
CREATE INDEX "fulfillment_allocations_fulfillment_plan_id_idx" ON "fulfillment_allocations"("fulfillment_plan_id");

-- CreateIndex
CREATE INDEX "shipments_organization_id_order_id_status_idx" ON "shipments"("organization_id", "order_id", "status");

-- CreateIndex
CREATE INDEX "backorders_organization_id_status_idx" ON "backorders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "orders_organization_id_status_idx" ON "orders"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_order_number_key" ON "orders"("organization_id", "order_number");

-- CreateIndex
CREATE INDEX "order_lines_order_id_line_number_idx" ON "order_lines"("order_id", "line_number");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_status_idx" ON "subscriptions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_schedules_invoice_id_key" ON "billing_schedules"("invoice_id");

-- CreateIndex
CREATE INDEX "billing_schedules_organization_id_due_date_status_idx" ON "billing_schedules"("organization_id", "due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_schedules_subscription_id_period_start_period_end_key" ON "billing_schedules"("subscription_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_due_date_idx" ON "invoices"("organization_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_organization_id_credit_number_key" ON "credit_notes"("organization_id", "credit_number");

-- CreateIndex
CREATE INDEX "payments_organization_id_invoice_id_idx" ON "payments"("organization_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_affinities_organization_id_source_product_id_target_key" ON "product_affinities"("organization_id", "source_product_id", "target_product_id");

-- CreateIndex
CREATE INDEX "deal_health_snapshots_organization_id_snapshot_date_idx" ON "deal_health_snapshots"("organization_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "alerts_organization_id_severity_created_at_idx" ON "alerts"("organization_id", "severity", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_entity_type_entity_id_created__idx" ON "audit_events"("organization_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_event_type_created_at_idx" ON "audit_events"("organization_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "deal_events_organization_id_quote_id_created_at_idx" ON "deal_events"("organization_id", "quote_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_idempotency_key_key" ON "idempotency_records"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "export_jobs_organization_id_status_idx" ON "export_jobs"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_sales_team_id_fkey" FOREIGN KEY ("sales_team_id") REFERENCES "sales_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_teams" ADD CONSTRAINT "sales_teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_teams" ADD CONSTRAINT "sales_teams_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_identities" ADD CONSTRAINT "portal_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_identities" ADD CONSTRAINT "portal_identities_customer_contact_id_fkey" FOREIGN KEY ("customer_contact_id") REFERENCES "customer_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tiers" ADD CONSTRAINT "customer_tiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_sales_team_id_fkey" FOREIGN KEY ("sales_team_id") REFERENCES "sales_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "quote_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_step_templates" ADD CONSTRAINT "approval_step_templates_approval_policy_id_fkey" FOREIGN KEY ("approval_policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_step_id_fkey" FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_negotiation_thread_id_fkey" FOREIGN KEY ("negotiation_thread_id") REFERENCES "negotiation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_interactions" ADD CONSTRAINT "recommendation_interactions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_fulfillment_plan_id_fkey" FOREIGN KEY ("fulfillment_plan_id") REFERENCES "fulfillment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backorders" ADD CONSTRAINT "backorders_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_source_product_id_fkey" FOREIGN KEY ("source_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_health_snapshots" ADD CONSTRAINT "deal_health_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
