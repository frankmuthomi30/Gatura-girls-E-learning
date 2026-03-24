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

  const [{ data: subjects, error: subErr }, { data: streams, error: strErr }, { data: teachers, error: tchErr }] = await Promise.all([
    dbClient.from('subjects').select('*, stream:streams(name), teacher:profiles(full_name)').order('name'),
    dbClient.from('streams').select('*').order('name'),
    dbClient.from('profiles').select('id, full_name, admission_number').eq('role', 'teacher').order('full_name'),
  ]);

  if (subErr || strErr || tchErr) {
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }

  return NextResponse.json({
    subjects: subjects || [],
    streams: streams || [],
    teachers: teachers || [],
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if ('error' in context) return context.error;
  const { dbClient } = context;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const streamId = typeof body?.stream_id === 'string' && body.stream_id ? body.stream_id : null;
  const teacherId = typeof body?.teacher_id === 'string' && body.teacher_id ? body.teacher_id : null;

  if (!name) {
    return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
  }

  const { error } = await dbClient.from('subjects').insert({ name, stream_id: streamId, teacher_id: teacherId });
  if (error) {
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const context = await getAdminContext();
  if ('error' in context) return context.error;
  const { dbClient } = context;

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const streamId = typeof body?.stream_id === 'string' && body.stream_id ? body.stream_id : null;
  const teacherId = typeof body?.teacher_id === 'string' && body.teacher_id ? body.teacher_id : null;

  if (!id) {
    return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
  }

  // If only teacher_id update (assign teacher)
  if (!name && body?.teacher_id !== undefined) {
    const { error } = await dbClient.from('subjects').update({ teacher_id: teacherId }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to assign teacher' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!name) {
    return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
  }

  const { error } = await dbClient.from('subjects').update({ name, stream_id: streamId, teacher_id: teacherId }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const context = await getAdminContext();
  if ('error' in context) return context.error;
  const { dbClient } = context;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
  }

  // Cascade: delete submissions → assignments → subject
  const { data: assignments } = await dbClient.from('assignments').select('id').eq('subject_id', id);
  if (assignments && assignments.length > 0) {
    const assignmentIds = assignments.map((a: any) => a.id);
    await dbClient.from('submissions').delete().in('assignment_id', assignmentIds);
    await dbClient.from('assignments').delete().eq('subject_id', id);
  }

  const { error } = await dbClient.from('subjects').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
