import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getStudentContext() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbClient = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('role, stream, academic_year')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'student') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  let streamId: string | null = null;

  if (profile.stream) {
    const { data: stream } = await dbClient
      .from('streams')
      .select('id')
      .eq('name', profile.stream)
      .eq('academic_year', profile.academic_year)
      .maybeSingle();

    streamId = stream?.id ?? null;
  }

  return { dbClient, userId: user.id, streamId };
}

export async function GET() {
  const context = await getStudentContext();
  if ('error' in context) {
    return context.error;
  }

  const { dbClient, userId, streamId } = context;

  let assignmentsQuery = dbClient
    .from('assignments')
    .select('*, subject:subjects(name), stream:streams(name)')
    .in('status', ['published', 'active'])
    .order('due_date', { ascending: false });

  if (streamId) {
    assignmentsQuery = assignmentsQuery.or(`stream_id.is.null,stream_id.eq.${streamId}`);
  } else {
    assignmentsQuery = assignmentsQuery.is('stream_id', null);
  }

  const [{ data: assignments, error: assignmentsError }, { data: submissions, error: submissionsError }, { data: examSessions, error: sessionsError }] = await Promise.all([
    assignmentsQuery,
    dbClient
      .from('submissions')
      .select('*, assignment:assignments(*, subject:subjects(name))')
      .eq('student_id', userId)
      .order('submitted_at', { ascending: false }),
    dbClient
      .from('exam_sessions')
      .select('*')
      .eq('student_id', userId),
  ]);

  if (assignmentsError || submissionsError || sessionsError) {
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
  }

  return NextResponse.json({
    assignments: assignments || [],
    submissions: submissions || [],
    examSessions: examSessions || [],
  });
}