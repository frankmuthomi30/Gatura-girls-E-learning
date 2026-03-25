import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getTeacherContext() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const db = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await db.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!profile || profile.role !== 'teacher') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { db, userId: user.id, userName: profile.full_name };
}

export async function GET(request: NextRequest) {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId } = ctx;

  const type = request.nextUrl.searchParams.get('type') || 'live';

  if (type === 'live') {
    // Live class attendance: all sessions by this teacher with attendance records
    const { data: sessions } = await db
      .from('live_sessions')
      .select('id, title, room_id, started_at, ended_at, status, subject:subjects(name), stream:streams(name)')
      .eq('teacher_id', userId)
      .order('started_at', { ascending: false })
      .limit(50);

    // For each session, get attendance
    const sessionIds = (sessions || []).map((s: any) => s.id);
    let attendanceMap: Record<string, any[]> = {};

    if (sessionIds.length > 0) {
      const { data: attendance } = await db
        .from('live_attendance')
        .select('session_id, joined_at, student:profiles!live_attendance_student_id_fkey(full_name, admission_number, stream, grade)')
        .in('session_id', sessionIds)
        .order('joined_at', { ascending: true });

      for (const a of attendance || []) {
        if (!attendanceMap[a.session_id]) attendanceMap[a.session_id] = [];
        attendanceMap[a.session_id].push(a);
      }
    }

    const result = (sessions || []).map((s: any) => ({
      ...s,
      attendance: attendanceMap[s.id] || [],
      attendanceCount: (attendanceMap[s.id] || []).length,
    }));

    return NextResponse.json({ sessions: result });
  }

  if (type === 'exams') {
    // Exam attendance: assignments with is_exam or mode='exam'/'mcq' that belong to this teacher
    const { data: assignments } = await db
      .from('assignments')
      .select('id, title, mode, status, due_date, created_at, subject:subjects(name), stream:streams(name)')
      .eq('created_by', userId)
      .in('mode', ['mcq', 'exam', 'mixed', 'theory'])
      .order('created_at', { ascending: false })
      .limit(50);

    const assignmentIds = (assignments || []).map((a: any) => a.id);
    let examSessionMap: Record<string, any[]> = {};

    if (assignmentIds.length > 0) {
      const { data: examSessions } = await db
        .from('exam_sessions')
        .select('assignment_id, status, score, total_points, started_at, ended_at, student:profiles!exam_sessions_student_id_fkey(full_name, admission_number, stream, grade)')
        .in('assignment_id', assignmentIds)
        .order('started_at', { ascending: true });

      for (const es of examSessions || []) {
        if (!examSessionMap[es.assignment_id]) examSessionMap[es.assignment_id] = [];
        examSessionMap[es.assignment_id].push(es);
      }
    }

    const result = (assignments || []).map((a: any) => ({
      ...a,
      examSessions: examSessionMap[a.id] || [],
      totalAttempts: (examSessionMap[a.id] || []).length,
      submitted: (examSessionMap[a.id] || []).filter((e: any) => e.status === 'submitted').length,
    }));

    return NextResponse.json({ assignments: result });
  }

  if (type === 'assignments') {
    // Assignment submission reports
    const { data: assignments } = await db
      .from('assignments')
      .select('id, title, mode, status, due_date, created_at, subject:subjects(name), stream:streams(name)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const assignmentIds = (assignments || []).map((a: any) => a.id);
    let submissionMap: Record<string, any[]> = {};

    if (assignmentIds.length > 0) {
      const { data: submissions } = await db
        .from('submissions')
        .select('assignment_id, submitted_at, grade, graded_at, student:profiles!submissions_student_id_fkey(full_name, admission_number, stream, grade)')
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: true });

      for (const sub of submissions || []) {
        if (!submissionMap[sub.assignment_id]) submissionMap[sub.assignment_id] = [];
        submissionMap[sub.assignment_id].push(sub);
      }
    }

    const result = (assignments || []).map((a: any) => ({
      ...a,
      submissions: submissionMap[a.id] || [],
      totalSubmissions: (submissionMap[a.id] || []).length,
      graded: (submissionMap[a.id] || []).filter((s: any) => s.graded_at).length,
    }));

    return NextResponse.json({ assignments: result });
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
}
