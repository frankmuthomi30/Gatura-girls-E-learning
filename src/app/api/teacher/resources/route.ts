import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getTeacherContext() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const db = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'teacher') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { db, userId: user.id };
}

// GET: teacher's resources + their subjects/streams
export async function GET() {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId } = ctx;

  const [{ data: resources }, { data: subjects }, { data: streams }] = await Promise.all([
    db.from('shared_resources')
      .select('*, subject:subjects(name), stream:streams(name), teacher:profiles(full_name)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }),
    db.from('subjects').select('id, name, stream:streams(id, name)').eq('teacher_id', userId),
    db.from('streams').select('*').order('name'),
  ]);

  return NextResponse.json({
    resources: resources || [],
    subjects: subjects || [],
    streams: streams || [],
  });
}

// POST: create a new resource
export async function POST(request: NextRequest) {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId } = ctx;

  const body = await request.json();
  const { title, url, description, resource_type, stream_id, grade, subject_id } = body;

  if (!title?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 });
  }

  // Auto-detect YouTube
  const detectedType = resource_type || (isYouTubeUrl(url) ? 'youtube' : 'link');
  const thumbnail = detectedType === 'youtube' ? getYouTubeThumbnail(url) : null;

  const { data, error } = await db
    .from('shared_resources')
    .insert({
      title: title.trim(),
      url: url.trim(),
      description: description?.trim() || null,
      resource_type: detectedType,
      thumbnail_url: thumbnail,
      created_by: userId,
      stream_id: stream_id || null,
      grade: grade || null,
      subject_id: subject_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ resource: data });
}

// DELETE: remove a resource
export async function DELETE(request: NextRequest) {
  const ctx = await getTeacherContext();
  if ('error' in ctx) return ctx.error;
  const { db, userId } = ctx;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { error } = await db
    .from('shared_resources')
    .delete()
    .eq('id', id)
    .eq('created_by', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch|embed|shorts)|youtu\.be\/)/i.test(url);
}

function getYouTubeThumbnail(url: string): string | null {
  const videoId = extractYouTubeId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
