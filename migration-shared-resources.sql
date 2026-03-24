-- Migration: Shared Resources (YouTube links, website links)
-- Teachers can share links targeted to specific streams/grades
-- Students see embedded videos and get alerted about new posts

CREATE TABLE IF NOT EXISTS shared_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL DEFAULT 'link' CHECK (resource_type IN ('youtube', 'link')),
  thumbnail_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  grade INT,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_shared_resources_created_at ON shared_resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_resources_stream ON shared_resources(stream_id);
CREATE INDEX IF NOT EXISTS idx_shared_resources_grade ON shared_resources(grade);

-- RLS policies
ALTER TABLE shared_resources ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own resources
CREATE POLICY "Teachers can insert own resources"
  ON shared_resources FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Teachers can update own resources"
  ON shared_resources FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Teachers can delete own resources"
  ON shared_resources FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Everyone can read (visibility filtered in app logic)
CREATE POLICY "Authenticated users can read resources"
  ON shared_resources FOR SELECT TO authenticated
  USING (true);
