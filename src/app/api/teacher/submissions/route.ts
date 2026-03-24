import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getTeacherContext() {
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
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const { data: subjects, error: subjectsError } = await dbClient
    .from('subjects')
    .select('id, academic_year')
    .eq('teacher_id', user.id);

  if (subjectsError) {
    return { error: NextResponse.json({ error: 'Failed to load subjects' }, { status: 500 }) };
  }

  return {
    dbClient,
    teacherId: user.id,
    subjectIds: (subjects || []).map((subject) => subject.id),
    academicYear: subjects?.[0]?.academic_year ?? null,
  };
}

export async function GET(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) {
    return context.error;
  }

  const { dbClient, subjectIds, academicYear } = context;
  const assignmentId = request.nextUrl.searchParams.get('assignment');

  if (subjectIds.length === 0) {
    return NextResponse.json({ assignments: [], submissions: [], students: [] });
  }

  const { data: assignments, error: assignmentsError } = await dbClient
    .from('assignments')
    .select('*, subject:subjects(name, academic_year), stream:streams(name)')
    .in('subject_id', subjectIds)
    .order('created_at', { ascending: false });

  if (assignmentsError) {
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
  }

  if (!assignmentId) {
    return NextResponse.json({ assignments: assignments || [], submissions: [], students: [] });
  }

  const selectedAssignment = (assignments || []).find((assignment) => assignment.id === assignmentId);
  if (!selectedAssignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  let studentsQuery = dbClient
    .from('profiles')
    .select('id, full_name, admission_number, stream')
    .eq('role', 'student')
    .order('full_name');

  if (selectedAssignment.stream_id) {
    const { data: streamData, error: streamError } = await dbClient
      .from('streams')
      .select('name')
      .eq('id', selectedAssignment.stream_id)
      .single();

    if (streamError || !streamData) {
      return NextResponse.json({ error: 'Failed to load assignment stream' }, { status: 500 });
    }

    studentsQuery = studentsQuery.eq('stream', streamData.name);
  } else if (academicYear) {
    studentsQuery = studentsQuery.eq('academic_year', academicYear);
  }

  const isExamMode = selectedAssignment.mode && ['mcq', 'theory', 'mixed', 'exam'].includes(selectedAssignment.mode);

  const [{ data: submissions, error: submissionsError }, { data: students, error: studentsError }] = await Promise.all([
    dbClient
      .from('submissions')
      .select('*, student:profiles(id, full_name, admission_number, stream)')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: true }),
    studentsQuery,
  ]);

  if (submissionsError || studentsError) {
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 });
  }

  // For exam-mode assignments, also load exam_sessions so teachers see auto-graded scores
  let examSessions: Record<string, unknown>[] = [];
  if (isExamMode) {
    const { data: sessions } = await dbClient
      .from('exam_sessions')
      .select('*, student:profiles(id, full_name, admission_number, stream)')
      .eq('assignment_id', assignmentId)
      .in('status', ['submitted', 'timed_out'])
      .order('ended_at', { ascending: true });

    examSessions = sessions || [];
  }

  return NextResponse.json({
    assignments: assignments || [],
    submissions: submissions || [],
    students: students || [],
    examSessions,
  });
}

export async function PATCH(request: NextRequest) {
  const context = await getTeacherContext();
  if ('error' in context) {
    return context.error;
  }

  const { dbClient, subjectIds } = context;
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId as string | undefined;
  const grade = typeof body?.grade === 'string' ? body.grade.trim() : '';
  const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : '';

  if (!submissionId || !grade) {
    return NextResponse.json({ error: 'Submission id and grade are required' }, { status: 400 });
  }

  const { data: submission, error: submissionError } = await dbClient
    .from('submissions')
    .select('id, assignment_id')
    .eq('id', submissionId)
    .single();

  if (submissionError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const { data: assignment } = await dbClient
    .from('assignments')
    .select('subject_id')
    .eq('id', submission.assignment_id)
    .single();

  if (!assignment || !subjectIds.includes(assignment.subject_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await dbClient
    .from('submissions')
    .update({
      grade,
      feedback: feedback || null,
      graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save grade' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}