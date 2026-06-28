CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" UUID NOT NULL,
  "job_type" TEXT NOT NULL,
  "queue_name" TEXT NOT NULL,
  "bull_job_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "result" JSONB,
  "error_message" TEXT,
  "requested_by_id" UUID,
  "institution_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "background_jobs_job_type_status_idx" ON "background_jobs"("job_type", "status");
CREATE INDEX IF NOT EXISTS "background_jobs_bull_job_id_idx" ON "background_jobs"("bull_job_id");
CREATE INDEX IF NOT EXISTS "background_jobs_requested_by_id_idx" ON "background_jobs"("requested_by_id");