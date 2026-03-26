-- Add distribution_config to exam_sessions for auto-distribution
ALTER TABLE exam_sessions
ADD COLUMN distribution_config JSON NULL COMMENT 'Stores distribution strategy and config for auto-assignment',
ADD COLUMN auto_distributed BOOLEAN DEFAULT FALSE COMMENT 'Whether auto-distribution has run for this exam';
