'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PageLoading } from '@/components/Loading';
import type { Assignment, ExamSession } from '@/lib/types';

const MODE_LABELS: Record<string, { label: string; icon: string }> = {
  mcq: { label: 'MCQ', icon: '🔘' },
  theory: { label: 'Theory', icon: '📝' },
  mixed: { label: 'Mixed', icon: '🔄' },
  practical: { label: 'Practical', icon: '🔬' },
  exam: { label: 'Exam', icon: '⏱️' },
  file_upload: { label: 'Upload', icon: '📎' },
};

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [examSessions, setExamSessions] = useState<Record<string, ExamSession>>({});
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
        .select('stream, academic_year')
        .eq('id', user.id)
        .single();

      if (!prof) {
        setLoading(false);
        return;
      }

      const { data: assignments } = await supabase
        .from('assignments')
        .select('*, subject:subjects(name), stream:streams(name)')
        .in('status', ['published', 'active'])
        .order('due_date', { ascending: false });

      setAssignments((assignments || []) as Assignment[]);

      // File-upload submissions
      const { data: subs } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', user.id);

      setSubmittedIds(new Set((subs || []).map(s => s.assignment_id)));

      // Exam sessions
      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('student_id', user.id);

      const sessMap: Record<string, ExamSession> = {};
      (sessions || []).forEach((s: any) => { sessMap[s.assignment_id] = s; });
      setExamSessions(sessMap);

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoading />;

  const now = new Date().toISOString();

  const getStatusBadge = (a: Assignment) => {
    const mode = a.mode || 'file_upload';
    const isExamMode = ['mcq', 'theory', 'mixed', 'exam'].includes(mode);

    if (isExamMode) {
      const session = examSessions[a.id];
      if (!session) return <span className="badge bg-blue-500">Not Started</span>;
      if (session.status === 'in_progress') return <span className="badge bg-yellow-500">In Progress</span>;
      if (session.status === 'submitted') return <span className="badge bg-green-600">Submitted</span>;
      if (session.status === 'timed_out') return <span className="badge bg-orange-600">Timed Out</span>;
      return <span className="badge bg-gray-500">{session.status}</span>;
    }

    // File upload mode
    const isSubmitted = submittedIds.has(a.id);
    const isPastDue = a.due_date < now;
    if (isSubmitted) return <span className="badge bg-green-600">Submitted</span>;
    if (isPastDue) return <span className="badge bg-red-500">Past Due</span>;
    return <span className="badge bg-orange-500">Pending</span>;
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">My Assignments</h1>

      {assignments.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">No assignments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const mode = a.mode || 'file_upload';
            const modeInfo = MODE_LABELS[mode] || MODE_LABELS.file_upload;

            return (
              <Link key={a.id} href={`/student/assignments/${a.id}`}
                className="card block hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{a.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                        {modeInfo.icon} {modeInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{(a as any).subject?.name}</p>
                    {a.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.description}</p>
                    )}
                    {a.time_limit && (
                      <p className="text-xs text-gray-400 mt-1">⏱️ {a.time_limit} min</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {getStatusBadge(a)}
                    <span className="text-xs text-gray-400">
                      {new Date(a.due_date).toLocaleDateString('en-KE', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                    {a.total_points && (
                      <span className="text-xs text-gray-400">{a.total_points} pts</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
