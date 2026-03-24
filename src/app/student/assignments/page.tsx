'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLoading } from '@/components/Loading';
import type { Assignment, ExamSession, Submission } from '@/lib/types';

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
      const response = await fetch('/api/student/assignments', { cache: 'no-store' });
      if (!response.ok) {
        setLoading(false);
        return;
      }

      const result = await response.json();
      const assignments = (result.assignments || []) as Assignment[];
      const subs = (result.submissions || []) as Submission[];
      const sessions = (result.examSessions || []) as ExamSession[];

      setAssignments(assignments);
      setSubmittedIds(new Set(subs.map((s) => s.assignment_id)));

      const sessMap: Record<string, ExamSession> = {};
      sessions.forEach((s) => { sessMap[s.assignment_id] = s; });
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
