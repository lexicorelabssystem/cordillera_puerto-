CREATE TABLE "archive_records" (
  "id" UUID NOT NULL,
  "scope_key" TEXT NOT NULL,
  "institution_id" UUID,
  "cutoff_date" TIMESTAMPTZ NOT NULL,
  "semester" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "storage_path" TEXT,
  "checksum" TEXT,
  "record_counts" JSONB,
  "retention_until" TIMESTAMPTZ NOT NULL,
  "requested_by_id" UUID,
  "archived_at" TIMESTAMPTZ,
  "restored_at" TIMESTAMPTZ,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "archive_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "archive_records_scope_key_key" ON "archive_records"("scope_key");
CREATE INDEX "archive_records_status_cutoff_date_idx" ON "archive_records"("status", "cutoff_date");
CREATE INDEX "archive_records_institution_id_archived_at_idx" ON "archive_records"("institution_id", "archived_at");
CREATE INDEX "archive_records_retention_until_idx" ON "archive_records"("retention_until");