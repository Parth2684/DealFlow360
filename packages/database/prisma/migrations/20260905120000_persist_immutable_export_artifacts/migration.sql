CREATE TABLE "export_artifacts" (
    "export_job_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "content" BYTEA NOT NULL,
    "content_type" VARCHAR(160) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("export_job_id"),
    CONSTRAINT "export_artifacts_export_job_id_organization_id_key"
        UNIQUE ("export_job_id", "organization_id"),
    CONSTRAINT "export_artifacts_row_count_check" CHECK ("row_count" >= 0)
);

CREATE INDEX "export_artifacts_organization_id_created_at_idx"
ON "export_artifacts"("organization_id", "created_at");

ALTER TABLE "export_jobs"
ADD CONSTRAINT "export_jobs_id_organization_id_key"
UNIQUE ("id", "organization_id");

ALTER TABLE "export_artifacts"
ADD CONSTRAINT "export_artifacts_export_job_id_organization_id_fkey"
FOREIGN KEY ("export_job_id", "organization_id")
REFERENCES "export_jobs"("id", "organization_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_artifacts"
ADD CONSTRAINT "export_artifacts_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
