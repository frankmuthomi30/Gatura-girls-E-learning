import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getStudentContext() {
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

  if (!profile || profile.role !== 'student') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { dbClient, studentId: user.id };
}

export async function GET() {
  const context = await getStudentContext();
  if ('error' in context) return context.error;
  const { dbClient, studentId } = context;

  const { data, error } = await dbClient
    .from('submissions')
    .select('*, assignment:assignments(*, subject:subjects(name))')
    .eq('student_id', studentId)
    .not('grade', 'is', null)
    .order('graded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load grades' }, { status: 500 });
  }

  return NextResponse.json({ submissions: data || [] });
}
