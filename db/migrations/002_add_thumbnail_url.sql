-- Migration: Add thumbnail_url column to media_objects table
-- This allows storing optimized thumbnail URLs separately from full-size images
-- Thumbnails use Cloudflare Images "thumb" variant or Stream thumbnail URLs

ALTER TABLE media_objects ADD COLUMN thumbnail_url TEXT;
