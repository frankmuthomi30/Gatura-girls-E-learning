'use client';

import { useEffect, useState, useRef } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { StreamName } from '@/lib/types';

type Tab = 'live' | 'exams' | 'assignments';

interface AttendanceRecord {
  session_id: string;
  joined_at: string;
  student: { full_name: string; admission_number: string; stream: string; grade: number };
}

interface LiveReport {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  subject?: { name: string };
  stream?: { name: string };
  attendance: AttendanceRecord[];
  attendanceCount: number;
}

interface ExamSession {
  assignment_id: string;
  status: string;
  score: number | null;
  total_points: number | null;
  started_at: string;
  ended_at: string | null;
  student: { full_name: string; admission_number: string; stream: string; grade: number };
}

interface ExamReport {
  id: string;
  title: string;
  mode: string;
  status: string;
  due_date: string | null;
  created_at: string;
  subject?: { name: string };
  stream?: { name: string };
  examSessions: ExamSession[];
  totalAttempts: number;
  submitted: number;
}

interface Submission {
  assignment_id: string;
  submitted_at: string;
  grade: string | null;
  graded_at: string | null;
  student: { full_name: string; admission_number: string; stream: string; grade: number };
}

interface AssignmentReport {
  id: string;
  title: string;
  mode: string;
  status: string;
  due_date: string | null;
  created_at: string;
  subject?: { name: string };
  stream?: { name: string };
  submissions: Submission[];
  totalSubmissions: number;
  graded: number;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start: string, end?: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function TeacherReports() {
  const [tab, setTab] = useState<Tab>('live');
  const [loading, setLoading] = useState(true);
  const [liveData, setLiveData] = useState<LiveReport[]>([]);
  const [examData, setExamData] = useState<ExamReport[]>([]);
  const [assignmentData, setAssignmentData] = useState<AssignmentReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const loadReport = async (type: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/reports?type=${type}`, { cache: 'no-store' });
      if (res.ok) {
        const result = await res.json();
        if (type === 'live') setLiveData(result.sessions || []);
        if (type === 'exams') setExamData(result.assignments || []);
        if (type === 'assignments') setAssignmentData(result.assignments || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadReport(tab); }, [tab]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GGS E-Learning - Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .header h1 { font-size: 20px; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #666; }
          .session-title { font-size: 16px; font-weight: bold; margin: 20px 0 8px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
          .meta { font-size: 11px; color: #666; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
          th { background: #f0f0f0; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          .summary { font-size: 12px; margin-bottom: 8px; color: #555; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Gatura Girls E-Learning Platform</h1>
          <p>${tab === 'live' ? 'Live Class Attendance Report' : tab === 'exams' ? 'Exam Attendance Report' : 'Assignment Submission Report'}</p>
          <p>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        ${content.innerHTML}
        <div class="footer">Printed from GGS E-Learning Platform</div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'live', label: 'Live Class Attendance', icon: '🎥' },
    { key: 'exams', label: 'Exam Attendance', icon: '📝' },
    { key: 'assignments', label: 'Assignment Submissions', icon: '📋' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">📊 Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Attendance and submission reports with printout
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={loading}
          className="btn-primary px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 print:hidden"
        >
          🖨️ Print Report
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpandedId(null); }}
            className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.key
                ? 'bg-white dark:bg-gray-800 shadow-sm text-primary font-semibold'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card py-12 text-center"><LoadingSpinner /> Loading report...</div>
      ) : (
        <>
          {/* Visible report content */}
          {tab === 'live' && <LiveClassReport data={liveData} expandedId={expandedId} setExpandedId={setExpandedId} />}
          {tab === 'exams' && <ExamReport data={examData} expandedId={expandedId} setExpandedId={setExpandedId} />}
          {tab === 'assignments' && <AssignmentSubmissionReport data={assignmentData} expandedId={expandedId} setExpandedId={setExpandedId} />}

          {/* Hidden printable content */}
          <div className="hidden">
            <div ref={printRef}>
              {tab === 'live' && <LiveClassPrint data={liveData} />}
              {tab === 'exams' && <ExamPrint data={examData} />}
              {tab === 'assignments' && <AssignmentPrint data={assignmentData} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────── LIVE CLASS ATTENDANCE ─────────────── */

function LiveClassReport({ data, expandedId, setExpandedId }: { data: LiveReport[]; expandedId: string | null; setExpandedId: (id: string | null) => void }) {
  if (data.length === 0) return <EmptyState text="No live class sessions found" />;

  const totalAttendance = data.reduce((sum, s) => sum + s.attendanceCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total Sessions" value={data.length} icon="🎥" />
        <StatCard label="Total Attendance" value={totalAttendance} icon="👥" />
        <StatCard label="Avg per Session" value={data.length > 0 ? Math.round(totalAttendance / data.length) : 0} icon="📊" />
      </div>

      <div className="space-y-2">
        {data.map(session => (
          <div key={session.id} className="card overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              className="w-full flex items-center justify-between py-1 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                  session.status === 'live' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {session.status === 'live' ? '🔴' : '📹'}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{session.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>{formatDate(session.started_at)}</span>
                    <span>•</span>
                    <span>{formatDuration(session.started_at, session.ended_at)}</span>
                    {session.subject?.name && <><span>•</span><span>{session.subject.name}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {session.attendanceCount} students
                </span>
                <span className={`transition-transform ${expandedId === session.id ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {expandedId === session.id && session.attendance.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Student Name</th>
                        <th className="pb-2 pr-4">Adm No.</th>
                        <th className="pb-2 pr-4">Stream</th>
                        <th className="pb-2">Joined At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.attendance.map((a, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                          <td className="py-2 pr-4 font-medium">{a.student?.full_name || 'Unknown'}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{a.student?.admission_number || '-'}</td>
                          <td className="py-2 pr-4">
                            {a.student?.stream ? <StreamBadge stream={a.student.stream as StreamName} /> : '-'}
                          </td>
                          <td className="py-2 text-xs text-gray-500">{formatDate(a.joined_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expandedId === session.id && session.attendance.length === 0 && (
              <p className="mt-3 text-sm text-gray-400 border-t border-border pt-3">No students recorded attendance for this session.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── EXAM ATTENDANCE ─────────────── */

function ExamReport({ data, expandedId, setExpandedId }: { data: ExamReport[]; expandedId: string | null; setExpandedId: (id: string | null) => void }) {
  if (data.length === 0) return <EmptyState text="No exams found" />;

  const totalAttempts = data.reduce((sum, a) => sum + a.totalAttempts, 0);
  const totalSubmitted = data.reduce((sum, a) => sum + a.submitted, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total Exams" value={data.length} icon="📝" />
        <StatCard label="Total Attempts" value={totalAttempts} icon="👥" />
        <StatCard label="Submitted" value={totalSubmitted} icon="✅" />
      </div>

      <div className="space-y-2">
        {data.map(exam => (
          <div key={exam.id} className="card overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === exam.id ? null : exam.id)}
              className="w-full flex items-center justify-between py-1 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg flex-shrink-0">
                  📝
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{exam.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="uppercase font-mono">{exam.mode}</span>
                    {exam.subject?.name && <><span>•</span><span>{exam.subject.name}</span></>}
                    <span>•</span>
                    <span>{formatDate(exam.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {exam.totalAttempts} attempts
                </span>
                <span className={`transition-transform ${expandedId === exam.id ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {expandedId === exam.id && exam.examSessions.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Student Name</th>
                        <th className="pb-2 pr-4">Adm No.</th>
                        <th className="pb-2 pr-4">Stream</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Score</th>
                        <th className="pb-2">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exam.examSessions.map((es, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                          <td className="py-2 pr-4 font-medium">{es.student?.full_name || 'Unknown'}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{es.student?.admission_number || '-'}</td>
                          <td className="py-2 pr-4">
                            {es.student?.stream ? <StreamBadge stream={es.student.stream as StreamName} /> : '-'}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              es.status === 'submitted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                              es.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {es.status === 'submitted' ? 'Submitted' : es.status === 'in_progress' ? 'In Progress' : es.status === 'timed_out' ? 'Timed Out' : es.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {es.score !== null && es.total_points ? `${es.score}/${es.total_points}` : '-'}
                          </td>
                          <td className="py-2 text-xs text-gray-500">{formatDate(es.started_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expandedId === exam.id && exam.examSessions.length === 0 && (
              <p className="mt-3 text-sm text-gray-400 border-t border-border pt-3">No students have attempted this exam yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── ASSIGNMENT SUBMISSIONS ─────────────── */

function AssignmentSubmissionReport({ data, expandedId, setExpandedId }: { data: AssignmentReport[]; expandedId: string | null; setExpandedId: (id: string | null) => void }) {
  if (data.length === 0) return <EmptyState text="No assignments found" />;

  const totalSubs = data.reduce((sum, a) => sum + a.totalSubmissions, 0);
  const totalGraded = data.reduce((sum, a) => sum + a.graded, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total Assignments" value={data.length} icon="📋" />
        <StatCard label="Total Submissions" value={totalSubs} icon="📤" />
        <StatCard label="Graded" value={totalGraded} icon="✅" />
      </div>

      <div className="space-y-2">
        {data.map(assignment => (
          <div key={assignment.id} className="card overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
              className="w-full flex items-center justify-between py-1 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-lg flex-shrink-0">
                  📋
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{assignment.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="uppercase font-mono">{assignment.mode}</span>
                    {assignment.subject?.name && <><span>•</span><span>{assignment.subject.name}</span></>}
                    {assignment.due_date && <><span>•</span><span>Due: {formatDate(assignment.due_date)}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  {assignment.totalSubmissions} submitted
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {assignment.graded} graded
                </span>
                <span className={`transition-transform ${expandedId === assignment.id ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {expandedId === assignment.id && assignment.submissions.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Student Name</th>
                        <th className="pb-2 pr-4">Adm No.</th>
                        <th className="pb-2 pr-4">Stream</th>
                        <th className="pb-2 pr-4">Submitted</th>
                        <th className="pb-2 pr-4">Grade</th>
                        <th className="pb-2">Graded At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignment.submissions.map((sub, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                          <td className="py-2 pr-4 font-medium">{sub.student?.full_name || 'Unknown'}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{sub.student?.admission_number || '-'}</td>
                          <td className="py-2 pr-4">
                            {sub.student?.stream ? <StreamBadge stream={sub.student.stream as StreamName} /> : '-'}
                          </td>
                          <td className="py-2 pr-4 text-xs text-gray-500">{formatDate(sub.submitted_at)}</td>
                          <td className="py-2 pr-4 font-semibold">{sub.grade || '-'}</td>
                          <td className="py-2 text-xs text-gray-500">{sub.graded_at ? formatDate(sub.graded_at) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expandedId === assignment.id && assignment.submissions.length === 0 && (
              <p className="mt-3 text-sm text-gray-400 border-t border-border pt-3">No submissions yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── PRINT TEMPLATES ─────────────── */

function LiveClassPrint({ data }: { data: LiveReport[] }) {
  return (
    <div>
      {data.map(session => (
        <div key={session.id}>
          <div className="session-title">{session.title}</div>
          <div className="meta">
            Date: {formatDate(session.started_at)} | Duration: {formatDuration(session.started_at, session.ended_at)}
            {session.subject?.name ? ` | Subject: ${session.subject.name}` : ''}
            {session.stream?.name ? ` | Stream: ${session.stream.name}` : ''}
            | Students: {session.attendanceCount}
          </div>
          {session.attendance.length > 0 ? (
            <table>
              <thead>
                <tr><th>#</th><th>Student Name</th><th>Adm No.</th><th>Stream</th><th>Grade</th><th>Joined At</th></tr>
              </thead>
              <tbody>
                {session.attendance.map((a, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{a.student?.full_name || 'Unknown'}</td>
                    <td>{a.student?.admission_number || '-'}</td>
                    <td>{a.student?.stream || '-'}</td>
                    <td>{a.student?.grade || '-'}</td>
                    <td>{formatDate(a.joined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="summary">No attendance recorded</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ExamPrint({ data }: { data: ExamReport[] }) {
  return (
    <div>
      {data.map(exam => (
        <div key={exam.id}>
          <div className="session-title">{exam.title} ({exam.mode.toUpperCase()})</div>
          <div className="meta">
            Created: {formatDate(exam.created_at)}
            {exam.subject?.name ? ` | Subject: ${exam.subject.name}` : ''}
            {exam.stream?.name ? ` | Stream: ${exam.stream.name}` : ''}
            | Attempts: {exam.totalAttempts} | Submitted: {exam.submitted}
          </div>
          {exam.examSessions.length > 0 ? (
            <table>
              <thead>
                <tr><th>#</th><th>Student Name</th><th>Adm No.</th><th>Stream</th><th>Status</th><th>Score</th><th>Started</th></tr>
              </thead>
              <tbody>
                {exam.examSessions.map((es, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{es.student?.full_name || 'Unknown'}</td>
                    <td>{es.student?.admission_number || '-'}</td>
                    <td>{es.student?.stream || '-'}</td>
                    <td>{es.status === 'submitted' ? 'Submitted' : es.status === 'in_progress' ? 'In Progress' : es.status === 'timed_out' ? 'Timed Out' : es.status}</td>
                    <td>{es.score !== null && es.total_points ? `${es.score}/${es.total_points}` : '-'}</td>
                    <td>{formatDate(es.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="summary">No attempts recorded</p>
          )}
        </div>
      ))}
    </div>
  );
}

function AssignmentPrint({ data }: { data: AssignmentReport[] }) {
  return (
    <div>
      {data.map(assignment => (
        <div key={assignment.id}>
          <div className="session-title">{assignment.title} ({assignment.mode.toUpperCase()})</div>
          <div className="meta">
            Created: {formatDate(assignment.created_at)}
            {assignment.subject?.name ? ` | Subject: ${assignment.subject.name}` : ''}
            {assignment.stream?.name ? ` | Stream: ${assignment.stream.name}` : ''}
            {assignment.due_date ? ` | Due: ${formatDate(assignment.due_date)}` : ''}
            | Submissions: {assignment.totalSubmissions} | Graded: {assignment.graded}
          </div>
          {assignment.submissions.length > 0 ? (
            <table>
              <thead>
                <tr><th>#</th><th>Student Name</th><th>Adm No.</th><th>Stream</th><th>Submitted</th><th>Grade</th><th>Graded At</th></tr>
              </thead>
              <tbody>
                {assignment.submissions.map((sub, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{sub.student?.full_name || 'Unknown'}</td>
                    <td>{sub.student?.admission_number || '-'}</td>
                    <td>{sub.student?.stream || '-'}</td>
                    <td>{formatDate(sub.submitted_at)}</td>
                    <td>{sub.grade || '-'}</td>
                    <td>{sub.graded_at ? formatDate(sub.graded_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="summary">No submissions recorded</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────── SHARED COMPONENTS ─────────────── */

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="card py-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card text-center py-12">
      <div className="text-5xl mb-4">📭</div>
      <p className="text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}
