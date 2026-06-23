-- Create native PostgreSQL enums (idempotent: skip if already exist)
DO $$ BEGIN
  CREATE TYPE "AssessmentStatus" AS ENUM (
    'DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED',
    'IN_GRADING', 'GRADED', 'REPORTED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PeriodStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Alter assessment status column (idempotent: skip if already enum)
DO $$ BEGIN
  ALTER TABLE assessments
    ALTER COLUMN status TYPE "AssessmentStatus" USING status::"AssessmentStatus";
EXCEPTION WHEN duplicate_object OR invalid_text_representation THEN NULL;
END $$;

-- Alter period status column (idempotent: skip if already enum)
DO $$ BEGIN
  ALTER TABLE periods
    ALTER COLUMN status TYPE "PeriodStatus" USING status::"PeriodStatus";
EXCEPTION WHEN duplicate_object OR invalid_text_representation THEN NULL;
END $$;
