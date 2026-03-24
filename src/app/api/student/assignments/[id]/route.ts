import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getStudentContext() {
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
    .select('role, stream, academic_year')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'student') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

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

  return { dbClient, userId: user.id, streamId };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = await getStudentContext();
  if ('error' in context) {
    return context.error;
  }

  const { dbClient, userId, streamId } = context;

  let assignmentQuery = dbClient
    .from('assignments')
    .select('*, subject:subjects(name), stream:streams(name)')
    .eq('id', params.id)
    .in('status', ['published', 'active']);

  if (streamId) {
    assignmentQuery = assignmentQuery.or(`stream_id.is.null,stream_id.eq.${streamId}`);
  } else {
    assignmentQuery = assignmentQuery.is('stream_id', null);
  }

  const { data: assignment, error: assignmentError } = await assignmentQuery.maybeSingle();

  if (assignmentError) {
    return NextResponse.json({ error: 'Failed to load assignment' }, { status: 500 });
  }

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const mode = assignment.mode || 'file_upload';
  const isExamMode = ['mcq', 'theory', 'mixed', 'exam'].includes(mode);

  const [{ data: submission, error: submissionError }, { data: examSession, error: examSessionError }, { data: questions, error: questionsError }, { data: savedAnswers, error: savedAnswersError }] = await Promise.all([
    dbClient
      .from('submissions')
      .select('*')
      .eq('assignment_id', params.id)
      .eq('student_id', userId)
      .maybeSingle(),
    isExamMode
      ? dbClient
          .from('exam_sessions')
          .select('*')
          .eq('assignment_id', params.id)
          .eq('student_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    isExamMode
      ? dbClient
          .from('questions')
          .select('*, options:question_options(id, option_label, option_text, is_correct)')
          .eq('assignment_id', params.id)
          .order('order_index')
      : Promise.resolve({ data: [], error: null }),
    isExamMode
      ? dbClient
          .from('exam_sessions')
          .select('id')
          .eq('assignment_id', params.id)
          .eq('student_id', userId)
          .maybeSingle()
          .then(async ({ data, error }) => {
            if (error || !data) {
              return { data: [], error };
            }

            return dbClient
              .from('student_answers')
              .select('*')
              .eq('exam_session_id', data.id);
          })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (submissionError || examSessionError || questionsError || savedAnswersError) {
    return NextResponse.json({ error: 'Failed to load assignment details' }, { status: 500 });
  }

  return NextResponse.json({
    assignment,
    submission,
    examSession,
    questions: questions || [],
    savedAnswers: savedAnswers || [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = await getStudentContext();
  if ('error' in context) {
    return context.error;
  }

  const { dbClient, userId } = context;
  const body = await request.json().catch(() => null);
  const examSessionId = body?.examSessionId as string | undefined;
  const autoSubmit = body?.autoSubmit === true;

  if (!examSessionId) {
    return NextResponse.json({ error: 'Missing examSessionId' }, { status: 400 });
  }

  // Verify the exam session belongs to this student and is in progress
  const { data: session, error: sessionError } = await dbClient
    .from('exam_sessions')
    .select('*')
    .eq('id', examSessionId)
    .eq('student_id', userId)
    .eq('assignment_id', params.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Exam session not found' }, { status: 404 });
  }

  if (session.status === 'submitted' || session.status === 'timed_out') {
    return NextResponse.json({ error: 'Exam already submitted', score: session.score }, { status: 409 });
  }

  // Load questions with correct answers (server-side — secure)
  const { data: questions } = await dbClient
    .from('questions')
    .select('id, question_type, points, options:question_options(id, is_correct)')
    .eq('assignment_id', params.id);

  // Load student answers
  const { data: studentAnswers } = await dbClient
    .from('student_answers')
    .select('question_id, selected_option_id')
    .eq('exam_session_id', examSessionId);

  // Calculate score server-side
  let score = 0;
  const answerMap = new Map((studentAnswers || []).map(a => [a.question_id, a.selected_option_id]));

  for (const q of (questions || [])) {
    if (q.question_type === 'mcq') {
      const selectedOptionId = answerMap.get(q.id);
      if (selectedOptionId) {
        const isCorrect = q.options?.some((o: { id: string; is_correct: boolean }) => o.id === selectedOptionId && o.is_correct);
        if (isCorrect) score += q.points;
      }
    }
  }

  // Update student_answers with correct is_correct and points_earned
  for (const q of (questions || [])) {
    if (q.question_type === 'mcq') {
      const selectedOptionId = answerMap.get(q.id);
      if (selectedOptionId) {
        const isCorrect = q.options?.some((o: { id: string; is_correct: boolean }) => o.id === selectedOptionId && o.is_correct) ?? false;
        await dbClient.from('student_answers').update({
          is_correct: isCorrect,
          points_earned: isCorrect ? q.points : 0,
        }).eq('exam_session_id', examSessionId).eq('question_id', q.id);
      }
    }
  }

  // Update exam session
  const { error: updateError } = await dbClient
    .from('exam_sessions')
    .update({
      status: autoSubmit ? 'timed_out' : 'submitted',
      ended_at: new Date().toISOString(),
      score,
      time_remaining: 0,
    })
    .eq('id', examSessionId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update exam session' }, { status: 500 });
  }

  // Load assignment to get total_points for grade display
  const { data: assignment } = await dbClient
    .from('assignments')
    .select('total_points')
    .eq('id', params.id)
    .single();

  const totalPoints = assignment?.total_points || session.total_points || 0;

  // Create/update submission record so teachers can see it
  const gradeText = `${score}/${totalPoints}`;
  await dbClient.from('submissions').upsert({
    assignment_id: params.id,
    student_id: userId,
    answer_text: `Exam completed — Score: ${score}/${totalPoints}`,
    grade: gradeText,
    feedback: autoSubmit ? 'Auto-submitted (time expired)' : 'Auto-graded MCQ exam',
    submitted_at: new Date().toISOString(),
    graded_at: new Date().toISOString(),
  }, { onConflict: 'assignment_id,student_id' });

  return NextResponse.json({ score, totalPoints });
}