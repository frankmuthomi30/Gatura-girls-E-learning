'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { Subject, Assignment, StreamName, Submission, Profile } from '@/lib/types';

type PendingSubmission = Submission & {
  assignment?: Assignment;
  student?: Pick<Profile, 'full_name' | 'admission_number'>;
};

export default function TeacherDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingSubmission[]>([]);
  const [stats, setStats] = useState({ totalAssignments: 0, activeAssignments: 0, pendingGrading: 0, dueThisWeek: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get teacher's subjects
      const { data: subs } = await supabase
        .from('subjects')
        .select('*, stream:streams(name)')
        .eq('teacher_id', user.id);

      setSubjects((subs || []) as Subject[]);

      // Get teacher's assignments
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*, subject:subjects(name), stream:streams(name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      const allAssignments = (assignments || []) as Assignment[];
      const assignmentIds = allAssignments.map((assignment) => assignment.id);
      setRecentAssignments(allAssignments.slice(0, 5));

      let pendingGrading = 0;

      if (assignmentIds.length > 0) {
        const { count } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .is('grade', null)
          .in('assignment_id', assignmentIds);

        pendingGrading = count || 0;

        const { data: queue } = await supabase
          .from('submissions')
          .select('*, assignment:assignments(title, subject:subjects(name)), student:profiles(full_name, admission_number)')
          .is('grade', null)
          .in('assignment_id', assignmentIds)
          .order('submitted_at', { ascending: false })
          .limit(5);

        setPendingQueue((queue || []) as PendingSubmission[]);
      } else {
        setPendingQueue([]);
      }

      const now = Date.now();
      const oneWeekFromNow = now + (7 * 24 * 60 * 60 * 1000);
      const dueThisWeek = allAssignments.filter((assignment) => {
        const dueTime = new Date(assignment.due_date).getTime();
        return dueTime >= now && dueTime <= oneWeekFromNow;
      }).length;

      const activeAssignments = allAssignments.filter(
        (assignment) => assignment.status === 'published' || assignment.status === 'active'
      ).length;

      setStats({
        totalAssignments: allAssignments.length,
        activeAssignments,
        pendingGrading,
        dueThisWeek,
      });

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Teacher Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary">{subjects.length}</p>
          <p className="text-sm text-gray-500">My Subjects</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.activeAssignments}</p>
          <p className="text-sm text-gray-500">Active Assignments</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-orange-600">{stats.pendingGrading}</p>
          <p className="text-sm text-gray-500">To Grade</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{stats.dueThisWeek}</p>
          <p className="text-sm text-gray-500">Due This Week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <div className="flex justify-between items-center mb-3 gap-3">
            <h2 className="font-semibold text-lg">Recent Assignments</h2>
            <Link href="/teacher/assignments" className="text-sm text-primary font-medium">
              View all →
            </Link>
          </div>
          {recentAssignments.length === 0 ? (
            <p className="text-gray-500 text-sm">No assignments created yet.</p>
          ) : (
            <div className="space-y-2">
              {recentAssignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/teacher/submissions?assignment=${a.id}`}
                  className="block p-3 rounded-lg border border-gray-200 hover:border-primary/30 transition-colors"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-gray-500">{(a as any).subject?.name} · {(a as any).stream?.name || 'All Streams'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">
                        {new Date(a.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{a.status}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-3 gap-3">
            <h2 className="font-semibold text-lg">Grading Queue</h2>
            <Link href="/teacher/submissions" className="text-sm text-primary font-medium">
              Open →
            </Link>
          </div>
          {pendingQueue.length === 0 ? (
            <p className="text-gray-500 text-sm">Everything is graded right now.</p>
          ) : (
            <div className="space-y-3">
              {pendingQueue.map((submission) => (
                <div key={submission.id} className="rounded-lg bg-gray-50 px-3 py-3">
                  <p className="font-medium text-sm">{submission.assignment?.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {submission.student?.full_name || 'Student'}
                    {submission.student?.admission_number ? ` · #${submission.student.admission_number}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Submitted {new Date(submission.submitted_at).toLocaleDateString('en-KE', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Subjects */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-3">My Subjects</h2>
        {subjects.length === 0 ? (
          <p className="text-gray-500 text-sm">No subjects assigned yet. Ask admin to assign you.</p>
        ) : (
          <div className="space-y-2">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="font-medium text-sm">{s.name}</span>
                <StreamBadge stream={(s.stream as any)?.name as StreamName} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/teacher/assignments" className="btn-primary text-center text-sm">
            Create or Review Assignments
          </Link>
          <Link href="/teacher/submissions" className="btn-secondary text-center text-sm">
            Grade Submissions
          </Link>
          <Link href="/teacher/chat" className="btn-secondary text-center text-sm">
            Join Grade Chats
          </Link>
          <Link href="/teacher/announcements" className="btn-secondary text-center text-sm">
            Post Announcement
          </Link>
        </div>
      </div>
    </div>
  );
}
