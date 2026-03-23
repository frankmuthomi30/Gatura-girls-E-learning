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

  const statCards = [
    {
      label: 'My Subjects',
      value: subjects.length,
      hint: `${subjects.length === 1 ? '1 stream-linked class' : `${subjects.length} active subject lanes`}`,
      accent: 'text-primary',
    },
    {
      label: 'Active Assignments',
      value: stats.activeAssignments,
      hint: 'Live tasks still visible to learners',
      accent: 'text-blue-600',
    },
    {
      label: 'To Grade',
      value: stats.pendingGrading,
      hint: 'Submissions waiting for review',
      accent: 'text-orange-600',
    },
    {
      label: 'Due This Week',
      value: stats.dueThisWeek,
      hint: 'Deadlines landing in the next 7 days',
      accent: 'text-green-600',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="card dashboard-hero border-0 p-6 md:p-8 text-white">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-md">
              Teaching overview
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Teacher Dashboard</h1>
              <p className="max-w-2xl text-sm leading-7 text-white/80 md:text-base">
                Keep classes moving with a cleaner snapshot of subject load, assignment deadlines, and the grading queue.
              </p>
            </div>
          </div>

          <div className="dashboard-accent-panel rounded-[24px] px-5 py-4 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.22em] text-white/60">Focus now</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold text-white">{stats.pendingGrading}</p>
                <p className="text-xs text-white/70">Awaiting review</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{stats.dueThisWeek}</p>
                <p className="text-xs text-white/70">Due this week</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{recentAssignments.length}</p>
                <p className="text-xs text-white/70">Recent tasks shown</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card dashboard-stat-card text-center sm:text-left">
            <div className="relative space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{card.label}</p>
              <p className={`text-3xl font-bold ${card.accent}`}>{card.value}</p>
              <p className="text-sm text-gray-500">{card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <div className="flex justify-between items-center mb-4 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Latest work</p>
              <h2 className="font-semibold text-xl">Recent Assignments</h2>
            </div>
            <Link href="/teacher/assignments" className="text-sm text-primary font-medium">
              View all →
            </Link>
          </div>
          {recentAssignments.length === 0 ? (
            <p className="text-gray-500 text-sm">No assignments created yet.</p>
          ) : (
            <div className="space-y-3">
              {recentAssignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/teacher/submissions?assignment=${a.id}`}
                  className="dashboard-list-item block rounded-[22px] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-sm md:text-base">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{(a as any).subject?.name} · {(a as any).stream?.name || 'All Streams'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400 uppercase tracking-[0.18em]">
                        {new Date(a.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{a.status}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Review pipeline</p>
              <h2 className="font-semibold text-xl">Grading Queue</h2>
            </div>
            <Link href="/teacher/submissions" className="text-sm text-primary font-medium">
              Open →
            </Link>
          </div>
          {pendingQueue.length === 0 ? (
            <p className="text-gray-500 text-sm">Everything is graded right now.</p>
          ) : (
            <div className="space-y-3">
              {pendingQueue.map((submission) => (
                <div key={submission.id} className="dashboard-list-item rounded-[20px] px-4 py-4">
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
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Teaching roster</p>
            <h2 className="font-semibold text-xl">My Subjects</h2>
          </div>
          <p className="text-sm text-gray-500">{subjects.length} assigned</p>
        </div>
        {subjects.length === 0 ? (
          <p className="text-gray-500 text-sm">No subjects assigned yet. Ask admin to assign you.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {subjects.map((s) => (
              <div key={s.id} className="dashboard-list-item flex items-center justify-between rounded-[22px] p-4">
                <div>
                  <p className="font-medium text-sm md:text-base">{s.name}</p>
                  <p className="mt-1 text-xs text-gray-500">Subject currently assigned to your profile</p>
                </div>
                <StreamBadge stream={(s.stream as any)?.name as StreamName} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Fast paths</p>
          <h2 className="font-semibold text-xl mt-1">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="dashboard-action-card rounded-[24px] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Assignments</p>
            <p className="mt-2 text-sm text-gray-600">Create new work, review drafts, and manage publishing windows.</p>
            <Link href="/teacher/assignments" className="btn-primary mt-4 block text-center text-sm">
              Open Assignments
            </Link>
          </div>
          <div className="dashboard-action-card rounded-[24px] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Grading</p>
            <p className="mt-2 text-sm text-gray-600">Work through pending submissions and keep marks current.</p>
            <Link href="/teacher/submissions" className="btn-secondary mt-4 block text-center text-sm">
              Grade Submissions
            </Link>
          </div>
          <div className="dashboard-action-card rounded-[24px] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Chats</p>
            <p className="mt-2 text-sm text-gray-600">Join stream conversations for grade-specific coordination.</p>
            <Link href="/teacher/chat" className="btn-secondary mt-4 block text-center text-sm">
              Join Grade Chats
            </Link>
          </div>
          <div className="dashboard-action-card rounded-[24px] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Announcements</p>
            <p className="mt-2 text-sm text-gray-600">Share updates, reminders, and classroom guidance quickly.</p>
            <Link href="/teacher/announcements" className="btn-secondary mt-4 block text-center text-sm">
              Post Announcement
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
