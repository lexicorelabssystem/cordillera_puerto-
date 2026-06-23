-- Add FK constraint from student_answers.selectedOptionId to question_options(id)
-- NOT VALID avoids scanning existing rows; VALIDATE CONSTRAINT runs after without blocking.
ALTER TABLE student_answers
  ADD CONSTRAINT student_answers_selectedOptionId_fkey
  FOREIGN KEY ("selectedOptionId") REFERENCES question_options(id)
  NOT VALID;

ALTER TABLE student_answers
  VALIDATE CONSTRAINT student_answers_selectedOptionId_fkey;
