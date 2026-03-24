import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stream, academic_year')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use service-role client to bypass RLS for the data query
  // (auth is already verified above)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbClient = serviceKey
    ? createClient(getSupabaseUrl(), serviceKey)
    : supabase;

  const limitParam = request.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : null;
  const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0 ? parsedLimit : null;

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

  let query = dbClient
    .from('announcements')
    .select('*, stream:streams(name)')
    .order('created_at', { ascending: false });

  if (streamId) {
    query = query.or(`stream_id.is.null,stream_id.eq.${streamId}`);
  } else {
    query = query.is('stream_id', null);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
  }

  return NextResponse.json({ announcements: data || [] });
}