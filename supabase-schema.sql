-- ============================================================
-- GATURA GIRLS LEARNING PORTAL — Full Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. ACADEMIC YEARS
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO academic_years (year, is_active) VALUES (2026, TRUE);
INSERT INTO academic_years (year, is_active) VALUES (2027, FALSE);
INSERT INTO academic_years (year, is_active) VALUES (2028, FALSE);

-- 2. STREAMS
CREATE TABLE streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name IN ('Blue','Green','Magenta','Red','White','Yellow')),
  academic_year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, academic_year)
);

INSERT INTO streams (name, academic_year) VALUES ('Blue', 2026);
INSERT INTO streams (name, academic_year) VALUES ('Green', 2026);
INSERT INTO streams (name, academic_year) VALUES ('Magenta', 2026);
INSERT INTO streams (name, academic_year) VALUES ('Red', 2026);
INSERT INTO streams (name, academic_year) VALUES ('White', 2026);
INSERT INTO streams (name, academic_year) VALUES ('Yellow', 2026);

-- 3. PROFILES (all users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  admission_number TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  stream TEXT CHECK (stream IN ('Blue','Green','Magenta','Red','White','Yellow')),
  grade INTEGER CHECK (grade IN (10, 11, 12)),
  academic_year INTEGER DEFAULT 2026,
  must_change_pin BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBJECTS
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stream_id UUID REFERENCES streams ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles ON DELETE SET NULL,
  academic_year INTEGER DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ASSIGNMENTS
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  subject_id UUID REFERENCES subjects ON DELETE CASCADE,
  stream_id UUID REFERENCES streams ON DELETE CASCADE,
  due_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUBMISSIONS
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments ON DELETE CASCADE,
  student_id UUID REFERENCES profiles ON DELETE CASCADE,
  answer_text TEXT,
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade TEXT,
  feedback TEXT,
  graded_at TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

-- 7. ANNOUNCEMENTS
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  stream_id UUID REFERENCES streams ON DELETE CASCADE,
  created_by UUID REFERENCES profiles ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: get current user's stream
CREATE OR REPLACE FUNCTION get_user_stream()
RETURNS TEXT AS $$
  SELECT stream FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ---- PROFILES ----
-- Admins: full access
CREATE POLICY "Admins full access to profiles"
  ON profiles FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Teachers: read all profiles, update own
CREATE POLICY "Teachers read all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() = 'teacher');

CREATE POLICY "Teachers update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid() AND get_user_role() = 'teacher')
  WITH CHECK (id = auth.uid());

-- Students: read own profile + classmates, update own
CREATE POLICY "Students read own profile"
  ON profiles FOR SELECT
  USING (get_user_role() = 'student' AND (id = auth.uid() OR role = 'teacher'));

CREATE POLICY "Students update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid() AND get_user_role() = 'student')
  WITH CHECK (id = auth.uid());

-- ---- STREAMS ----
CREATE POLICY "Anyone can read streams"
  ON streams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage streams"
  ON streams FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- ACADEMIC YEARS ----
CREATE POLICY "Anyone can read academic years"
  ON academic_years FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage academic years"
  ON academic_years FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- SUBJECTS ----
CREATE POLICY "Anyone can read subjects"
  ON subjects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage subjects"
  ON subjects FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- ASSIGNMENTS ----
CREATE POLICY "Students read assignments for own stream"
  ON assignments FOR SELECT
  USING (
    get_user_role() = 'student'
    AND stream_id IN (
      SELECT s.id FROM streams s WHERE s.name = get_user_stream()
    )
  );

CREATE POLICY "Teachers read own assignments"
  ON assignments FOR SELECT
  USING (get_user_role() = 'teacher');

CREATE POLICY "Teachers create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    get_user_role() = 'teacher'
    AND created_by = auth.uid()
  );

CREATE POLICY "Teachers update own assignments"
  ON assignments FOR UPDATE
  USING (get_user_role() = 'teacher' AND created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Teachers delete own assignments"
  ON assignments FOR DELETE
  USING (get_user_role() = 'teacher' AND created_by = auth.uid());

CREATE POLICY "Admins manage assignments"
  ON assignments FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- SUBMISSIONS ----
CREATE POLICY "Students read own submissions"
  ON submissions FOR SELECT
  USING (get_user_role() = 'student' AND student_id = auth.uid());

CREATE POLICY "Students create own submissions"
  ON submissions FOR INSERT
  WITH CHECK (get_user_role() = 'student' AND student_id = auth.uid());

CREATE POLICY "Students update own submissions before grading"
  ON submissions FOR UPDATE
  USING (
    get_user_role() = 'student'
    AND student_id = auth.uid()
    AND grade IS NULL
  )
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers read submissions for their subjects"
  ON submissions FOR SELECT
  USING (
    get_user_role() = 'teacher'
    AND assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE sub.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers grade submissions"
  ON submissions FOR UPDATE
  USING (
    get_user_role() = 'teacher'
    AND assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE sub.teacher_id = auth.uid()
    )
  )
  WITH CHECK (TRUE);

CREATE POLICY "Admins manage submissions"
  ON submissions FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ---- ANNOUNCEMENTS ----
CREATE POLICY "Students read announcements for own stream"
  ON announcements FOR SELECT
  USING (
    get_user_role() = 'student'
    AND stream_id IN (
      SELECT s.id FROM streams s WHERE s.name = get_user_stream()
    )
  );

CREATE POLICY "Teachers manage own announcements"
  ON announcements FOR ALL
  USING (get_user_role() = 'teacher')
  WITH CHECK (get_user_role() = 'teacher' AND created_by = auth.uid());

CREATE POLICY "Admins manage announcements"
  ON announcements FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================
-- STORAGE BUCKET FOR SUBMISSIONS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', FALSE);

-- Students can upload to their own folder
CREATE POLICY "Students upload own submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Students can read own files
CREATE POLICY "Students read own submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Teachers can read submission files for their subjects
CREATE POLICY "Teachers read submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submissions'
    AND EXISTS (
      SELECT 1 FROM subjects WHERE teacher_id = auth.uid()
    )
  );

-- Admins full access to storage
CREATE POLICY "Admins full access to storage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'submissions'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- SEED: Create default admin account
-- Run after creating the auth user manually or via Supabase dashboard
-- Email: admin@gatura.school / Password: Change-Me-123!
-- ============================================================
-- NOTE: You need to create the admin user in Supabase Auth first,
-- then insert the profile row using the auth user's UUID.
-- Example (replace UUID with actual):
-- INSERT INTO profiles (id, full_name, admission_number, role, must_change_pin)
-- VALUES ('your-admin-auth-uuid', 'System Administrator', 'admin001', 'admin', FALSE);
