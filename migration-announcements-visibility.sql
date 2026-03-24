DROP POLICY IF EXISTS "Students read announcements for own stream" ON announcements;

CREATE POLICY "Students read announcements for own stream"
  ON announcements FOR SELECT
  USING (
    get_user_role() = 'student'
    AND (
      stream_id IS NULL
      OR stream_id IN (
        SELECT s.id
        FROM streams s
        JOIN profiles p ON p.id = auth.uid()
        WHERE s.name = p.stream
          AND s.academic_year = p.academic_year
      )
    )
  );