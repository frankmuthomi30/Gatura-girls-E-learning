-- ============================================================
-- MIGRATION: Enhanced Assignments & Live Exams System
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. ADD NEW COLUMNS TO ASSIGNMENTS TABLE
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'file_upload'
    CHECK (mode IN ('mcq','theory','mixed','practical','exam','file_upload')),
  ADD COLUMN IF NOT EXISTS time_limit INTEGER,          -- minutes (NULL = untimed)
  ADD COLUMN IF NOT EXISTS is_exam BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','published','active','closed'));

-- Set existing assignments to published + file_upload mode
UPDATE assignments SET mode = 'file_upload', status = 'published'
  WHERE mode IS NULL OR status IS NULL;

-- 2. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq','short_answer','structured')),
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  marking_scheme TEXT,            -- expected answer / rubric for theory
  instructions TEXT,              -- extra instructions for practical steps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_assignment ON questions(assignment_id);

-- 3. QUESTION OPTIONS TABLE (for MCQ)
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions ON DELETE CASCADE,
  option_label TEXT NOT NULL,     -- 'A','B','C','D'
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_options_question ON question_options(question_id);

-- 4. EXAM SESSIONS TABLE (tracks each student's exam attempt)
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','submitted','timed_out','left')),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  time_remaining INTEGER,        -- seconds remaining when last saved
  score INTEGER,                 -- auto-calculated for MCQ
  total_points INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_assignment ON exam_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student ON exam_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

-- 5. STUDENT ANSWERS TABLE
CREATE TABLE IF NOT EXISTS student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions ON DELETE CASCADE,
  answer_text TEXT,              -- for theory / short answer
  selected_option_id UUID REFERENCES question_options ON DELETE SET NULL,
  is_correct BOOLEAN,           -- auto-graded for MCQ
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (exam_session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_session ON student_answers(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON student_answers(question_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

-- ---- QUESTIONS ----
CREATE POLICY "Anyone authenticated can read questions"
  ON questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers manage questions for their assignments"
  ON questions FOR ALL
  USING (
    get_user_role() = 'teacher'
    AND assignment_id IN (SELECT id FROM assignments WHERE created_by = auth.uid())
  )
  WITH CHECK (
    get_user_role() = 'teacher'
    AND assignment_id IN (SELECT id FROM assignments WHERE created_by = auth.uid())
  );

CREATE POLICY "Admins manage all questions"
  ON questions FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- QUESTION OPTIONS ----
CREATE POLICY "Anyone authenticated can read options"
  ON question_options FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers manage options for their questions"
  ON question_options FOR ALL
  USING (
    get_user_role() = 'teacher'
    AND question_id IN (
      SELECT q.id FROM questions q
      JOIN assignments a ON q.assignment_id = a.id
      WHERE a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role() = 'teacher'
    AND question_id IN (
      SELECT q.id FROM questions q
      JOIN assignments a ON q.assignment_id = a.id
      WHERE a.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins manage all options"
  ON question_options FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- EXAM SESSIONS ----
CREATE POLICY "Students read own exam sessions"
  ON exam_sessions FOR SELECT
  USING (get_user_role() = 'student' AND student_id = auth.uid());

CREATE POLICY "Students create own exam sessions"
  ON exam_sessions FOR INSERT
  WITH CHECK (get_user_role() = 'student' AND student_id = auth.uid());

CREATE POLICY "Students update own active exam sessions"
  ON exam_sessions FOR UPDATE
  USING (get_user_role() = 'student' AND student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers read exam sessions for their assignments"
  ON exam_sessions FOR SELECT
  USING (
    get_user_role() = 'teacher'
    AND assignment_id IN (SELECT id FROM assignments WHERE created_by = auth.uid())
  );

CREATE POLICY "Teachers update exam sessions for their assignments"
  ON exam_sessions FOR UPDATE
  USING (
    get_user_role() = 'teacher'
    AND assignment_id IN (SELECT id FROM assignments WHERE created_by = auth.uid())
  )
  WITH CHECK (TRUE);

CREATE POLICY "Admins manage all exam sessions"
  ON exam_sessions FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- STUDENT ANSWERS ----
CREATE POLICY "Students read own answers"
  ON student_answers FOR SELECT
  USING (
    get_user_role() = 'student'
    AND exam_session_id IN (SELECT id FROM exam_sessions WHERE student_id = auth.uid())
  );

CREATE POLICY "Students create own answers"
  ON student_answers FOR INSERT
  WITH CHECK (
    get_user_role() = 'student'
    AND exam_session_id IN (SELECT id FROM exam_sessions WHERE student_id = auth.uid())
  );

CREATE POLICY "Students update own answers"
  ON student_answers FOR UPDATE
  USING (
    get_user_role() = 'student'
    AND exam_session_id IN (SELECT id FROM exam_sessions WHERE student_id = auth.uid())
  )
  WITH CHECK (
    exam_session_id IN (SELECT id FROM exam_sessions WHERE student_id = auth.uid())
  );

CREATE POLICY "Teachers read answers for their assignments"
  ON student_answers FOR SELECT
  USING (
    get_user_role() = 'teacher'
    AND exam_session_id IN (
      SELECT es.id FROM exam_sessions es
      JOIN assignments a ON es.assignment_id = a.id
      WHERE a.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins manage all answers"
  ON student_answers FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================
-- ENABLE REALTIME for exam monitoring
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE exam_sessions;
