ALTER TABLE "approval_steps"
ADD COLUMN "delegate_assigned_at" TIMESTAMPTZ(3),
ADD COLUMN "delegate_expires_at" TIMESTAMPTZ(3),
ADD COLUMN "delegate_assigned_by_id" UUID,
ADD COLUMN "delegate_reason" VARCHAR(500);

ALTER TABLE "approval_steps"
ADD CONSTRAINT "approval_steps_delegate_assigned_by_id_fkey"
FOREIGN KEY ("delegate_assigned_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_steps"
ADD CONSTRAINT "approval_steps_delegation_metadata_check"
CHECK (
  (
    "delegate_id" IS NULL
    AND "delegate_assigned_at" IS NULL
    AND "delegate_expires_at" IS NULL
    AND "delegate_assigned_by_id" IS NULL
    AND "delegate_reason" IS NULL
  )
  OR
  (
    "delegate_id" IS NOT NULL
    AND "delegate_assigned_at" IS NOT NULL
    AND "delegate_expires_at" IS NOT NULL
    AND "delegate_assigned_by_id" IS NOT NULL
    AND "delegate_reason" IS NOT NULL
    AND length(btrim("delegate_reason")) > 0
    AND "delegate_expires_at" > "delegate_assigned_at"
    AND ("assignee_id" IS NULL OR "delegate_id" <> "assignee_id")
  )
) NOT VALID;

-- `NOT VALID` preserves installations that used the scaffold's old bare
-- delegate_id before provenance existed. PostgreSQL still enforces this check
-- for every new or updated assignment; the API treats legacy incomplete rows
-- as unauthorized until they are cleared or reassigned through the new route.

CREATE INDEX "approval_steps_organization_id_status_delegate_expires_at_idx"
ON "approval_steps"("organization_id", "status", "delegate_expires_at");
