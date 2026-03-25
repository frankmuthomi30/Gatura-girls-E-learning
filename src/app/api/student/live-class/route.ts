import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const db = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  // Get student profile for stream/grade filtering
  const { data: profile } = await db.from('profiles').select('stream, grade').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Get student's stream ID
  let streamId: string | null = null;
  if (profile.stream) {
    const { data: streamRow } = await db.from('streams').select('id').eq('name', profile.stream).single();
    streamId = streamRow?.id || null;
  }

  // Live sessions visible to this student
  let query = db
    .from('live_sessions')
    .select('*, subject:subjects(name), stream:streams(name), teacher:profiles!live_sessions_teacher_id_fkey(full_name)')
    .eq('status', 'live')
    .order('started_at', { ascending: false });

  if (streamId) {
    query = query.or(`stream_id.is.null,stream_id.eq.${streamId}`);
  }

  const { data: liveSessions } = await query;

  // Filter by grade
  const filtered = (liveSessions || []).filter((s: any) => {
    if (s.grade && profile.grade && s.grade !== profile.grade) return false;
    return true;
  });

  return NextResponse.json({ liveSessions: filtered });
}

// POST: record attendance when student joins a live class
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const db = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { session_id } = body;
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

  // Upsert — ignore if already recorded
  await db.from('live_attendance').upsert(
    { session_id, student_id: user.id },
    { onConflict: 'session_id,student_id' }
  );

  return NextResponse.json({ success: true });
}
