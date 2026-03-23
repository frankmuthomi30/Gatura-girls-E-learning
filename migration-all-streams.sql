-- Update policies to allow students to read assignments and announcements targeted to "All Streams" (stream_id IS NULL)

DROP POLICY IF EXISTS "Students read assignments for own stream" ON assignments;
CREATE POLICY "Students read assignments for own stream"
  ON assignments FOR SELECT
  USING (
    get_user_role() = 'student'
    AND (
      stream_id IS NULL 
      OR stream_id IN (SELECT s.id FROM streams s WHERE s.name = get_user_stream())
    )
  );

DROP POLICY IF EXISTS "Students read announcements for own stream" ON announcements;
CREATE POLICY "Students read announcements for own stream"
  ON announcements FOR SELECT
  USING (
    get_user_role() = 'student'
    AND (
      stream_id IS NULL 
      OR stream_id IN (SELECT s.id FROM streams s WHERE s.name = get_user_stream())
    )
  );
