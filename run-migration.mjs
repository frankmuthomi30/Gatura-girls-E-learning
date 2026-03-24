import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const fs = await import('fs');

const sql = `
DROP POLICY IF EXISTS "Students create own submissions" ON submissions;
DROP POLICY IF EXISTS "Students update own submissions before grading" ON submissions;
DROP POLICY IF EXISTS "Students create own submissions before deadline" ON submissions;
DROP POLICY IF EXISTS "Students update own submissions before deadline and grading" ON submissions;

CREATE POLICY "Students create own submissions before deadline"
  ON submissions FOR INSERT
  WITH CHECK (
    get_user_role() = 'student'
    AND student_id = auth.uid()
    AND assignment_id IN (
      SELECT id FROM assignments
      WHERE due_date >= NOW()
    )
  );

CREATE POLICY "Students update own submissions before deadline and grading"
  ON submissions FOR UPDATE
  USING (
    get_user_role() = 'student'
    AND student_id = auth.uid()
    AND grade IS NULL
    AND assignment_id IN (
      SELECT id FROM assignments
      WHERE due_date >= NOW()
    )
  )
  WITH CHECK (student_id = auth.uid());
`;

const client = new Client({
  connectionString: 'postgresql://postgres.qxiepbqdurkalvqwahxm:QtzfL8Y330IEGzJV@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  await client.query(sql);
  console.log('Migration applied successfully!');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  try { await client.end(); } catch {}
}
