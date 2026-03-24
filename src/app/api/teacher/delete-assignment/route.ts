import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbClient = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { assignmentId } = await request.json();

  if (!assignmentId || typeof assignmentId !== 'string') {
    return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
  }

  const { data: assignment, error: assignmentError } = await dbClient
    .from('assignments')
    .select('id, created_by')
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  if (assignment.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: deleteError } = await dbClient.from('assignments').delete().eq('id', assignmentId);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}