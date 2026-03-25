-- ============================================================
-- SECURITY AUDIT LOG + FORCE STAFF PASSWORD RESET
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Security Audit Log table
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user and time
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id
  ON security_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_action
  ON security_audit_log(action, created_at DESC);

-- RLS: Only admins can read audit logs, system inserts via service role
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON security_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Force all existing admin/teacher accounts to change their PIN → password
-- This makes them go through the new strong password flow on next login
UPDATE profiles
SET must_change_pin = TRUE
WHERE role IN ('admin', 'teacher');

-- 3. Add password_changed_at column to track when passwords were last updated
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
