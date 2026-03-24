import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getTeacherContext() {
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

  const [{ data: announcements, error: annError }, { data: streams, error: strError }] = await Promise.all([
    dbClient
      .from('announcements')
      .select('*, stream:streams(name)')
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false }),
    dbClient.from('streams').select('*').order('name'),
  ]);

  if (annError || strError) {
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }

  return NextResponse.json({
    announcements: announcements || [],
    streams: streams || [],
  });
}

export async function POST(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;

  const { dbClient, teacherId } = context;
  const body = await request.json().catch(() => null);

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';
  const streamId = typeof body?.stream_id === 'string' && body.stream_id ? body.stream_id : null;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { data, error } = await dbClient
    .from('announcements')
    .insert({
      title,
      body: bodyText || null,
      stream_id: streamId,
      created_by: teacherId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }

  return NextResponse.json({ announcement: data });
}

export async function PATCH(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;

  const { dbClient, teacherId } = context;
  const body = await request.json().catch(() => null);

  const id = body?.id as string | undefined;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';
  const streamId = typeof body?.stream_id === 'string' && body.stream_id ? body.stream_id : null;

  if (!id || !title) {
    return NextResponse.json({ error: 'ID and title are required' }, { status: 400 });
  }

  const { error } = await dbClient
    .from('announcements')
    .update({
      title,
      body: bodyText || null,
      stream_id: streamId,
    })
    .eq('id', id)
    .eq('created_by', teacherId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;

  const { dbClient, teacherId } = context;
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const { error } = await dbClient
    .from('announcements')
    .delete()
    .eq('id', id)
    .eq('created_by', teacherId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
