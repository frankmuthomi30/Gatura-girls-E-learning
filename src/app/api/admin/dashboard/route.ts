import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getAdminContext() {
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

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { dbClient };
}

export async function GET() {
  const context = await getAdminContext();
  if ('error' in context) return context.error;
  const { dbClient } = context;

  const [
    { count: studentCount },
    { count: teacherCount },
    { count: assignmentCount },
    { count: submissionCount },
    { data: students },
    { count: activeExamCount },
    { data: examSessions },
  ] = await Promise.all([
    dbClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    dbClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    dbClient.from('assignments').select('id', { count: 'exact', head: true }),
    dbClient.from('submissions').select('id', { count: 'exact', head: true }),
    dbClient.from('profiles').select('stream').eq('role', 'student'),
    dbClient.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    dbClient.from('exam_sessions').select('status'),
  ]);

  const streamCounts: Record<string, number> = {};
  (students || []).forEach((s: any) => {
    if (s.stream) {
      streamCounts[s.stream] = (streamCounts[s.stream] || 0) + 1;
    }
  });

  return NextResponse.json({
    totalStudents: studentCount || 0,
    totalTeachers: teacherCount || 0,
    totalAssignments: assignmentCount || 0,
    totalSubmissions: submissionCount || 0,
    streamCounts,
    activeExams: activeExamCount || 0,
    examSessions: examSessions || [],
  });
}
