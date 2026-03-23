'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PageLoading } from '@/components/Loading';

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalAssignments: number;
  totalSubmissions: number;
  streamCounts: Record<string, number>;
}

interface ExamStats {
  activeExams: number;
  inProgress: number;
  submitted: number;
  timedOut: number;
}

interface StorageHealth {
  status: 'healthy' | 'warning' | 'critical';
  totalMegabytes: number;
  fileCount: number;
  fileSubmissionCount: number;
  cleanupCandidateCount: number;
  oldestUploadAt: string | null;
  thresholds: {
    warningMb: number;
    criticalMb: number;
    cleanupCandidateDays: number;
  };
  recommendations: string[];
}

function formatStorage(valueMb: number) {
  if (valueMb >= 1024) {
    return `${(valueMb / 1024).toFixed(2)} GB`;
  }

  return `${valueMb.toFixed(1)} MB`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [examStats, setExamStats] = useState<ExamStats>({ activeExams: 0, inProgress: 0, submitted: 0, timedOut: 0 });
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [
        { count: studentCount },
        { count: teacherCount },
        { count: assignmentCount },
        { count: submissionCount },
        { data: students },
        { count: activeExamCount },
        { data: examSessions },
        storageHealthResponse,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('assignments').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('stream').eq('role', 'student'),
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('exam_sessions').select('status'),
        fetch('/api/admin/storage-health'),
      ]);

      const streamCounts: Record<string, number> = {};
      (students || []).forEach((s) => {
        if (s.stream) {
          streamCounts[s.stream] = (streamCounts[s.stream] || 0) + 1;
        }
      });

      setStats({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        totalAssignments: assignmentCount || 0,
        totalSubmissions: submissionCount || 0,
        streamCounts,
      });

      const sessions = examSessions || [];
      setExamStats({
        activeExams: activeExamCount || 0,
        inProgress: sessions.filter((s: any) => s.status === 'in_progress').length,
        submitted: sessions.filter((s: any) => s.status === 'submitted').length,
        timedOut: sessions.filter((s: any) => s.status === 'timed_out').length,
      });

      if (storageHealthResponse.ok) {
        const storageResult = await storageHealthResponse.json();
        setStorageHealth(storageResult as StorageHealth);
      } else {
        setStorageHealth(null);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading || !stats) return <PageLoading />;

  const streamColors: Record<string, string> = {
    Blue: '#185FA5', Green: '#1A6B45', Magenta: '#99355A',
    Red: '#A32D2D', White: '#888780', Yellow: '#BA7517',
  };

  const storageTone = storageHealth?.status === 'critical'
    ? 'border-red-200 bg-red-50 text-red-800'
    : storageHealth?.status === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className="space-y-6">
      <h1 className="page-title">Admin Dashboard</h1>

      {storageHealth && (
        <div className={`card border ${storageTone}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.22em] opacity-75">Storage Health</p>
              <h2 className="mt-2 text-xl font-semibold">
                {storageHealth.status === 'critical'
                  ? 'Storage is near the dashboard critical threshold'
                  : storageHealth.status === 'warning'
                    ? 'Storage is rising and should be reviewed'
                    : 'Storage is within the safe range'}
              </h2>
              <p className="mt-2 text-sm leading-6 opacity-90">
                Uploaded submission files currently use about {formatStorage(storageHealth.totalMegabytes)} across {storageHealth.fileCount} stored object(s).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[260px]">
              <div className="rounded-2xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-[0.18em] opacity-70">Usage</p>
                <p className="mt-2 text-2xl font-bold">{formatStorage(storageHealth.totalMegabytes)}</p>
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-[0.18em] opacity-70">Cleanup Candidates</p>
                <p className="mt-2 text-2xl font-bold">{storageHealth.cleanupCandidateCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Warning Threshold</p>
              <p className="mt-2 font-semibold">{formatStorage(storageHealth.thresholds.warningMb)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Critical Threshold</p>
              <p className="mt-2 font-semibold">{formatStorage(storageHealth.thresholds.criticalMb)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Oldest Upload</p>
              <p className="mt-2 font-semibold">
                {storageHealth.oldestUploadAt
                  ? new Date(storageHealth.oldestUploadAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'No uploads yet'}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm leading-6 opacity-90">
            {storageHealth.recommendations.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/students" className="card text-center hover:border-primary/30 transition-colors">
          <p className="text-3xl font-bold text-primary">{stats.totalStudents}</p>
          <p className="text-sm text-gray-500">Students</p>
        </Link>
        <Link href="/admin/teachers" className="card text-center hover:border-primary/30 transition-colors">
          <p className="text-3xl font-bold text-blue-600">{stats.totalTeachers}</p>
          <p className="text-sm text-gray-500">Teachers</p>
        </Link>
        <div className="card text-center">
          <p className="text-3xl font-bold text-purple-600">{stats.totalAssignments}</p>
          <p className="text-sm text-gray-500">Assignments</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-orange-600">{stats.totalSubmissions}</p>
          <p className="text-sm text-gray-500">Submissions</p>
        </div>
      </div>

      {/* Live Exam Monitor Panel */}
      {(examStats.activeExams > 0 || examStats.inProgress > 0) && (
        <div className="card border-2 border-yellow-300 bg-yellow-50">
          <h2 className="font-semibold text-lg text-yellow-800 mb-3">📡 Live Exam Activity</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-yellow-700">{examStats.inProgress}</p>
              <p className="text-xs text-yellow-600">🟡 In Exam Now</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{examStats.submitted}</p>
              <p className="text-xs text-green-600">🟢 Submitted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{examStats.timedOut}</p>
              <p className="text-xs text-red-600">🔴 Timed Out</p>
            </div>
          </div>
          <p className="text-xs text-yellow-600 mt-3">{examStats.activeExams} active exam(s) across all teachers</p>
        </div>
      )}

      {/* Stream Breakdown */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Students by Stream</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(streamColors).map(([name, color]) => (
            <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <div>
                <p className="font-medium text-sm">{name}</p>
                <p className="text-xs text-gray-500">{stats.streamCounts[name] || 0} students</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/admin/students" className="btn-primary text-center text-sm">
            Import Students (CSV)
          </Link>
          <Link href="/admin/teachers" className="btn-primary text-center text-sm">
            Add Teacher
          </Link>
          <Link href="/admin/subjects" className="btn-primary text-center text-sm">
            Manage Subjects
          </Link>
          <Link href="/admin/chat" className="btn-secondary text-center text-sm">
            Moderate Grade Chats
          </Link>
          <Link href="/admin/cleanup" className="btn-secondary text-center text-sm">
            Review Storage Cleanup
          </Link>
          <Link href="/admin/reports" className="btn-secondary text-center text-sm">
            View Reports
          </Link>
        </div>
      </div>
    </div>
  );
}
