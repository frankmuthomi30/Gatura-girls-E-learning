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

  const { data: assignments } = await dbClient
    .from('assignments')
    .select('id, title, subject:subjects(name), stream:streams(id, name)')
    .order('created_at', { ascending: false });

  const reportData = [];

  for (const a of assignments || []) {
    const streamName = (a as any).stream?.name;

    const [{ count: totalStudents }, { data: subs }] = await Promise.all([
      dbClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('stream', streamName),
      dbClient
        .from('submissions')
        .select('grade')
        .eq('assignment_id', a.id),
    ]);

    const submitted = subs?.length || 0;
    const graded = subs?.filter((s: any) => s.grade)?.length || 0;

    reportData.push({
      assignmentTitle: a.title,
      subjectName: (a as any).subject?.name || '',
      streamName,
      totalStudents: totalStudents || 0,
      submitted,
      graded,
      averageGrade: '-',
    });
  }

  return NextResponse.json({ reports: reportData });
}
