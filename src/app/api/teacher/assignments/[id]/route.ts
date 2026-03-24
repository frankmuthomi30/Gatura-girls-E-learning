import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getTeacherContext() {
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

  if (!profile || profile.role !== 'teacher') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { dbClient, teacherId: user.id };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;
  const { dbClient, teacherId } = context;

  const { data: assignment, error: aErr } = await dbClient
    .from('assignments')
    .select('*, subject:subjects(name), stream:streams(name)')
    .eq('id', params.id)
    .eq('created_by', teacherId)
    .single();

  if (aErr || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const { data: questions, error: qErr } = await dbClient
    .from('questions')
    .select('*, options:question_options(*)')
    .eq('assignment_id', params.id)
    .order('order_index');

  if (qErr) {
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }

  return NextResponse.json({
    assignment,
    questions: questions || [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = await getTeacherContext();
  if ('error' in context) return context.error;
  const { dbClient, teacherId } = context;

  // Verify ownership
  const { data: assignment } = await dbClient
    .from('assignments')
    .select('id, created_by')
    .eq('id', params.id)
    .eq('created_by', teacherId)
    .single();

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as string;

  if (action === 'save_questions') {
    const questions = body?.questions as any[];
    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Invalid questions data' }, { status: 400 });
    }

    // Delete existing questions (cascade deletes options)
    await dbClient.from('questions').delete().eq('assignment_id', params.id);

    for (const q of questions) {
      const { data: savedQ, error: qErr } = await dbClient
        .from('questions')
        .insert({
          assignment_id: params.id,
          question_text: q.question_text?.trim() || '',
          question_type: q.question_type || 'mcq',
          points: q.points || 1,
          order_index: q.order_index || 0,
          marking_scheme: q.marking_scheme?.trim() || null,
          instructions: q.instructions?.trim() || null,
        })
        .select()
        .single();

      if (qErr || !savedQ) continue;

      if (q.question_type === 'mcq' && q.options?.length > 0) {
        const optInserts = q.options.map((o: any) => ({
          question_id: savedQ.id,
          option_label: o.option_label,
          option_text: o.option_text?.trim() || '',
          is_correct: !!o.is_correct,
        }));
        await dbClient.from('question_options').insert(optInserts);
      }
    }

    // Update total points
    const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0);
    await dbClient.from('assignments').update({ total_points: totalPoints }).eq('id', params.id);

    return NextResponse.json({ success: true, totalPoints });
  }

  if (action === 'publish') {
    const { error } = await dbClient
      .from('assignments')
      .update({ status: 'published' })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'start_exam') {
    const { error } = await dbClient
      .from('assignments')
      .update({ status: 'active' })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: 'Failed to start exam' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
