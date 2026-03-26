-- Add marks and feedback columns to submissions table
ALTER TABLE submissions
ADD COLUMN marks DECIMAL(10, 2) NULL COMMENT 'Score/marks awarded by teacher',
ADD COLUMN feedback TEXT NULL COMMENT 'Teacher feedback on the submission';
