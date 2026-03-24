-- ============================================================
-- MIGRATION: Chat Grade Mute Settings
-- Run this in your Supabase SQL Editor
-- Allows admins to mute chat for specific grades
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_grade_settings (
  grade INTEGER PRIMARY KEY CHECK (grade IN (10, 11, 12)),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  muted_at TIMESTAMPTZ,
  muted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed rows for each grade
INSERT INTO chat_grade_settings (grade, muted)
VALUES (10, false), (11, false), (12, false)
ON CONFLICT (grade) DO NOTHING;

ALTER TABLE chat_grade_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read mute status
DROP POLICY IF EXISTS "Anyone can read chat settings" ON chat_grade_settings;
CREATE POLICY "Anyone can read chat settings"
  ON chat_grade_settings FOR SELECT
  USING (true);

-- Only admins can update mute status
DROP POLICY IF EXISTS "Admins manage chat settings" ON chat_grade_settings;
CREATE POLICY "Admins manage chat settings"
  ON chat_grade_settings FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
