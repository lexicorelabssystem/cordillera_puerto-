ALTER TABLE "export_jobs"
ADD COLUMN IF NOT EXISTS "bull_job_id" TEXT,
ADD COLUMN IF NOT EXISTS "institution_id" UUID,
ADD COLUMN IF NOT EXISTS "error_message" TEXT,
ADD COLUMN IF NOT EXISTS "row_count" INTEGER;

CREATE INDEX IF NOT EXISTS "export_jobs_bull_job_id_idx"
ON "export_jobs"("bull_job_id");
