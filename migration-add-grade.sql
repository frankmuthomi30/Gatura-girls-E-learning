-- ============================================================
-- MIGRATION: Add grade column to profiles
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add the grade column (10, 11, 12) to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS grade INTEGER CHECK (grade IN (10, 11, 12));

-- Set all existing students to Grade 10 (2026 cohort)
UPDATE profiles SET grade = 10 WHERE role = 'student' AND grade IS NULL;
