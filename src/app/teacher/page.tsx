'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import { AnimatedPage } from '@/components/ui/animated-page';
import type { Subject, Assignment, StreamName, Submission, Profile } from '@/lib/types';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, BookOpen, CheckCircle, FileText, Activity, MessageSquare, Megaphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PendingSubmission = Submission & {
  assignment?: Assignment;
  student?: Pick<Profile, 'full_name' | 'admission_number'>;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
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

export default function TeacherDashboard() {
  const [subjects, setSubjects] = useState<Array<Subject>>([]);
  const [recentAssignments, setRecentAssignments] = useState<Array<Assignment>>([]);
  const [pendingQueue, setPendingQueue] = useState<Array<PendingSubmission>>([]);
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
      bg: 'bg-primary/5',
      border: 'border-primary/10'
    },
    {
      label: 'Active Assignments',
      value: stats.activeAssignments,
      hint: 'Live tasks visible to learners',
      accent: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/10'
    },
    {
      label: 'To Grade',
      value: stats.pendingGrading,
      hint: 'Submissions waiting review',
      accent: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/5',
      border: 'border-orange-500/10'
    },
    {
      label: 'Due This Week',
      value: stats.dueThisWeek,
      hint: 'Tasks ending in next 7 days',
      accent: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/5',
      border: 'border-green-500/10'
    },
  ];

  return (
    <AnimatedPage className="space-y-6">
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-primary/20 shadow-xl bg-gradient-to-br from-primary to-primary-dark">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_40%)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between p-8 lg:p-10 text-white">
          <div className="max-w-3xl space-y-5">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/90 backdrop-blur-md mb-4 shadow-sm">
                Teaching Overview
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
                Teacher Dashboard
              </h1>
              <p className="max-w-2xl text-base md:text-lg leading-relaxed text-white/80">
                Keep classes moving with a cleaner snapshot of your subject load, upcoming assignment deadlines, and the active grading queue.
              </p>
              
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg" variant="secondary" className="rounded-full shadow-lg font-semibold bg-white text-primary hover:bg-white/90">
                  <Link href="/teacher/assignments">
                    <BookOpen className="mr-2 h-4 w-4" /> Manage Assignments
                  </Link>
                </Button>
                <Button asChild size="lg" className="rounded-full bg-white/10 border border-white/20 hover:bg-white/20 backdrop-blur-sm text-white">
                  <Link href="/teacher/submissions">
                    <CheckCircle className="mr-2 h-4 w-4" /> Grade Submissions
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="rounded-3xl border border-white/20 bg-black/20 p-6 backdrop-blur-xl shadow-lg shrink-0 lg:w-72"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-4">Focus Now</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-black text-white">{stats.pendingGrading}</p>
                <p className="text-[11px] font-medium text-white/70 uppercase tracking-wider mt-1">To Grade</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">{stats.dueThisWeek}</p>
                <p className="text-[11px] font-medium text-white/70 uppercase tracking-wider mt-1">Due Soon</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div 
            key={card.label} 
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -4 }}
            className={`rounded-3xl border ${card.border} ${card.bg} p-6 shadow-sm flex flex-col justify-between`}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">{card.label}</p>
              <p className={`text-4xl font-black tracking-tight ${card.accent}`}>{card.value}</p>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground mt-4 leading-relaxed">{card.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm flex flex-col xl:col-span-2">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Latest Work</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Recent Assignments</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-full hover:bg-muted font-semibold text-primary">
              <Link href="/teacher/assignments">
                View all <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          
          {recentAssignments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center border border-dashed border-border rounded-2xl bg-muted/20">
              <BookOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No assignments created yet.</p>
              <Button asChild size="sm" className="mt-4 rounded-full">
                <Link href="/teacher/assignments">Create First Assignment</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAssignments.map((a) => (
                <motion.div key={a.id} whileHover={{ scale: 1.01, x: 4 }}>
                  <Link
                    href={`/teacher/submissions?assignment=${a.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 hover:border-primary/30 hover:shadow-sm transition-all relative overflow-hidden"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-primary transition-colors" />
                    <div>
                      <p className="font-semibold text-sm md:text-base text-foreground group-hover:text-primary transition-colors">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{(a as any).subject?.name}</span>
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{(a as any).stream?.name || 'All Streams'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t border-border pt-3 sm:border-0 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                          a.status === 'published' || a.status === 'active' 
                            ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Due Date</p>
                        <p className="text-xs font-semibold text-foreground">
                          {new Date(a.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm flex flex-col">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Review Pipeline</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Grading Queue</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-full hover:bg-muted font-semibold text-primary">
              <Link href="/teacher/submissions">
                Open <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          
          {pendingQueue.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-2xl bg-muted/20">
              <CheckCircle className="w-10 h-10 text-green-500/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Everything is graded right now. Catch a break!</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {pendingQueue.map((submission) => (
                <motion.div 
                  key={submission.id}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-2xl bg-muted/30 p-4 border border-border/50 hover:bg-muted/60 transition-colors"
                >
                  <p className="font-semibold text-sm text-foreground line-clamp-1">{submission.assignment?.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                      {submission.student?.full_name?.charAt(0) || 'S'}
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {submission.student?.full_name || 'Student'}
                      {submission.student?.admission_number ? ` · #${submission.student.admission_number}` : ''}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold text-muted-foreground/70 mt-2 flex items-center">
                    <Activity className="w-3 h-3 mr-1" />
                    Submitted {new Date(submission.submitted_at).toLocaleDateString('en-KE', {
                      month: 'short', day: 'numeric',
                    })}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Teaching Roster</p>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">My Subjects</h2>
          </div>
          <p className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit">
            {subjects.length} assigned
          </p>
        </div>
        
        {subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-2xl bg-muted/20">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No subjects assigned yet. Ask an admin to assign you.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s, i) => (
              <motion.div 
                key={s.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.05) }}
                className="flex items-center justify-between rounded-2xl p-4 lg:p-5 border border-border bg-background shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="font-bold text-sm md:text-base text-foreground">{s.name}</p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">Assigned Subject</p>
                </div>
                <div className="shrink-0 ml-4">
                  <StreamBadge stream={(s.stream as any)?.name as StreamName} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fast Paths</p>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Quick Actions</h2>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { 
              title: "Assignments", 
              desc: "Create new work, review drafts, and manage publishing.", 
              href: "/teacher/assignments", 
              label: "Open Assignments",
              icon: <BookOpen className="w-5 h-5 text-primary" />,
              bg: "bg-primary/5"
            },
            { 
              title: "Grading", 
              desc: "Work through pending submissions and keep marks current.", 
              href: "/teacher/submissions", 
              label: "Grade Work",
              icon: <CheckCircle className="w-5 h-5 text-green-500" />,
              bg: "bg-green-500/5"
            },
            { 
              title: "Chats", 
              desc: "Join conversations for grade-specific coordination.", 
              href: "/teacher/chat", 
              label: "Join Chats",
              icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
              bg: "bg-blue-500/5"
            },
            { 
              title: "Announcements", 
              desc: "Share updates, reminders, and classroom guidance quickly.", 
              href: "/teacher/announcements", 
              label: "Post Update",
              icon: <Megaphone className="w-5 h-5 text-orange-500" />,
              bg: "bg-orange-500/5"
            }
          ].map((action, i) => (
            <motion.div 
              key={action.title}
              whileHover={{ y: -4 }}
              className={`rounded-2xl border border-border ${action.bg} p-6 flex flex-col h-full`}
            >
              <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center mb-4 shadow-sm">
                {action.icon}
              </div>
              <p className="font-bold text-base text-foreground mb-2">{action.title}</p>
              <p className="text-xs font-medium text-muted-foreground mb-6 flex-1 leading-relaxed">{action.desc}</p>
              <Button asChild variant="outline" className="w-full rounded-xl bg-background/50 hover:bg-background">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatedPage>
  );
}
