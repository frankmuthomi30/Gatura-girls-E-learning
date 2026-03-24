import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const client = serviceRole
    ? createClient(getSupabaseUrl(), serviceRole)
    : supabase;

  // Verify teacher role
  const { data: profile } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get teacher's subjects
  const { data: subs } = await client
    .from('subjects')
    .select('*, stream:streams(name)')
    .eq('teacher_id', user.id);

  const subjects = subs || [];
  const subjectIds = subjects.map((s: any) => s.id);

  let assignments: any[] = [];
  let pendingGrading = 0;
  let pendingQueue: any[] = [];

  if (subjectIds.length > 0) {
    const { data: assignmentRows } = await client
      .from('assignments')
      .select('*, subject:subjects(name), stream:streams(name)')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false });

    assignments = assignmentRows || [];

    const assignmentIds = assignments.map((a: any) => a.id);

    if (assignmentIds.length > 0) {
      const { count } = await client
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .is('grade', null)
        .in('assignment_id', assignmentIds);

      pendingGrading = count || 0;

      const { data: queue } = await client
        .from('submissions')
        .select('*, assignment:assignments(title, subject:subjects(name)), student:profiles(full_name, admission_number)')
        .is('grade', null)
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false })
        .limit(5);

      pendingQueue = queue || [];
    }
  }

  const now = Date.now();
  const oneWeekFromNow = now + (7 * 24 * 60 * 60 * 1000);
  const dueThisWeek = assignments.filter((a: any) => {
    const dueTime = new Date(a.due_date).getTime();
    return dueTime >= now && dueTime <= oneWeekFromNow;
  }).length;

  const activeAssignments = assignments.filter(
    (a: any) => a.status === 'published' || a.status === 'active'
  ).length;

  return NextResponse.json({
    subjects,
    recentAssignments: assignments.slice(0, 5),
    pendingQueue,
    stats: {
      totalAssignments: assignments.length,
      activeAssignments,
      pendingGrading,
      dueThisWeek,
    },
  });
}
