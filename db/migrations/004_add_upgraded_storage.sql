-- Migration: Add upgraded_storage field for two-tier storage system
-- This migration adds a field to track whether a lock has been upgraded to Tier 2 storage
-- Tier 1 (default): 25 images, 60 seconds video
-- Tier 2 (upgraded): 50 images, 120 seconds video
-- Note: Already applied manually in production

ALTER TABLE locks ADD COLUMN upgraded_storage INTEGER NOT NULL DEFAULT 0;
