import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
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

  const { data: assignment, error: assignmentError } = await supabase
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

  const { error: deleteError } = await supabase.from('assignments').delete().eq('id', assignmentId);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}