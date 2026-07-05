-- Enforce Chilean grading scale 1.0-7.0 at the database level (idempotent)
DO $$ BEGIN
  ALTER TABLE grades ADD CONSTRAINT grade_range_1_to_7 CHECK (grade >= 1.0 AND grade <= 7.0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE grades VALIDATE CONSTRAINT grade_range_1_to_7;
