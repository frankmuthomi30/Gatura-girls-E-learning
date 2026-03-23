import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

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

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRole);
  const limitParam = request.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : null;
  const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0 ? parsedLimit : null;

  let streamId: string | null = null;
  if (profile.stream) {
    const { data: stream } = await adminClient
      .from('streams')
      .select('id')
      .eq('name', profile.stream)
      .eq('academic_year', profile.academic_year)
      .single();

    streamId = stream?.id ?? null;
  }

  let query = adminClient
    .from('announcements')
    .select('*, stream:streams(name)')
    .order('created_at', { ascending: false });

  query = streamId
    ? query.or(`stream_id.eq.${streamId},stream_id.is.null`)
    : query.is('stream_id', null);

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
  }

  return NextResponse.json({ announcements: data || [] });
}