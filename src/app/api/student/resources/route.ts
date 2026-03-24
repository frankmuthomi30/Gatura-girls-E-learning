import { NextResponse } from 'next/server';
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
  const { data: profile } = await db.from('profiles').select('stream, grade, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Get student's stream ID
  let streamId: string | null = null;
  if (profile.stream) {
    const { data: streamRow } = await db.from('streams').select('id').eq('name', profile.stream).single();
    streamId = streamRow?.id || null;
  }

  // Fetch resources visible to this student:
  // - resources with no stream filter (for all)
  // - resources matching student's stream
  // - resources matching student's grade
  let query = db
    .from('shared_resources')
    .select('*, subject:subjects(name), stream:streams(name), teacher:profiles(full_name)')
    .order('created_at', { ascending: false });

  // Build OR filter: stream_id is null (all streams) OR matches student's stream
  if (streamId) {
    query = query.or(`stream_id.is.null,stream_id.eq.${streamId}`);
  }

  const { data: resources } = await query;

  // Further filter by grade on the app side
  const filtered = (resources || []).filter((r: any) => {
    if (r.grade && profile.grade && r.grade !== profile.grade) return false;
    return true;
  });

  return NextResponse.json({ resources: filtered });
}
