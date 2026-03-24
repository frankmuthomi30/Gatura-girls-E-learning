import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getTeacherContext() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbClient = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { dbClient, teacherId: user.id };
}

export async function GET(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;
  const { dbClient, teacherId } = context;

  const examId = request.nextUrl.searchParams.get('examId');

  // Get teacher's exam-type assignments
  const { data: exams } = await dbClient
    .from('assignments')
    .select('id, title, mode, time_limit, total_points, status, created_at, subject:subjects(name), stream:streams(name)')
    .eq('created_by', teacherId)
    .in('mode', ['mcq', 'theory', 'mixed', 'exam'])
    .in('status', ['active', 'published'])
    .order('created_at', { ascending: false });

  if (!examId) {
    return NextResponse.json({ exams: exams || [], sessions: [] });
  }

  // Load sessions for selected exam
  const { data: sessData } = await dbClient
    .from('exam_sessions')
    .select('*')
    .eq('assignment_id', examId)
    .order('started_at', { ascending: false });

  if (!sessData || sessData.length === 0) {
    return NextResponse.json({ exams: exams || [], sessions: [] });
  }

  const studentIds = sessData.map((s: any) => s.student_id);
  const { data: profiles } = await dbClient
    .from('profiles')
    .select('id, full_name, admission_number')
    .in('id', studentIds);

  const profileMap: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

  const sessions = sessData.map((s: any) => ({
    id: s.id,
    student_id: s.student_id,
    assignment_id: s.assignment_id,
    status: s.status,
    started_at: s.started_at,
    ended_at: s.ended_at,
    last_activity: s.last_activity || s.started_at,
    time_remaining: s.time_remaining,
    score: s.score,
    student_name: profileMap[s.student_id]?.full_name || 'Unknown',
    admission_number: profileMap[s.student_id]?.admission_number || '',
  }));

  return NextResponse.json({ exams: exams || [], sessions });
}
