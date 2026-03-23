'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnnouncementContent } from '@/components/AnnouncementContent';
import { createClient } from '@/lib/supabase';
import { StreamBadge } from '@/components/StreamBadge';
import { PageLoading } from '@/components/Loading';
import type { Profile, Assignment, Submission, Announcement, StreamName } from '@/lib/types';

function parseGrade(grade: string | null): number | null {
  if (!grade) return null;
  if (grade.includes('/')) {
    const [num, den] = grade.split('/').map((value) => parseFloat(value.trim()));
    if (!isNaN(num) && !isNaN(den) && den > 0) return Math.round((num / den) * 100);
  }

  const match = grade.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

export default function StudentHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<Assignment[]>([]);
  const [recentGrades, setRecentGrades] = useState<(Submission & { assignment: Assignment })[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [averageGrade, setAverageGrade] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!prof) return;
      setProfile(prof as Profile);

      // Get stream ID for this student's stream
      const { data: streamData } = await supabase
        .from('streams')
        .select('id')
        .eq('name', prof.stream)
        .eq('academic_year', prof.academic_year)
        .single();

      if (!streamData) { setLoading(false); return; }

      // Get all assignments for student's stream
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*, subject:subjects(name)')
        .or(`stream_id.eq.${streamData.id},stream_id.is.null`)
        .order('due_date', { ascending: true });

      const { data: submissions } = await supabase
        .from('submissions')
        .select('*, assignment:assignments(*, subject:subjects(name))')
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false });

      // Filter pending (no submission yet, not past due)
      const submittedIds = new Set((submissions || []).map(s => s.assignment_id));
      const now = new Date().toISOString();
      const pending = (assignments || []).filter(
        a => !submittedIds.has(a.id) && a.due_date > now
      );
      const overdue = (assignments || []).filter(
        a => !submittedIds.has(a.id) && a.due_date <= now
      );
      setPendingAssignments(pending as Assignment[]);
      setOverdueAssignments(overdue as Assignment[]);

      // Recent graded submissions
      const graded = (submissions || [])
        .filter(s => s.grade)
        .slice(0, 5);
      setRecentGrades(graded as (Submission & { assignment: Assignment })[]);

      const numericGrades = (submissions || [])
        .map((submission) => parseGrade(submission.grade))
        .filter((grade): grade is number => grade !== null);

      setAverageGrade(
        numericGrades.length > 0
          ? Math.round(numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length)
          : null
      );

      const announcementsResponse = await fetch('/api/student/announcements?limit=4');
      if (announcementsResponse.ok) {
        const result = await announcementsResponse.json();
        setAnnouncements((result.announcements || []) as Announcement[]);
      } else {
        setAnnouncements([]);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoading message="Loading your dashboard" description="Collecting assignments, grades, and the latest announcements." />;

  const latestAnnouncement = announcements[0] || null;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden relative p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_24%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] p-7 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Student Dashboard</p>
            <h1 className="page-title mt-3">
              Welcome back, {profile?.full_name?.split(' ')[0]}.
            </h1>
            <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-gray-600">
              Stay on top of assignments, catch up on notices, and track your academic progress from one place.
            </p>
            {profile?.stream && (
              <div className="mt-5 flex items-center gap-2 text-sm text-gray-500">
                Stream: <StreamBadge stream={profile.stream as StreamName} />
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/student/assignments" className="btn-primary text-sm">
                Open Assignments
              </Link>
              <Link href="/student/chat" className="btn-secondary text-sm">
                Open Grade Chat
              </Link>
              <Link href="/student/grades" className="btn-secondary text-sm">
                View Grade Analytics
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            <div className="rounded-[24px] bg-white/75 border border-white/70 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Pending</p>
              <p className="mt-2 text-3xl font-bold text-primary">{pendingAssignments.length}</p>
            </div>
            <div className="rounded-[24px] bg-white/75 border border-white/70 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Overdue</p>
              <p className="mt-2 text-3xl font-bold text-red-500">{overdueAssignments.length}</p>
            </div>
            <div className="rounded-[24px] bg-white/75 border border-white/70 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Average</p>
              <p className="mt-2 text-3xl font-bold text-green-600">{averageGrade !== null ? `${averageGrade}%` : '—'}</p>
            </div>
            <div className="rounded-[24px] bg-white/75 border border-white/70 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Notices</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{announcements.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Work', value: pendingAssignments.length, tone: 'text-primary' },
          { label: 'Overdue', value: overdueAssignments.length, tone: 'text-red-500' },
          { label: 'Average Grade', value: averageGrade !== null ? `${averageGrade}%` : '—', tone: 'text-green-600' },
          { label: 'Latest Notices', value: announcements.length, tone: 'text-blue-600' },
        ].map((item) => (
          <div key={item.label} className="card group hover:-translate-y-0.5 transition-transform">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
            <p className={`mt-4 text-3xl font-bold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {latestAnnouncement && (
        <section className="card overflow-hidden relative p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_24%)]" />
          <div className="relative p-6 lg:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Latest Announcement</p>
                <h2 className="mt-3 text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-50">
                  {latestAnnouncement.title}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <StreamBadge stream={(latestAnnouncement.stream as { name?: StreamName } | undefined)?.name ?? null} />
                <Link href="/student/announcements" className="btn-secondary text-sm py-2 px-4">
                  Open notices
                </Link>
              </div>
            </div>

            <AnnouncementContent body={latestAnnouncement.body} className="mt-5 max-w-4xl" />

            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-gray-400">
              Posted {new Date(latestAnnouncement.created_at).toLocaleString('en-KE')}
            </p>
          </div>
        </section>
      )}

      {overdueAssignments.length > 0 && (
        <div className="card border border-red-200/70 bg-[linear-gradient(180deg,rgba(254,242,242,0.94),rgba(255,255,255,0.88))]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-red-400">Priority</p>
              <h2 className="font-semibold text-lg text-red-800 mt-2">Needs Attention</h2>
              <p className="text-sm text-red-700 mt-1 leading-6">
                You have {overdueAssignments.length} overdue assignment{overdueAssignments.length === 1 ? '' : 's'} that need action.
              </p>
            </div>
            <Link href="/student/assignments" className="btn-secondary text-sm whitespace-nowrap">
              Review All
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {overdueAssignments.slice(0, 3).map((assignment) => (
              <Link
                key={assignment.id}
                href={`/student/assignments/${assignment.id}`}
                className="block rounded-[22px] border border-red-200/70 bg-white/85 px-4 py-4 hover:border-red-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{assignment.title}</p>
                    <p className="text-xs text-gray-500">{(assignment as any).subject?.name}</p>
                  </div>
                  <span className="text-xs font-medium text-red-600 whitespace-nowrap">
                    Due {new Date(assignment.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Action Board</p>
                <h2 className="font-semibold text-xl mt-2">
                  Pending Assignments ({pendingAssignments.length})
                </h2>
              </div>
              <Link href="/student/assignments" className="text-sm text-primary font-medium">
                Open planner →
              </Link>
            </div>
            {pendingAssignments.length === 0 ? (
              <p className="text-gray-500 text-sm">No pending assignments. You&apos;re all caught up!</p>
            ) : (
              <div className="space-y-3">
                {pendingAssignments.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    href={`/student/assignments/${a.id}`}
                    className="block rounded-[24px] border border-gray-200/80 bg-white/80 p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{(a as any).subject?.name}</p>
                      </div>
                      <span className="text-xs text-orange-600 font-medium whitespace-nowrap ml-2">
                        Due {new Date(a.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </Link>
                ))}
                {pendingAssignments.length > 5 && (
                  <Link href="/student/assignments" className="text-sm text-primary font-medium">
                    View all →
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Performance</p>
                <h2 className="font-semibold text-xl mt-2">Recent Grades</h2>
              </div>
              <Link href="/student/grades" className="text-sm text-primary font-medium">
                View analytics →
              </Link>
            </div>
            {recentGrades.length === 0 ? (
              <p className="text-gray-500 text-sm">No grades yet.</p>
            ) : (
              <div className="space-y-3">
                {recentGrades.map((s) => (
                  <div key={s.id} className="flex justify-between items-center rounded-[24px] bg-slate-50/80 p-4 border border-white/70">
                    <div>
                      <p className="font-medium text-sm">{s.assignment?.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{(s.assignment as any)?.subject?.name}</p>
                    </div>
                    <span className="text-lg font-bold text-primary">{s.grade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="card h-fit">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">School Updates</p>
                <h2 className="font-semibold text-xl mt-2">Announcements</h2>
              </div>
              <Link href="/student/announcements" className="text-sm text-primary font-medium">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="announcement-card rounded-[24px] border border-primary/10 bg-primary/5 p-4">
                  <p className="font-medium text-sm text-gray-900 dark:text-slate-50">{ann.title}</p>
                  <AnnouncementContent body={ann.body} className="mt-3 announcement-content--compact" />
                  <p className="text-xs text-gray-400 mt-3">
                    {new Date(ann.created_at).toLocaleDateString('en-KE')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
