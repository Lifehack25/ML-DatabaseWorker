-- Migration: Replace media_type (string) with is_image (boolean)
-- This migration converts the string-based media_type field to a boolean is_image field

-- Step 1: Add new column is_image as INTEGER (SQLite's boolean type)
ALTER TABLE media_objects ADD COLUMN is_image INTEGER NOT NULL DEFAULT 1;

-- Step 2: Migrate existing data
-- Set is_image = 1 (true) for images, is_image = 0 (false) for videos
UPDATE media_objects
SET is_image = CASE
    WHEN media_type = 'image' THEN 1
    ELSE 0
END;

-- Step 3: Drop the old media_type column
ALTER TABLE media_objects DROP COLUMN media_type;

-- Note: After this migration, all code should use is_image instead of media_type
