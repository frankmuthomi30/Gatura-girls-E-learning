'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { PageLoading } from '@/components/Loading';

interface ActiveExam {
  id: string;
  title: string;
  mode: string;
  time_limit: number | null;
  total_points: number | null;
  subject_name: string;
  stream_name: string;
  started_at: string;
}

interface SessionRow {
  id: string;
  student_id: string;
  assignment_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  last_activity: string;
  time_remaining: number | null;
  score: number | null;
  student_name: string;
  admission_number: string;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  in_progress: { icon: '🟡', label: 'In Exam', color: 'bg-yellow-100 text-yellow-800' },
  submitted: { icon: '🟢', label: 'Submitted', color: 'bg-green-100 text-green-800' },
  timed_out: { icon: '🔴', label: 'Timed Out', color: 'bg-red-100 text-red-800' },
  left: { icon: '⚫', label: 'Left', color: 'bg-gray-100 text-gray-800' },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveMonitoring() {
  const [activeExams, setActiveExams] = useState<ActiveExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadExams = useCallback(async () => {
    try {
      const response = await fetch('/api/teacher/monitoring', { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        const mapped = (result.exams || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          mode: e.mode,
          time_limit: e.time_limit,
          total_points: e.total_points,
          subject_name: e.subject?.name || '',
          stream_name: e.stream?.name || '',
          started_at: e.created_at,
        }));
        setActiveExams(mapped);
        if (mapped.length > 0 && !selectedExam) {
          setSelectedExam(mapped[0].id);
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedExam]);

  const loadSessions = useCallback(async () => {
    if (!selectedExam) return;
    setRefreshing(true);

    try {
      const response = await fetch(`/api/teacher/monitoring?examId=${selectedExam}`, { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        setSessions(result.sessions || []);
      } else {
        setSessions([]);
      }
    } catch {
      setSessions([]);
    }
    setRefreshing(false);
  }, [selectedExam]);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Realtime subscription for exam_sessions
  useEffect(() => {
    if (!selectedExam) return;
    const supabase = createClient();

    const channel = supabase
      .channel('exam-monitor')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'exam_sessions', filter: `assignment_id=eq.${selectedExam}` },
        () => { loadSessions(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedExam, loadSessions]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(loadSessions, 15000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  if (loading) return <PageLoading />;

  const inProgress = sessions.filter(s => s.status === 'in_progress').length;
  const submitted = sessions.filter(s => s.status === 'submitted').length;
  const timedOut = sessions.filter(s => s.status === 'timed_out').length;
  const total = sessions.length;
  const exam = activeExams.find(e => e.id === selectedExam);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">📡 Live Exam Monitor</h1>
        <button onClick={loadSessions} disabled={refreshing}
          className="btn-secondary text-sm flex items-center gap-1">
          {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {activeExams.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">📡</p>
          <p className="text-gray-500">No active exams to monitor.</p>
          <p className="text-sm text-gray-400 mt-1">Publish and start an exam from the Assignments page.</p>
        </div>
      ) : (
        <>
          {/* Exam selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {activeExams.map(e => (
              <button key={e.id}
                onClick={() => setSelectedExam(e.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  selectedExam === e.id
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                style={selectedExam === e.id ? { backgroundColor: 'rgb(var(--color-primary))' } : {}}>
                {e.title}
              </button>
            ))}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card text-center py-4">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-gray-500">Total Students</p>
            </div>
            <div className="card text-center py-4 border-yellow-200 bg-yellow-50">
              <p className="text-2xl font-bold text-yellow-700">{inProgress}</p>
              <p className="text-xs text-yellow-600">🟡 In Exam</p>
            </div>
            <div className="card text-center py-4 border-green-200 bg-green-50">
              <p className="text-2xl font-bold text-green-700">{submitted}</p>
              <p className="text-xs text-green-600">🟢 Submitted</p>
            </div>
            <div className="card text-center py-4 border-red-200 bg-red-50">
              <p className="text-2xl font-bold text-red-700">{timedOut}</p>
              <p className="text-xs text-red-600">🔴 Timed Out</p>
            </div>
          </div>

          {/* Exam info */}
          {exam && (
            <div className="card bg-gray-50 flex flex-wrap gap-4 text-sm text-gray-600">
              <span>📚 {exam.subject_name}</span>
              <span>🏫 {exam.stream_name}</span>
              {exam.time_limit && <span>⏱️ {exam.time_limit} min</span>}
              {exam.total_points && <span>🎯 {exam.total_points} pts</span>}
            </div>
          )}

          {/* Live table */}
          {sessions.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-400">No students have started this exam yet.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Student</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Adm No.</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Time Left</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Last Activity</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map(s => {
                    const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.in_progress;
                    const inactive = s.status === 'in_progress' &&
                      (Date.now() - new Date(s.last_activity).getTime()) > 120000; // >2 min inactive

                    return (
                      <tr key={s.id} className={inactive ? 'bg-orange-50' : ''}>
                        <td className="py-3 px-4 font-medium">{s.student_name}</td>
                        <td className="py-3 px-4 text-gray-500">{s.admission_number}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                            {config.icon} {config.label}
                            {inactive && <span title="Inactive >2 min">⚠️</span>}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-500">
                          {s.status === 'in_progress' && s.time_remaining != null
                            ? `${Math.floor(s.time_remaining / 60)}:${(s.time_remaining % 60).toString().padStart(2, '0')}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-400 text-xs">
                          {timeAgo(s.last_activity)}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {s.score != null ? `${s.score}/${exam?.total_points || '?'}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
