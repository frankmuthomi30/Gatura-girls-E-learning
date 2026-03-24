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

export async function GET() {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;
  const { dbClient, teacherId } = context;

  const [{ data: subjects }, { data: streams }, { data: assignments }] = await Promise.all([
    dbClient.from('subjects').select('*, stream:streams(id, name)').eq('teacher_id', teacherId),
    dbClient.from('streams').select('*').order('name'),
    dbClient
      .from('assignments')
      .select('*, subject:subjects(name), stream:streams(name)')
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    subjects: subjects || [],
    streams: streams || [],
    assignments: assignments || [],
  });
}

export async function POST(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;
  const { dbClient, teacherId } = context;

  const body = await request.json().catch(() => null);
  if (!body || !body.assignments || !Array.isArray(body.assignments)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Verify teacher owns the subject
  const subjectId = body.assignments[0]?.subject_id;
  if (subjectId) {
    const { data: subject } = await dbClient
      .from('subjects')
      .select('teacher_id')
      .eq('id', subjectId)
      .single();

    if (!subject || subject.teacher_id !== teacherId) {
      return NextResponse.json({ error: 'You can only create assignments for your subjects' }, { status: 403 });
    }
  }

  // Set created_by server-side for security
  const inserts = body.assignments.map((a: any) => ({
    ...a,
    created_by: teacherId,
  }));

  const { data: created, error } = await dbClient
    .from('assignments')
    .insert(inserts)
    .select();

  if (error) {
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }

  return NextResponse.json({ assignments: created || [] });
}
