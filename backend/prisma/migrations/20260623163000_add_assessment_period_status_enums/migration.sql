-- Create native PostgreSQL enums if they do not already exist.
DO $$ BEGIN
  CREATE TYPE "AssessmentStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ACTIVE',
    'CLOSED',
    'IN_GRADING',
    'GRADED',
    'REPORTED',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PeriodStatus" AS ENUM (
    'ACTIVE',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Convert assessments.status from text to AssessmentStatus.
ALTER TABLE "assessments"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "assessments"
  ALTER COLUMN "status" TYPE "AssessmentStatus"
  USING ("status"::text::"AssessmentStatus");

ALTER TABLE "assessments"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"AssessmentStatus";

-- Convert periods.status from text to PeriodStatus.
ALTER TABLE "periods"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "periods"
  ALTER COLUMN "status" TYPE "PeriodStatus"
  USING ("status"::text::"PeriodStatus");

ALTER TABLE "periods"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"PeriodStatus";
