-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PortalIdentityStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MagicLinkScope" AS ENUM ('CUSTOMER', 'QUOTE');

-- CreateEnum
CREATE TYPE "ConfigurationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HARDWARE', 'SERVICE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "TaxBehavior" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ProrationConvention" AS ENUM ('CALENDAR_DAYS', 'THIRTY_DAY_MONTH');

-- CreateEnum
CREATE TYPE "QuoteStage" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'READY_TO_SEND', 'SENT', 'UNDER_NEGOTIATION', 'CUSTOMER_ACCEPTED', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'READY_TO_SEND', 'APPROVED', 'REJECTED', 'CUSTOMER_ACCEPTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('WAITING', 'ACTIVE', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'SKIPPED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionAction" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_REVISION');

-- CreateEnum
CREATE TYPE "RecommendationInteractionType" AS ENUM ('IMPRESSION', 'DISMISSAL', 'ACCEPTANCE');

-- CreateEnum
CREATE TYPE "NegotiationThreadStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('INTERNAL', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'PORTAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ChangeRequestAction" AS ENUM ('REMOVE', 'CHANGE_QUANTITY', 'CHANGE_PRICE', 'CHANGE_DISCOUNT', 'CHANGE_TERMS');

-- CreateEnum
CREATE TYPE "CounterofferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'ALLOCATION_PENDING', 'RESERVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'RESERVATION', 'RELEASE', 'SHIPMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FulfillmentPlanStatus" AS ENUM ('PREVIEW', 'ACCEPTED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FulfillmentPlanSource" AS ENUM ('RECOMMENDED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PLANNED', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackorderStatus" AS ENUM ('OPEN', 'PARTIALLY_ALLOCATED', 'CONSOLIDATED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CHANGE_SCHEDULED', 'CANCELLATION_SCHEDULED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionChangeType" AS ENUM ('QUANTITY_CHANGE', 'PLAN_CHANGE', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "ProrationDirection" AS ENUM ('DEBIT', 'CREDIT', 'NONE');

-- CreateEnum
CREATE TYPE "SubscriptionChangeStatus" AS ENUM ('APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "BillingScheduleStatus" AS ENUM ('PENDING', 'GENERATED', 'SKIPPED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('ONE_TIME', 'RECURRING', 'PRORATION');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('STALLED_DEAL', 'DISCOUNT_ANOMALY', 'APPROVAL_SLA', 'PROMISE_SLIPPAGE', 'CREDIT_EXPOSURE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'SNOOZED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NudgeChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NudgeStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('QUOTES', 'ORDERS', 'INVOICES', 'CUSTOMERS', 'INVENTORY');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "email_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "manager_id" UUID,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "sales_team_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "family_id" UUID NOT NULL,
    "replaced_by_token_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tiers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "sales_team_id" UUID,
    "assigned_rep_id" UUID,
    "account_code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "preferred_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "credit_limit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "current_exposure" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "overdue_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "portal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_identities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_contact_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "status" "PortalIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "portal_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "portal_identity_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "quote_id" UUID,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "portal_identity_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "quote_id" UUID,
    "token_hash" VARCHAR(128) NOT NULL,
    "scope" "MagicLinkScope" NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(19,4) NOT NULL,
    "behavior" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "tax_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "unit" VARCHAR(32) NOT NULL DEFAULT 'each',
    "standard_cost" DECIMAL(19,4) NOT NULL,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "price_surcharge" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "product_id" UUID,
    "category_id" UUID,
    "tier_id" UUID,
    "min_quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_limits" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "tier_id" UUID,
    "category_id" UUID,
    "product_id" UUID,
    "max_discount_percent" DECIMAL(19,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "discount_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "benefit" JSONB NOT NULL DEFAULT '{}',
    "recommendation_boost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "proration_convention" "ProrationConvention" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "cancellation_rules" JSONB NOT NULL DEFAULT '{}',
    "refund_rules" JSONB NOT NULL DEFAULT '{}',
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "sales_team_id" UUID,
    "quote_number" VARCHAR(40) NOT NULL,
    "stage" "QuoteStage" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" UUID,
    "current_revision" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "status" "QuoteVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "payment_terms_days" INTEGER NOT NULL,
    "customer_snapshot" JSONB NOT NULL DEFAULT '{}',
    "pricing_snapshot" JSONB NOT NULL DEFAULT '{}',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "order_discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "margin_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "risk_facts" JSONB NOT NULL DEFAULT '{}',
    "policy_snapshot" JSONB NOT NULL DEFAULT '{}',
    "terms_fingerprint" VARCHAR(64) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "subscription_plan_id" UUID,
    "line_number" INTEGER NOT NULL,
    "product_code" VARCHAR(40) NOT NULL,
    "product_name" VARCHAR(160) NOT NULL,
    "product_description" TEXT,
    "product_type" "ProductType" NOT NULL,
    "category_code" VARCHAR(40) NOT NULL,
    "sku" VARCHAR(80),
    "unit" VARCHAR(32) NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "list_unit_price" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,
    "discount_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "allocated_order_discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "pre_tax_subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_code" VARCHAR(40),
    "tax_rate" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_behavior" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "billing_type" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
    "pricing_snapshot" JSONB NOT NULL DEFAULT '{}',
    "subscription_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_risk_assessments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "blended_excess" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "maximum_line_excess" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "post_discount_margin_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_exposure" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_utilization_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "overdue_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "representative_anomaly" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "required_route" JSONB NOT NULL DEFAULT '[]',
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "threshold_safe_suggestion" JSONB,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_risk_facts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "quote_line_id" UUID NOT NULL,
    "applied_discount_percent" DECIMAL(19,4) NOT NULL,
    "allowed_discount_percent" DECIMAL(19,4) NOT NULL,
    "excess_discount_percent" DECIMAL(19,4) NOT NULL,
    "pre_discount_value" DECIMAL(19,4) NOT NULL,
    "weight" DECIMAL(19,4) NOT NULL,
    "weighted_excess" DECIMAL(19,4) NOT NULL,
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_risk_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_risk_limit_matches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "line_risk_fact_id" UUID NOT NULL,
    "quote_line_id" UUID NOT NULL,
    "discount_limit_id" UUID NOT NULL,
    "rule_snapshot" JSONB NOT NULL DEFAULT '{}',
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_risk_limit_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(140) NOT NULL,
    "predicates" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_step_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_policy_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "required_role" "Role" NOT NULL,
    "required_capability" VARCHAR(100) NOT NULL,
    "assignee_strategy" VARCHAR(80) NOT NULL,
    "due_after_hours" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_step_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "terms_fingerprint" VARCHAR(64) NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "current_sequence" INTEGER,
    "rule_facts" JSONB NOT NULL DEFAULT '{}',
    "required_route" JSONB NOT NULL DEFAULT '[]',
    "decision_explanation" JSONB NOT NULL DEFAULT '{}',
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request_policy_matches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "approval_policy_id" UUID NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "matched_facts" JSONB NOT NULL DEFAULT '{}',
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_request_policy_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "approval_step_template_id" UUID,
    "sequence" INTEGER NOT NULL,
    "required_capability" VARCHAR(100) NOT NULL,
    "required_role" "Role" NOT NULL,
    "assignee_id" UUID,
    "delegate_id" UUID,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'WAITING',
    "due_at" TIMESTAMPTZ(3),
    "activated_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "approval_step_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ApprovalDecisionAction" NOT NULL,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "affinity_weight" DECIMAL(19,4) NOT NULL DEFAULT 0.4,
    "margin_weight" DECIMAL(19,4) NOT NULL DEFAULT 0.25,
    "promotion_weight" DECIMAL(19,4) NOT NULL DEFAULT 0.2,
    "availability_weight" DECIMAL(19,4) NOT NULL DEFAULT 0.15,
    "minimum_margin" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_affinities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_product_id" UUID NOT NULL,
    "target_product_id" UUID NOT NULL,
    "affinity_score" DECIMAL(19,4) NOT NULL,
    "co_purchase_count" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_affinities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_interactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "interaction" "RecommendationInteractionType" NOT NULL,
    "score_snapshot" JSONB NOT NULL DEFAULT '{}',
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expected_margin_delta" DECIMAL(19,4),
    "resulting_margin_delta" DECIMAL(19,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_threads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "status" "NegotiationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "negotiation_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "quote_line_id" UUID,
    "author_type" "ActorType" NOT NULL,
    "author_user_id" UUID,
    "portal_identity_id" UUID,
    "body" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'BOTH',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "source_quote_version_id" UUID NOT NULL,
    "source_terms_fingerprint" VARCHAR(64) NOT NULL,
    "requested_by_portal_id" UUID NOT NULL,
    "message" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by_user_id" UUID,
    "resolution_reason" VARCHAR(1000),
    "resulting_quote_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_request_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "change_request_id" UUID NOT NULL,
    "quote_line_id" UUID,
    "action" "ChangeRequestAction" NOT NULL,
    "requested_quantity" DECIMAL(19,4),
    "requested_unit_price" DECIMAL(19,4),
    "requested_discount_percent" DECIMAL(19,4),
    "requested_terms" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counteroffers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "change_request_id" UUID NOT NULL,
    "source_quote_version_id" UUID NOT NULL,
    "source_terms_fingerprint" VARCHAR(64) NOT NULL,
    "offered_by_user_id" UUID NOT NULL,
    "message" TEXT,
    "status" "CounterofferStatus" NOT NULL DEFAULT 'PENDING',
    "customer_decision_portal_id" UUID,
    "customer_decision_reason" VARCHAR(1000),
    "resulting_quote_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "counteroffers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counteroffer_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "counteroffer_id" UUID NOT NULL,
    "quote_line_id" UUID NOT NULL,
    "proposed_quantity" DECIMAL(19,4),
    "proposed_unit_price" DECIMAL(19,4),
    "proposed_discount_percent" DECIMAL(19,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counteroffer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_acceptances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "portal_identity_id" UUID NOT NULL,
    "accepted_fingerprint" VARCHAR(64) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "confirmed_by_id" UUID NOT NULL,
    "order_number" VARCHAR(40) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "terms_fingerprint" VARCHAR(64) NOT NULL,
    "customer_name" VARCHAR(180) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "payment_terms_days" INTEGER NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "cost_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "margin_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "quote_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "subscription_plan_id" UUID,
    "position" INTEGER NOT NULL,
    "product_code" VARCHAR(40) NOT NULL,
    "product_name" VARCHAR(160) NOT NULL,
    "product_description" TEXT,
    "sku" VARCHAR(80),
    "unit" VARCHAR(32) NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "billing_type" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
    "subscription_snapshot" JSONB,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,
    "discount_percent" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_code" VARCHAR(40),
    "tax_rate" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_behavior" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "subtotal" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "cost_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" JSONB NOT NULL DEFAULT '{}',
    "shipping_cost_weight" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "on_hand" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "available" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "incoming" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "inventory_balance_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "stock_reservation_id" UUID,
    "shipment_id" UUID,
    "actor_id" UUID,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "reference" VARCHAR(120),
    "reason" VARCHAR(1000),
    "on_hand_after" DECIMAL(19,4) NOT NULL,
    "reserved_after" DECIMAL(19,4) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "FulfillmentPlanStatus" NOT NULL DEFAULT 'PREVIEW',
    "source" "FulfillmentPlanSource" NOT NULL DEFAULT 'RECOMMENDED',
    "recommendation_snapshot" JSONB NOT NULL DEFAULT '{}',
    "availability_snapshot" JSONB NOT NULL DEFAULT '{}',
    "unfulfilled_quantity" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shipment_count" INTEGER NOT NULL DEFAULT 0,
    "estimated_shipping_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "estimated_promise_at" TIMESTAMPTZ(3),
    "override_reason" VARCHAR(1000),
    "accepted_by_id" UUID,
    "accepted_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fulfillment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_allocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "fulfillment_plan_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "available_at_preview" DECIMAL(19,4) NOT NULL,
    "estimated_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "estimated_date" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "inventory_balance_id" UUID NOT NULL,
    "fulfillment_allocation_id" UUID,
    "quantity" DECIMAL(19,4) NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "release_reason" VARCHAR(1000),
    "reserved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(3),
    "shipped_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "shipment_number" VARCHAR(40) NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PLANNED',
    "promised_date" TIMESTAMPTZ(3),
    "actual_date" TIMESTAMPTZ(3),
    "tracking_number" VARCHAR(120),
    "estimated_shipping_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "stock_reservation_id" UUID,
    "quantity" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backorders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "consolidated_into_id" UUID,
    "remaining_quantity" DECIMAL(19,4) NOT NULL,
    "status" "BackorderStatus" NOT NULL DEFAULT 'OPEN',
    "expected_at" TIMESTAMPTZ(3),
    "fulfilled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "backorders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "subscription_plan_id" UUID NOT NULL,
    "subscription_number" VARCHAR(40) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "currency" VARCHAR(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "plan_snapshot" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "current_period_start" DATE NOT NULL,
    "current_period_end" DATE NOT NULL,
    "next_billing_at" TIMESTAMPTZ(3),
    "billing_anchor_day" INTEGER,
    "cancel_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(1000),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "subscription_plan_id" UUID NOT NULL,
    "sku" VARCHAR(80),
    "product_name" VARCHAR(160) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "tax_snapshot" JSONB NOT NULL DEFAULT '{}',
    "active_from" TIMESTAMPTZ(3) NOT NULL,
    "active_to" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_changes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "subscription_item_id" UUID,
    "actor_id" UUID NOT NULL,
    "type" "SubscriptionChangeType" NOT NULL,
    "status" "SubscriptionChangeStatus" NOT NULL DEFAULT 'APPLIED',
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(1000),
    "old_quantity" DECIMAL(19,4),
    "new_quantity" DECIMAL(19,4),
    "old_plan_snapshot" JSONB,
    "new_plan_snapshot" JSONB,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "remaining_billable_days" INTEGER NOT NULL,
    "total_days" INTEGER NOT NULL,
    "proration_convention" "ProrationConvention" NOT NULL,
    "unrounded_amount" DECIMAL(19,4) NOT NULL,
    "rounded_amount" DECIMAL(19,4) NOT NULL,
    "direction" "ProrationDirection" NOT NULL,
    "calculation_snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMPTZ(3),

    CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "invoice_id" UUID,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "generation_status" "BillingScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "calculation_snapshot" JSONB NOT NULL DEFAULT '{}',
    "generated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "billing_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "order_id" UUID,
    "subscription_id" UUID,
    "invoice_number" VARCHAR(40) NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "billing_period_start" DATE,
    "billing_period_end" DATE,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "calculation_snapshot" JSONB NOT NULL DEFAULT '{}',
    "due_date" DATE NOT NULL,
    "issued_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "order_line_id" UUID,
    "subscription_item_id" UUID,
    "subscription_change_id" UUID,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "sku" VARCHAR(80),
    "unit" VARCHAR(32) NOT NULL,
    "billing_type" "BillingType" NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(19,4) NOT NULL,
    "tax_snapshot" JSONB NOT NULL DEFAULT '{}',
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "billing_period_start" DATE,
    "billing_period_end" DATE,
    "proration_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_invoice_id" UUID NOT NULL,
    "applied_invoice_id" UUID,
    "subscription_change_id" UUID,
    "credit_note_number" VARCHAR(40) NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reason" VARCHAR(1000),
    "issued_at" TIMESTAMPTZ(3),
    "applied_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "source_invoice_line_id" UUID,
    "subscription_change_id" UUID,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_amount" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(160),
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "payment_date" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_health_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID,
    "reason" VARCHAR(160) NOT NULL,
    "health_score" DECIMAL(19,4) NOT NULL,
    "stalled_days" INTEGER NOT NULL DEFAULT 0,
    "discount_anomaly_score" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approval_sla_hours_overdue" INTEGER NOT NULL DEFAULT 0,
    "promise_slippage_days" INTEGER NOT NULL DEFAULT 0,
    "credit_exposure" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "facts" JSONB NOT NULL DEFAULT '{}',
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID,
    "deal_health_snapshot_id" UUID,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "reason_code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "message" TEXT NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '{}',
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(3),
    "snoozed_until" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nudges" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_contact_id" UUID,
    "channel" "NudgeChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NudgeStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" VARCHAR(1000),
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),

    CONSTRAINT "nudges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(200),
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "entity_version" INTEGER,
    "terms_fingerprint" VARCHAR(64),
    "event_type" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(1000),
    "before_summary" JSONB,
    "after_summary" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "event_type" VARCHAR(120) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "message" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "source_entity_type" VARCHAR(100),
    "source_entity_id" UUID,
    "source_version" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "deduplication_key" VARCHAR(191) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "locked_by" VARCHAR(120),
    "processed_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(191) NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" VARCHAR(191) NOT NULL,
    "command" VARCHAR(160) NOT NULL,
    "request_fingerprint" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "result_entity_type" VARCHAR(100),
    "result_entity_id" UUID,
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result_location" VARCHAR(1000),
    "error_message" VARCHAR(2000),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_portal_identity_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "read_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "error_message" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_report_filters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saved_report_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE INDEX "sales_teams_organization_id_manager_id_status_idx" ON "sales_teams"("organization_id", "manager_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_teams_organization_id_name_key" ON "sales_teams"("organization_id", "name");

-- CreateIndex
CREATE INDEX "role_assignments_organization_id_role_active_idx" ON "role_assignments"("organization_id", "role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_organization_id_user_id_role_sales_team_id_key" ON "role_assignments"("organization_id", "user_id", "role", "sales_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_organization_id_user_id_expires_at_idx" ON "sessions"("organization_id", "user_id", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_revoked_at_idx" ON "sessions"("expires_at", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_organization_id_session_id_expires_at_idx" ON "refresh_tokens"("organization_id", "session_id", "expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "customer_tiers_organization_id_status_priority_idx" ON "customer_tiers"("organization_id", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tiers_organization_id_code_key" ON "customer_tiers"("organization_id", "code");

-- CreateIndex
CREATE INDEX "customer_accounts_organization_id_tier_id_status_idx" ON "customer_accounts"("organization_id", "tier_id", "status");

-- CreateIndex
CREATE INDEX "customer_accounts_organization_id_sales_team_id_assigned_re_idx" ON "customer_accounts"("organization_id", "sales_team_id", "assigned_rep_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_organization_id_account_code_key" ON "customer_accounts"("organization_id", "account_code");

-- CreateIndex
CREATE INDEX "customer_contacts_organization_id_customer_account_id_statu_idx" ON "customer_contacts"("organization_id", "customer_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_contacts_organization_id_customer_account_id_email_key" ON "customer_contacts"("organization_id", "customer_account_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "portal_identities_customer_contact_id_key" ON "portal_identities"("customer_contact_id");

-- CreateIndex
CREATE INDEX "portal_identities_organization_id_status_idx" ON "portal_identities"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "portal_identities_organization_id_email_key" ON "portal_identities"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "portal_sessions_token_hash_key" ON "portal_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "portal_sessions_organization_id_portal_identity_id_expires__idx" ON "portal_sessions"("organization_id", "portal_identity_id", "expires_at");

-- CreateIndex
CREATE INDEX "portal_sessions_organization_id_customer_account_id_quote_i_idx" ON "portal_sessions"("organization_id", "customer_account_id", "quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_key" ON "magic_link_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "magic_link_tokens_organization_id_customer_account_id_quote_idx" ON "magic_link_tokens"("organization_id", "customer_account_id", "quote_id", "expires_at", "revoked_at");

-- CreateIndex
CREATE INDEX "product_categories_organization_id_parent_id_status_idx" ON "product_categories"("organization_id", "parent_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_organization_id_code_key" ON "product_categories"("organization_id", "code");

-- CreateIndex
CREATE INDEX "taxes_organization_id_status_effective_from_effective_to_idx" ON "taxes"("organization_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "taxes_organization_id_code_key" ON "taxes"("organization_id", "code");

-- CreateIndex
CREATE INDEX "products_organization_id_category_id_type_status_idx" ON "products"("organization_id", "category_id", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_code_key" ON "products"("organization_id", "code");

-- CreateIndex
CREATE INDEX "product_variants_organization_id_product_id_status_idx" ON "product_variants"("organization_id", "product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_organization_id_sku_key" ON "product_variants"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "price_lists_organization_id_currency_status_effective_from__idx" ON "price_lists"("organization_id", "currency", "status", "effective_from", "effective_to", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_organization_id_code_key" ON "price_lists"("organization_id", "code");

-- CreateIndex
CREATE INDEX "price_rules_organization_id_price_list_id_product_id_catego_idx" ON "price_rules"("organization_id", "price_list_id", "product_id", "category_id", "tier_id", "min_quantity", "priority");

-- CreateIndex
CREATE INDEX "price_rules_organization_id_status_effective_from_effective_idx" ON "price_rules"("organization_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "discount_limits_organization_id_tier_id_category_id_product_idx" ON "discount_limits"("organization_id", "tier_id", "category_id", "product_id", "priority");

-- CreateIndex
CREATE INDEX "discount_limits_organization_id_status_effective_from_effec_idx" ON "discount_limits"("organization_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "promotions_organization_id_status_effective_from_effective__idx" ON "promotions"("organization_id", "status", "effective_from", "effective_to", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_organization_id_code_key" ON "promotions"("organization_id", "code");

-- CreateIndex
CREATE INDEX "promotion_products_organization_id_product_id_idx" ON "promotion_products"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_products_organization_id_promotion_id_product_id_key" ON "promotion_products"("organization_id", "promotion_id", "product_id");

-- CreateIndex
CREATE INDEX "subscription_plans_organization_id_status_idx" ON "subscription_plans"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_organization_id_code_key" ON "subscription_plans"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_current_version_id_key" ON "quotes"("current_version_id");

-- CreateIndex
CREATE INDEX "quotes_organization_id_stage_owner_id_updated_at_idx" ON "quotes"("organization_id", "stage", "owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "quotes_organization_id_customer_account_id_updated_at_idx" ON "quotes"("organization_id", "customer_account_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_organization_id_quote_number_key" ON "quotes"("organization_id", "quote_number");

-- CreateIndex
CREATE INDEX "quote_versions_organization_id_status_idx" ON "quote_versions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "quote_versions_organization_id_terms_fingerprint_idx" ON "quote_versions"("organization_id", "terms_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "quote_versions_organization_id_quote_id_revision_number_key" ON "quote_versions"("organization_id", "quote_id", "revision_number");

-- CreateIndex
CREATE INDEX "quote_lines_organization_id_product_id_variant_id_idx" ON "quote_lines"("organization_id", "product_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_lines_organization_id_quote_version_id_line_number_key" ON "quote_lines"("organization_id", "quote_version_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "quote_risk_assessments_quote_version_id_key" ON "quote_risk_assessments"("quote_version_id");

-- CreateIndex
CREATE INDEX "quote_risk_assessments_organization_id_calculated_at_idx" ON "quote_risk_assessments"("organization_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "quote_line_risk_facts_quote_line_id_key" ON "quote_line_risk_facts"("quote_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_line_risk_facts_organization_id_assessment_id_quote_l_key" ON "quote_line_risk_facts"("organization_id", "assessment_id", "quote_line_id");

-- CreateIndex
CREATE INDEX "quote_line_risk_limit_matches_organization_id_quote_line_id_idx" ON "quote_line_risk_limit_matches"("organization_id", "quote_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_line_risk_limit_matches_organization_id_line_risk_fac_key" ON "quote_line_risk_limit_matches"("organization_id", "line_risk_fact_id", "discount_limit_id");

-- CreateIndex
CREATE INDEX "approval_policies_organization_id_status_priority_effective_idx" ON "approval_policies"("organization_id", "status", "priority", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "approval_policies_organization_id_code_version_key" ON "approval_policies"("organization_id", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "approval_step_templates_organization_id_approval_policy_id__key" ON "approval_step_templates"("organization_id", "approval_policy_id", "sequence");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_status_requested_at_idx" ON "approval_requests"("organization_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_quote_version_id_terms_fi_idx" ON "approval_requests"("organization_id", "quote_version_id", "terms_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "approval_request_policy_matches_organization_id_approval_re_key" ON "approval_request_policy_matches"("organization_id", "approval_request_id", "approval_policy_id");

-- CreateIndex
CREATE INDEX "approval_steps_organization_id_assignee_id_status_due_at_idx" ON "approval_steps"("organization_id", "assignee_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "approval_steps_organization_id_delegate_id_status_due_at_idx" ON "approval_steps"("organization_id", "delegate_id", "status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_organization_id_approval_request_id_sequence_key" ON "approval_steps"("organization_id", "approval_request_id", "sequence");

-- CreateIndex
CREATE INDEX "approval_decisions_organization_id_approval_request_id_crea_idx" ON "approval_decisions"("organization_id", "approval_request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_organization_id_approval_step_id_key" ON "approval_decisions"("organization_id", "approval_step_id");

-- CreateIndex
CREATE INDEX "recommendation_rules_organization_id_status_priority_effect_idx" ON "recommendation_rules"("organization_id", "status", "priority", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_rules_organization_id_code_version_key" ON "recommendation_rules"("organization_id", "code", "version");

-- CreateIndex
CREATE INDEX "product_affinities_organization_id_source_product_id_status_idx" ON "product_affinities"("organization_id", "source_product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_affinities_organization_id_source_product_id_target_key" ON "product_affinities"("organization_id", "source_product_id", "target_product_id", "effective_from");

-- CreateIndex
CREATE INDEX "recommendation_interactions_organization_id_quote_id_produc_idx" ON "recommendation_interactions"("organization_id", "quote_id", "product_id", "interaction", "created_at");

-- CreateIndex
CREATE INDEX "negotiation_threads_organization_id_customer_account_id_sta_idx" ON "negotiation_threads"("organization_id", "customer_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "negotiation_threads_organization_id_quote_id_key" ON "negotiation_threads"("organization_id", "quote_id");

-- CreateIndex
CREATE INDEX "negotiation_messages_organization_id_thread_id_created_at_idx" ON "negotiation_messages"("organization_id", "thread_id", "created_at");

-- CreateIndex
CREATE INDEX "negotiation_messages_organization_id_quote_line_id_created__idx" ON "negotiation_messages"("organization_id", "quote_line_id", "created_at");

-- CreateIndex
CREATE INDEX "change_requests_organization_id_thread_id_status_created_at_idx" ON "change_requests"("organization_id", "thread_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "change_request_items_organization_id_change_request_id_quot_idx" ON "change_request_items"("organization_id", "change_request_id", "quote_line_id");

-- CreateIndex
CREATE INDEX "counteroffers_organization_id_change_request_id_status_crea_idx" ON "counteroffers"("organization_id", "change_request_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "counteroffer_items_organization_id_counteroffer_id_quote_li_key" ON "counteroffer_items"("organization_id", "counteroffer_id", "quote_line_id");

-- CreateIndex
CREATE INDEX "customer_acceptances_organization_id_quote_id_accepted_at_idx" ON "customer_acceptances"("organization_id", "quote_id", "accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_acceptances_organization_id_quote_version_id_accep_key" ON "customer_acceptances"("organization_id", "quote_version_id", "accepted_fingerprint");

-- CreateIndex
CREATE INDEX "orders_organization_id_status_updated_at_idx" ON "orders"("organization_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "orders_organization_id_customer_account_id_created_at_idx" ON "orders"("organization_id", "customer_account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_order_number_key" ON "orders"("organization_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_quote_version_id_key" ON "orders"("organization_id", "quote_version_id");

-- CreateIndex
CREATE INDEX "order_lines_organization_id_product_id_variant_id_idx" ON "order_lines"("organization_id", "product_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_organization_id_order_id_position_key" ON "order_lines"("organization_id", "order_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_organization_id_order_id_quote_line_id_key" ON "order_lines"("organization_id", "order_id", "quote_line_id");

-- CreateIndex
CREATE INDEX "warehouses_organization_id_status_name_idx" ON "warehouses"("organization_id", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organization_id_code_key" ON "warehouses"("organization_id", "code");

-- CreateIndex
CREATE INDEX "inventory_balances_organization_id_product_id_warehouse_id_idx" ON "inventory_balances"("organization_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_organization_id_warehouse_id_product_id__key" ON "inventory_balances"("organization_id", "warehouse_id", "product_id", "variant_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_warehouse_id_occurred_at_idx" ON "stock_movements"("organization_id", "warehouse_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_product_id_occurred_at_idx" ON "stock_movements"("organization_id", "product_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_reference_idx" ON "stock_movements"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "fulfillment_plans_organization_id_order_id_status_created_a_idx" ON "fulfillment_plans"("organization_id", "order_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_plans_organization_id_order_id_revision_key" ON "fulfillment_plans"("organization_id", "order_id", "revision");

-- CreateIndex
CREATE INDEX "fulfillment_allocations_organization_id_order_line_id_wareh_idx" ON "fulfillment_allocations"("organization_id", "order_line_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_allocations_organization_id_fulfillment_plan_id_key" ON "fulfillment_allocations"("organization_id", "fulfillment_plan_id", "order_line_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_fulfillment_allocation_id_key" ON "stock_reservations"("fulfillment_allocation_id");

-- CreateIndex
CREATE INDEX "stock_reservations_organization_id_order_line_id_status_idx" ON "stock_reservations"("organization_id", "order_line_id", "status");

-- CreateIndex
CREATE INDEX "stock_reservations_organization_id_inventory_balance_id_sta_idx" ON "stock_reservations"("organization_id", "inventory_balance_id", "status");

-- CreateIndex
CREATE INDEX "shipments_organization_id_order_id_status_idx" ON "shipments"("organization_id", "order_id", "status");

-- CreateIndex
CREATE INDEX "shipments_organization_id_warehouse_id_status_promised_date_idx" ON "shipments"("organization_id", "warehouse_id", "status", "promised_date");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_organization_id_shipment_number_key" ON "shipments"("organization_id", "shipment_number");

-- CreateIndex
CREATE INDEX "shipment_items_organization_id_shipment_id_order_line_id_idx" ON "shipment_items"("organization_id", "shipment_id", "order_line_id");

-- CreateIndex
CREATE INDEX "backorders_organization_id_status_created_at_idx" ON "backorders"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "backorders_organization_id_order_line_id_status_idx" ON "backorders"("organization_id", "order_line_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_customer_account_id_status_idx" ON "subscriptions"("organization_id", "customer_account_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_status_next_billing_at_idx" ON "subscriptions"("organization_id", "status", "next_billing_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_subscription_number_key" ON "subscriptions"("organization_id", "subscription_number");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_order_id_subscription_plan_id_key" ON "subscriptions"("organization_id", "order_id", "subscription_plan_id");

-- CreateIndex
CREATE INDEX "subscription_items_organization_id_subscription_id_active_f_idx" ON "subscription_items"("organization_id", "subscription_id", "active_from");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_items_organization_id_order_line_id_key" ON "subscription_items"("organization_id", "order_line_id");

-- CreateIndex
CREATE INDEX "subscription_changes_organization_id_subscription_id_effect_idx" ON "subscription_changes"("organization_id", "subscription_id", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_schedules_invoice_id_key" ON "billing_schedules"("invoice_id");

-- CreateIndex
CREATE INDEX "billing_schedules_organization_id_generation_status_due_dat_idx" ON "billing_schedules"("organization_id", "generation_status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "billing_schedules_organization_id_subscription_id_period_st_key" ON "billing_schedules"("organization_id", "subscription_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_due_date_idx" ON "invoices"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_organization_id_customer_account_id_created_at_idx" ON "invoices"("organization_id", "customer_account_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_organization_id_subscription_id_billing_period_sta_idx" ON "invoices"("organization_id", "subscription_id", "billing_period_start", "billing_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_organization_id_invoice_id_position_key" ON "invoice_lines"("organization_id", "invoice_id", "position");

-- CreateIndex
CREATE INDEX "credit_notes_organization_id_source_invoice_id_status_idx" ON "credit_notes"("organization_id", "source_invoice_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_organization_id_credit_note_number_key" ON "credit_notes"("organization_id", "credit_note_number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_lines_organization_id_credit_note_id_position_key" ON "credit_note_lines"("organization_id", "credit_note_id", "position");

-- CreateIndex
CREATE INDEX "payments_organization_id_invoice_id_payment_date_idx" ON "payments"("organization_id", "invoice_id", "payment_date");

-- CreateIndex
CREATE INDEX "payments_organization_id_status_payment_date_idx" ON "payments"("organization_id", "status", "payment_date");

-- CreateIndex
CREATE INDEX "deal_health_snapshots_organization_id_quote_id_calculated_a_idx" ON "deal_health_snapshots"("organization_id", "quote_id", "calculated_at");

-- CreateIndex
CREATE INDEX "deal_health_snapshots_organization_id_calculated_at_idx" ON "deal_health_snapshots"("organization_id", "calculated_at");

-- CreateIndex
CREATE INDEX "alerts_organization_id_status_type_detected_at_idx" ON "alerts"("organization_id", "status", "type", "detected_at");

-- CreateIndex
CREATE INDEX "alerts_organization_id_quote_id_status_idx" ON "alerts"("organization_id", "quote_id", "status");

-- CreateIndex
CREATE INDEX "alerts_organization_id_snoozed_until_idx" ON "alerts"("organization_id", "snoozed_until");

-- CreateIndex
CREATE INDEX "nudges_organization_id_alert_id_status_idx" ON "nudges"("organization_id", "alert_id", "status");

-- CreateIndex
CREATE INDEX "nudges_organization_id_status_requested_at_idx" ON "nudges"("organization_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_entity_type_entity_id_occurred_idx" ON "audit_events"("organization_id", "entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_actor_id_occurred_at_idx" ON "audit_events"("organization_id", "actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_occurred_at_idx" ON "audit_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "deal_events_organization_id_quote_id_occurred_at_idx" ON "deal_events"("organization_id", "quote_id", "occurred_at");

-- CreateIndex
CREATE INDEX "deal_events_organization_id_quote_id_visibility_occurred_at_idx" ON "deal_events"("organization_id", "quote_id", "visibility", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_organization_id_aggregate_type_aggregate_id_c_idx" ON "outbox_events"("organization_id", "aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_organization_id_deduplication_key_key" ON "outbox_events"("organization_id", "deduplication_key");

-- CreateIndex
CREATE INDEX "idempotency_records_organization_id_status_expires_at_idx" ON "idempotency_records"("organization_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_actor_type_actor_id_com_key" ON "idempotency_records"("organization_id", "actor_type", "actor_id", "command", "key");

-- CreateIndex
CREATE INDEX "export_jobs_organization_id_status_created_at_idx" ON "export_jobs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_organization_id_requested_by_id_created_at_idx" ON "export_jobs"("organization_id", "requested_by_id", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_status_expires_at_idx" ON "export_jobs"("status", "expires_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_user_id_status_crea_idx" ON "notifications"("organization_id", "recipient_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_portal_identity_id__idx" ON "notifications"("organization_id", "recipient_portal_identity_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "saved_report_filters_organization_id_report_type_idx" ON "saved_report_filters"("organization_id", "report_type");

-- CreateIndex
CREATE UNIQUE INDEX "saved_report_filters_organization_id_user_id_name_key" ON "saved_report_filters"("organization_id", "user_id", "name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_teams" ADD CONSTRAINT "sales_teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_teams" ADD CONSTRAINT "sales_teams_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_sales_team_id_fkey" FOREIGN KEY ("sales_team_id") REFERENCES "sales_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tiers" ADD CONSTRAINT "customer_tiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_sales_team_id_fkey" FOREIGN KEY ("sales_team_id") REFERENCES "sales_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_assigned_rep_id_fkey" FOREIGN KEY ("assigned_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_identities" ADD CONSTRAINT "portal_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_identities" ADD CONSTRAINT "portal_identities_customer_contact_id_fkey" FOREIGN KEY ("customer_contact_id") REFERENCES "customer_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_limits" ADD CONSTRAINT "discount_limits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sales_team_id_fkey" FOREIGN KEY ("sales_team_id") REFERENCES "sales_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_risk_assessments" ADD CONSTRAINT "quote_risk_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_risk_assessments" ADD CONSTRAINT "quote_risk_assessments_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_facts" ADD CONSTRAINT "quote_line_risk_facts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_facts" ADD CONSTRAINT "quote_line_risk_facts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "quote_risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_facts" ADD CONSTRAINT "quote_line_risk_facts_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_limit_matches" ADD CONSTRAINT "quote_line_risk_limit_matches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_limit_matches" ADD CONSTRAINT "quote_line_risk_limit_matches_line_risk_fact_id_fkey" FOREIGN KEY ("line_risk_fact_id") REFERENCES "quote_line_risk_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_limit_matches" ADD CONSTRAINT "quote_line_risk_limit_matches_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_risk_limit_matches" ADD CONSTRAINT "quote_line_risk_limit_matches_discount_limit_id_fkey" FOREIGN KEY ("discount_limit_id") REFERENCES "discount_limits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_step_templates" ADD CONSTRAINT "approval_step_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_step_templates" ADD CONSTRAINT "approval_step_templates_approval_policy_id_fkey" FOREIGN KEY ("approval_policy_id") REFERENCES "approval_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_policy_matches" ADD CONSTRAINT "approval_request_policy_matches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_policy_matches" ADD CONSTRAINT "approval_request_policy_matches_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_policy_matches" ADD CONSTRAINT "approval_request_policy_matches_approval_policy_id_fkey" FOREIGN KEY ("approval_policy_id") REFERENCES "approval_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_step_template_id_fkey" FOREIGN KEY ("approval_step_template_id") REFERENCES "approval_step_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_step_id_fkey" FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_source_product_id_fkey" FOREIGN KEY ("source_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_interactions" ADD CONSTRAINT "recommendation_interactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_interactions" ADD CONSTRAINT "recommendation_interactions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_interactions" ADD CONSTRAINT "recommendation_interactions_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_interactions" ADD CONSTRAINT "recommendation_interactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "negotiation_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "negotiation_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_source_quote_version_id_fkey" FOREIGN KEY ("source_quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_portal_id_fkey" FOREIGN KEY ("requested_by_portal_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_resulting_quote_version_id_fkey" FOREIGN KEY ("resulting_quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_items" ADD CONSTRAINT "change_request_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_items" ADD CONSTRAINT "change_request_items_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_items" ADD CONSTRAINT "change_request_items_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffers" ADD CONSTRAINT "counteroffers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffers" ADD CONSTRAINT "counteroffers_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffers" ADD CONSTRAINT "counteroffers_source_quote_version_id_fkey" FOREIGN KEY ("source_quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffers" ADD CONSTRAINT "counteroffers_offered_by_user_id_fkey" FOREIGN KEY ("offered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffers" ADD CONSTRAINT "counteroffers_customer_decision_portal_id_fkey" FOREIGN KEY ("customer_decision_portal_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffers" ADD CONSTRAINT "counteroffers_resulting_quote_version_id_fkey" FOREIGN KEY ("resulting_quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffer_items" ADD CONSTRAINT "counteroffer_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffer_items" ADD CONSTRAINT "counteroffer_items_counteroffer_id_fkey" FOREIGN KEY ("counteroffer_id") REFERENCES "counteroffers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counteroffer_items" ADD CONSTRAINT "counteroffer_items_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_acceptances" ADD CONSTRAINT "customer_acceptances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_acceptances" ADD CONSTRAINT "customer_acceptances_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_acceptances" ADD CONSTRAINT "customer_acceptances_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_acceptances" ADD CONSTRAINT "customer_acceptances_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_balance_id_fkey" FOREIGN KEY ("inventory_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_reservation_id_fkey" FOREIGN KEY ("stock_reservation_id") REFERENCES "stock_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_fulfillment_plan_id_fkey" FOREIGN KEY ("fulfillment_plan_id") REFERENCES "fulfillment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_inventory_balance_id_fkey" FOREIGN KEY ("inventory_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_fulfillment_allocation_id_fkey" FOREIGN KEY ("fulfillment_allocation_id") REFERENCES "fulfillment_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_stock_reservation_id_fkey" FOREIGN KEY ("stock_reservation_id") REFERENCES "stock_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backorders" ADD CONSTRAINT "backorders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backorders" ADD CONSTRAINT "backorders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backorders" ADD CONSTRAINT "backorders_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backorders" ADD CONSTRAINT "backorders_consolidated_into_id_fkey" FOREIGN KEY ("consolidated_into_id") REFERENCES "backorders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_subscription_item_id_fkey" FOREIGN KEY ("subscription_item_id") REFERENCES "subscription_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_subscription_item_id_fkey" FOREIGN KEY ("subscription_item_id") REFERENCES "subscription_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_subscription_change_id_fkey" FOREIGN KEY ("subscription_change_id") REFERENCES "subscription_changes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_applied_invoice_id_fkey" FOREIGN KEY ("applied_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_subscription_change_id_fkey" FOREIGN KEY ("subscription_change_id") REFERENCES "subscription_changes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_source_invoice_line_id_fkey" FOREIGN KEY ("source_invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_subscription_change_id_fkey" FOREIGN KEY ("subscription_change_id") REFERENCES "subscription_changes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_health_snapshots" ADD CONSTRAINT "deal_health_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_health_snapshots" ADD CONSTRAINT "deal_health_snapshots_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_deal_health_snapshot_id_fkey" FOREIGN KEY ("deal_health_snapshot_id") REFERENCES "deal_health_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "customer_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_portal_identity_id_fkey" FOREIGN KEY ("recipient_portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_report_filters" ADD CONSTRAINT "saved_report_filters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_report_filters" ADD CONSTRAINT "saved_report_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
