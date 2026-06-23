-- Create native PostgreSQL enums to replace String status fields
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

CREATE TYPE "PeriodStatus" AS ENUM (
  'ACTIVE',
  'CLOSED'
);

-- Alter columns (USING clause casts existing strings to the new enum)
ALTER TABLE assessments
  ALTER COLUMN status TYPE "AssessmentStatus" USING status::"AssessmentStatus";

ALTER TABLE periods
  ALTER COLUMN status TYPE "PeriodStatus" USING status::"PeriodStatus";
