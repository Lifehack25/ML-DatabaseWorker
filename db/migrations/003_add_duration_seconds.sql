-- Add duration_seconds column to media_objects table for video duration tracking
ALTER TABLE media_objects ADD COLUMN duration_seconds INTEGER;
