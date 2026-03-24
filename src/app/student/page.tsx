'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnnouncementContent } from '@/components/AnnouncementContent';
import { createClient } from '@/lib/supabase';
import { StreamBadge } from '@/components/StreamBadge';
import { PageLoading } from '@/components/Loading';
import type { Profile, Assignment, Submission, Announcement, StreamName } from '@/lib/types';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ArrowRight, BookOpen, AlertCircle, FileText, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

function parseGrade(grade: string | null): number | null {
  if (!grade) return null;
  if (grade.includes('/')) {
    const [num, den] = grade.split('/').map((value) => parseFloat(value.trim()));
    if (!isNaN(num) && !isNaN(den) && den > 0) return Math.round((num / den) * 100);
  }

  const match = grade.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function StudentHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<Array<Assignment>>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<Array<Assignment>>([]);
  const [recentGrades, setRecentGrades] = useState<Array<Submission & { assignment: Assignment }>>([]);
  const [announcements, setAnnouncements] = useState<Array<Announcement>>([]);
  const [averageGrade, setAverageGrade] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!prof) {
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      const assignmentsResponse = await fetch('/api/student/assignments', { cache: 'no-store' });
      const assignmentsResult = assignmentsResponse.ok ? await assignmentsResponse.json() : null;
      const assignments = (assignmentsResult?.assignments || []) as Assignment[];
      const submissions = (assignmentsResult?.submissions || []) as Array<Submission & { assignment: Assignment }>;

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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-border shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/20" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] p-8 lg:p-10">
          <div className="flex flex-col justify-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                Student Dashboard
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                Welcome back,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500">
                  {profile?.full_name?.split(' ')[0]}
                </span>
              </h1>
              <p className="max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground mb-6">
                Stay on top of assignments, catch up on notices, and track your academic progress from one place.
              </p>
              
              {profile?.stream && (
                <div className="flex items-center gap-3 mb-8 bg-background/50 w-fit px-4 py-2 rounded-2xl border border-border/50 backdrop-blur-sm">
                  <span className="text-sm font-medium text-muted-foreground">Class Stream:</span> 
                  <StreamBadge stream={profile.stream as StreamName} />
                </div>
              )}
              
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="rounded-full shadow-lg shadow-primary/20">
                  <Link href="/student/assignments">
                    <BookOpen className="mr-2 h-4 w-4" /> Open Assignments
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full bg-background/50 backdrop-blur-sm hover:bg-background">
                  <Link href="/student/grades">
                    <Activity className="mr-2 h-4 w-4" /> View Analytics
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-2 gap-4 self-center">
            {[
              { label: 'Pending', value: pendingAssignments.length, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/10' },
              { label: 'Overdue', value: overdueAssignments.length, color: 'text-destructive', bg: 'bg-destructive/5', border: 'border-destructive/10' },
                { label: 'Average', value: averageGrade !== null ? `${averageGrade}%` : '—', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/5', border: 'border-green-500/10' },
              { label: 'Notices', value: announcements.length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/10' },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                whileHover={{ scale: 1.05, translateY: -5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className={`rounded-3xl border ${stat.border} ${stat.bg} p-6 backdrop-blur-xl shadow-sm text-center flex flex-col justify-center min-h-[120px]`}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{stat.label}</p>
                  <p className={`text-4xl lg:text-5xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {latestAnnouncement && (
          <motion.section 
            variants={itemVariants}
            className="relative overflow-hidden rounded-3xl border border-blue-200/50 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 shadow-md"
          >
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl" />
            <div className="relative p-8">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1 max-w-3xl">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Latest Announcement
                    </span>
                    <StreamBadge stream={(latestAnnouncement.stream as { name?: StreamName } | undefined)?.name ?? null} />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                    {latestAnnouncement.title}
                  </h2>
                </div>
                <div className="shrink-0 flex items-center justify-end">
                  <Button asChild variant="secondary" size="sm" className="rounded-full shadow-sm">
                    <Link href="/student/announcements">
                      Open notices <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-6 bg-background/60 dark:bg-background/40 backdrop-blur-md rounded-2xl p-6 border border-border/50 max-w-4xl">
                <AnnouncementContent body={latestAnnouncement.body} className="text-foreground/90 font-medium" />
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                Posted {new Date(latestAnnouncement.created_at).toLocaleString('en-KE')}
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {overdueAssignments.length > 0 && (
          <motion.div 
            variants={itemVariants}
            className="rounded-3xl border-2 border-destructive/20 bg-destructive/5 p-1 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-destructive via-destructive/50 to-transparent" />
            <div className="bg-background/50 rounded-[22px] p-6 lg:p-8 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive uppercase tracking-wide mb-2">
                    Priority Alert
                  </span>
                  <h2 className="text-xl font-bold text-foreground">Needs Attention</h2>
                  <p className="text-sm font-medium text-destructive/80 mt-1">
                    You have {overdueAssignments.length} overdue assignment{overdueAssignments.length === 1 ? '' : 's'} that need action.
                  </p>
                </div>
                <Button asChild variant="destructive" size="sm" className="rounded-full shadow-lg shadow-destructive/20 shrink-0">
                  <Link href="/student/assignments">
                    Review All <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overdueAssignments.slice(0, 3).map((assignment) => (
                  <motion.div
                    key={assignment.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="grid"
                  >
                    <Link
                      href={`/student/assignments/${assignment.id}`}
                      className="block rounded-2xl border border-destructive/20 bg-background/80 p-5 hover:border-destructive/40 shadow-sm transition-colors relative"
                    >
                      <div className="absolute top-0 right-0 p-3">
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase">
                          Overdue
                        </span>
                      </div>
                      <div className="pr-12">
                        <p className="font-bold text-base text-foreground leading-tight line-clamp-1">{assignment.title}</p>
                        <p className="text-xs font-semibold text-muted-foreground mt-1 mb-3">{(assignment as any).subject?.name}</p>
                        <p className="text-[11px] font-semibold text-destructive/70 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Due {new Date(assignment.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Action Board</p>
                <h2 className="text-2xl font-bold text-foreground">
                  Pending Assignments
                  <span className="ml-3 inline-flex items-center justify-center bg-primary/10 text-primary w-8 h-8 rounded-full text-sm">
                    {pendingAssignments.length}
                  </span>
                </h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full hover:bg-muted font-semibold text-primary">
                <Link href="/student/assignments">
                  Open planner <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            
            {pendingAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-3xl bg-muted/20">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-primary/60" />
                </div>
                <p className="text-lg font-semibold text-foreground">You&apos;re all caught up!</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">No pending assignments at the moment. Great job staying on top of your work.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAssignments.slice(0, 5).map((a) => (
                  <motion.div
                    key={a.id}
                    whileHover={{ scale: 1.01, x: 4 }}
                  >
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 lg:p-5 hover:border-primary/30 hover:shadow-md transition-all relative overflow-hidden"
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-primary transition-colors" />
                      <div>
                        <p className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">{a.title}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{(a as any).subject?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 sm:ml-auto">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Due Date</p>
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                            {new Date(a.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', weekday: 'short' })}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
                
                {pendingAssignments.length > 5 && (
                  <div className="pt-4 flex justify-center">
                    <Button asChild variant="outline" className="rounded-full text-muted-foreground hover:text-foreground">
                      <Link href="/student/assignments">
                        View all {pendingAssignments.length} assignments
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm h-full flex flex-col">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Performance</p>
                <h2 className="text-2xl font-bold text-foreground">Recent Grades</h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full hover:bg-muted font-semibold text-primary">
                <Link href="/student/grades">
                  Analytics <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            
            {recentGrades.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-3xl bg-muted/20">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No grades recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {recentGrades.map((s, idx) => {
                  const numGrade = parseGrade(s.grade);
                  const isHigh = numGrade !== null && numGrade >= 80;
                  const isLow = numGrade !== null && numGrade <50;
                  
                  return (
                    <motion.div 
                      key={s.id} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + (idx * 0.1) }}
                      className="flex justify-between items-center rounded-2xl bg-muted/30 p-4 border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-sm text-foreground line-clamp-1">{s.assignment?.title}</p>
                        <p className="text-xs font-medium text-muted-foreground mt-1">{(s.assignment as any).subject?.name}</p>
                      </div>
                      <div className={`shrink-0 ml-4 px-3 py-1.5 rounded-xl font-bold text-base border ${
                        isHigh ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                        isLow ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
                        'bg-blue-500/10 text-blue-600 border-blue-500/20'
                      }`}>
                        {s.grade}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
