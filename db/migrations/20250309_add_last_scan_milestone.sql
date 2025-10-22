-- Add last_scan_milestone column to track the highest milestone already notified
ALTER TABLE locks ADD COLUMN last_scan_milestone INTEGER NOT NULL DEFAULT 0;

