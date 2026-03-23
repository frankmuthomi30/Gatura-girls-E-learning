-- ============================================================
-- MIGRATION: Grade Public Chat Rooms
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_grade()
RETURNS INTEGER AS $$
  SELECT grade FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE TABLE IF NOT EXISTS grade_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade INTEGER NOT NULL CHECK (grade IN (10, 11, 12)),
  sender_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  reply_to_id UUID REFERENCES grade_chat_messages(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grade_chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES grade_chat_messages(id) ON DELETE SET NULL;

ALTER TABLE grade_chat_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_grade_chat_messages_grade_created_at
  ON grade_chat_messages(grade, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grade_chat_messages_reply_to_id
  ON grade_chat_messages(reply_to_id);

ALTER TABLE grade_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read grade chat" ON grade_chat_messages;
CREATE POLICY "Students read grade chat"
  ON grade_chat_messages FOR SELECT
  USING (
    get_user_role() = 'student'
    AND grade = get_user_grade()
  );

DROP POLICY IF EXISTS "Teachers read grade chat" ON grade_chat_messages;
CREATE POLICY "Teachers read grade chat"
  ON grade_chat_messages FOR SELECT
  USING (get_user_role() = 'teacher');

DROP POLICY IF EXISTS "Admins read grade chat" ON grade_chat_messages;
CREATE POLICY "Admins read grade chat"
  ON grade_chat_messages FOR SELECT
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Students post grade chat" ON grade_chat_messages;
CREATE POLICY "Students post grade chat"
  ON grade_chat_messages FOR INSERT
  WITH CHECK (
    get_user_role() = 'student'
    AND sender_id = auth.uid()
    AND grade = get_user_grade()
  );

DROP POLICY IF EXISTS "Teachers post grade chat" ON grade_chat_messages;
CREATE POLICY "Teachers post grade chat"
  ON grade_chat_messages FOR INSERT
  WITH CHECK (
    get_user_role() = 'teacher'
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins post grade chat" ON grade_chat_messages;
CREATE POLICY "Admins post grade chat"
  ON grade_chat_messages FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students update own grade chat" ON grade_chat_messages;
CREATE POLICY "Students update own grade chat"
  ON grade_chat_messages FOR UPDATE
  USING (
    get_user_role() = 'student'
    AND sender_id = auth.uid()
    AND grade = get_user_grade()
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND grade = get_user_grade()
  );

DROP POLICY IF EXISTS "Students delete own grade chat" ON grade_chat_messages;
CREATE POLICY "Students delete own grade chat"
  ON grade_chat_messages FOR DELETE
  USING (
    get_user_role() = 'student'
    AND sender_id = auth.uid()
    AND grade = get_user_grade()
  );

DROP POLICY IF EXISTS "Admins manage grade chat" ON grade_chat_messages;
CREATE POLICY "Admins manage grade chat"
  ON grade_chat_messages FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'grade_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE grade_chat_messages;
  END IF;
END $$;