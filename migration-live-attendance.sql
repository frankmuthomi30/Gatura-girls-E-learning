-- Live class attendance tracking
CREATE TABLE IF NOT EXISTS live_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_live_attendance_session ON live_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_live_attendance_student ON live_attendance(student_id);

-- RLS
ALTER TABLE live_attendance ENABLE ROW LEVEL SECURITY;

-- Students can insert their own attendance
CREATE POLICY "Students can record own attendance"
  ON live_attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Teachers and students can read attendance
CREATE POLICY "Authenticated users can read attendance"
  ON live_attendance FOR SELECT TO authenticated
  USING (true);
