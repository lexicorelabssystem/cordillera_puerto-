-- Add FK from student_answers.selectedOptionId to question_options(id) (idempotent)
-- NOT VALID avoids scanning existing rows; VALIDATE runs after without blocking.
DO $$ BEGIN
  ALTER TABLE student_answers
    ADD CONSTRAINT student_answers_selectedOptionId_fkey
    FOREIGN KEY ("selectedOptionId") REFERENCES question_options(id)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE student_answers VALIDATE CONSTRAINT student_answers_selectedOptionId_fkey;
