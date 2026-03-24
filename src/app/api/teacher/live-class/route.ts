import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';
import crypto from 'crypto';

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

// GET: teacher's live sessions + subjects/streams for the form
export async function GET() {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId } = ctx;

  const [{ data: activeSession }, { data: pastSessions }, { data: subjects }, { data: streams }] = await Promise.all([
    db.from('live_sessions')
      .select('*, subject:subjects(name), stream:streams(name)')
      .eq('teacher_id', userId)
      .eq('status', 'live')
      .maybeSingle(),
    db.from('live_sessions')
      .select('*, subject:subjects(name), stream:streams(name)')
      .eq('teacher_id', userId)
      .eq('status', 'ended')
      .order('started_at', { ascending: false })
      .limit(20),
    db.from('subjects').select('id, name, stream:streams(id, name)').eq('teacher_id', userId),
    db.from('streams').select('*').order('name'),
  ]);

  return NextResponse.json({
    activeSession,
    pastSessions: pastSessions || [],
    subjects: subjects || [],
    streams: streams || [],
  });
}

// POST: start a new live session
export async function POST(request: NextRequest) {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId, userName } = ctx;

  // Check if teacher already has a live session
  const { data: existing } = await db
    .from('live_sessions')
    .select('id')
    .eq('teacher_id', userId)
    .eq('status', 'live')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You already have an active live class. End it first.' }, { status: 400 });
  }

  const body = await request.json();
  const { title, subject_id, stream_id, grade } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Generate a unique room ID
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const hash = crypto.randomBytes(4).toString('hex');
  const roomId = `ggs-${slug}-${hash}`;

  const { data, error } = await db
    .from('live_sessions')
    .insert({
      room_id: roomId,
      title: title.trim(),
      teacher_id: userId,
      subject_id: subject_id || null,
      stream_id: stream_id || null,
      grade: grade ? parseInt(grade) : null,
      status: 'live',
    })
    .select('*, subject:subjects(name), stream:streams(name)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}

// PATCH: end a live session
export async function PATCH(request: NextRequest) {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId } = ctx;

  const body = await request.json();
  const { session_id } = body;

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const { error } = await db
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', session_id)
    .eq('teacher_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
