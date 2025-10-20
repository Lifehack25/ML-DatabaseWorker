-- Migration: Add last_notification_prompt field for notification permission cooldown
-- This migration adds a field to track when the user was last prompted for notification permissions
-- Used to implement 12-hour cooldown between prompts when user declines

ALTER TABLE users ADD COLUMN last_notification_prompt DATETIME;
