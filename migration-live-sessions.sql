-- Migration: Live Class Sessions (Jitsi-based)
-- Teachers can start/end live video classes
-- Students see live indicator and join the same room

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  grade INT,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher ON live_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_started ON live_sessions(started_at DESC);

-- RLS
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own sessions"
  ON live_sessions FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Authenticated users can view sessions"
  ON live_sessions FOR SELECT TO authenticated
  USING (true);
