-- Enforce Chilean grading scale 1.0-7.0 at the database level
-- NOT VALID avoids exclusive lock while scanning existing rows;
-- VALIDATE CONSTRAINT runs immediately after without blocking writes.
ALTER TABLE grades ADD CONSTRAINT grade_range_1_to_7 CHECK (grade >= 1.0 AND grade <= 7.0) NOT VALID;
ALTER TABLE grades VALIDATE CONSTRAINT grade_range_1_to_7;
