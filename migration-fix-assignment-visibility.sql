-- ============================================================
-- MIGRATION: Fix assignment visibility for "All Streams"
-- Run this in your Supabase SQL Editor
-- 
-- Problem: When teachers select "All Streams", assignments are
-- created with stream_id = NULL. The RLS policy only matched
-- specific stream_ids, so NULL stream_id assignments were
-- invisible to students.
--
-- Fix: Allow students to also see assignments where
-- stream_id IS NULL (meaning visible to all streams).
-- ============================================================

DROP POLICY IF EXISTS "Students read assignments for own stream" ON assignments;

CREATE POLICY "Students read assignments for own stream"
  ON assignments FOR SELECT
  USING (
    get_user_role() = 'student'
    AND (
      stream_id IS NULL
      OR stream_id IN (
        SELECT s.id FROM streams s WHERE s.name = get_user_stream()
      )
    )
  );
