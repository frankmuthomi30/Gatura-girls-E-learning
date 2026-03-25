'use client';

import { useEffect, useState } from 'react';
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

  const letterheadCSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
    body { font-family: 'Times New Roman', 'Segoe UI', serif; color: #1a1a1a; font-size: 11pt; line-height: 1.4; }

    .page { page-break-after: always; padding: 0; }
    .page:last-child { page-break-after: avoid; }

    /* ── LETTERHEAD ── */
    .letterhead { text-align: center; padding-bottom: 12px; margin-bottom: 16px; position: relative; }
    .letterhead::after { content: ''; display: block; height: 3px; background: linear-gradient(90deg, #065f46, #059669, #10b981, #059669, #065f46); margin-top: 12px; border-radius: 2px; }
    .school-crest { width: 70px; height: 70px; margin: 0 auto 8px; }
    .school-crest img { width: 100%; height: 100%; object-fit: contain; }
    .school-name { font-size: 22pt; font-weight: bold; color: #065f46; letter-spacing: 1.5px; text-transform: uppercase; font-family: 'Times New Roman', serif; }
    .school-motto { font-size: 9pt; color: #666; font-style: italic; margin-top: 2px; letter-spacing: 0.5px; }
    .school-address { font-size: 8.5pt; color: #555; margin-top: 4px; }
    .school-address span { margin: 0 8px; }

    /* ── DOCUMENT TITLE ── */
    .doc-title-block { text-align: center; margin: 16px 0; }
    .doc-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #1a1a1a; padding: 6px 0; border-top: 1.5px solid #333; border-bottom: 1.5px solid #333; display: inline-block; }
    .doc-ref { font-size: 8pt; color: #888; margin-top: 6px; }

    /* ── SESSION INFO ── */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 14px 0; font-size: 10pt; }
    .info-grid .label { color: #555; font-weight: normal; }
    .info-grid .value { font-weight: 600; color: #1a1a1a; }
    .info-row { display: flex; gap: 4px; }

    /* ── TABLE ── */
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 9.5pt; }
    th { background: #065f46; color: white; padding: 7px 10px; text-align: left; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e5e5; }
    tr:nth-child(even) td { background: #f9fafb; }
    tr:hover td { background: #f0fdf4; }

    /* ── SUMMARY BOX ── */
    .summary-box { display: flex; justify-content: space-around; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin: 14px 0; text-align: center; }
    .summary-item .num { font-size: 18pt; font-weight: bold; color: #065f46; }
    .summary-item .lbl { font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── FOOTER ── */
    .doc-footer { margin-top: 30px; padding-top: 16px; border-top: 1.5px solid #ddd; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .sig-block { text-align: center; width: 200px; }
    .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 9pt; color: #555; }
    .stamp-area { text-align: center; margin-top: 20px; font-size: 8pt; color: #999; font-style: italic; }
    .print-date { font-size: 8pt; color: #999; text-align: right; margin-top: 8px; }
    .no-data { text-align: center; padding: 20px; color: #999; font-style: italic; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { page-break-after: always; }
    }
  `;

  const generateLetterhead = () => {
    return `
      <div class="letterhead">
        <div class="school-crest">
          <img src="/icons/icon-192.svg" alt="School Crest" onerror="this.style.display='none'" />
        </div>
        <div class="school-name">Gatura Girls&rsquo; Secondary School</div>
        <div class="school-motto">&ldquo;Education for Excellence&rdquo;</div>
        <div class="school-address">
          <span>P.O. Box 82 &mdash; Gatura</span>
          <span>|</span>
          <span>Murang&rsquo;a County, Kenya</span>
          <span>|</span>
          <span>E-Learning Platform</span>
        </div>
      </div>
    `;
  };

  const generateDocRef = (type: string) => {
    const now = new Date();
    const ref = `GGS/${type}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    return ref;
  };

  const printSingleSession = (sessionId: string) => {
    const session = liveData.find(s => s.id === sessionId);
    if (!session) return;
    printLiveDocument([session]);
  };

  const printSingleExam = (examId: string) => {
    const exam = examData.find(e => e.id === examId);
    if (!exam) return;
    printExamDocument([exam]);
  };

  const printSingleAssignment = (assignmentId: string) => {
    const assignment = assignmentData.find(a => a.id === assignmentId);
    if (!assignment) return;
    printAssignmentDocument([assignment]);
  };

  const printLiveDocument = (sessions: LiveReport[]) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const pages = sessions.map((session, idx) => `
      <div class="page">
        ${generateLetterhead()}
        <div class="doc-title-block">
          <div class="doc-title">Live Class Attendance Register</div>
          <div class="doc-ref">Ref: ${generateDocRef('LCA')}-${idx+1}</div>
        </div>
        <div class="info-grid">
          <div class="info-row"><span class="label">Class Title:</span> <span class="value">${session.title}</span></div>
          <div class="info-row"><span class="label">Date:</span> <span class="value">${formatDate(session.started_at)}</span></div>
          <div class="info-row"><span class="label">Subject:</span> <span class="value">${session.subject?.name || 'General'}</span></div>
          <div class="info-row"><span class="label">Duration:</span> <span class="value">${formatDuration(session.started_at, session.ended_at)}</span></div>
          <div class="info-row"><span class="label">Stream:</span> <span class="value">${session.stream?.name || 'All Streams'}</span></div>
          <div class="info-row"><span class="label">Status:</span> <span class="value">${session.status === 'live' ? 'In Progress' : 'Completed'}</span></div>
        </div>
        <div class="summary-box">
          <div class="summary-item"><div class="num">${session.attendanceCount}</div><div class="lbl">Students Present</div></div>
        </div>
        ${session.attendance.length > 0 ? `
          <table>
            <thead>
              <tr><th>No.</th><th>Student Name</th><th>Adm. Number</th><th>Stream</th><th>Form</th><th>Time Joined</th></tr>
            </thead>
            <tbody>
              ${session.attendance.map((a, i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${a.student?.full_name || 'Unknown'}</td>
                  <td>${a.student?.admission_number || '-'}</td>
                  <td>${a.student?.stream || '-'}</td>
                  <td>Form ${a.student?.grade ? a.student.grade - 9 : '-'}</td>
                  <td>${formatDate(a.joined_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="no-data">No attendance records for this session</p>'}
        <div class="doc-footer">
          <div class="signatures">
            <div class="sig-block"><div class="sig-line">Teacher&rsquo;s Signature</div></div>
            <div class="sig-block"><div class="sig-line">Head of Department</div></div>
          </div>
          <div class="stamp-area">Official School Stamp</div>
          <div class="print-date">Printed: ${new Date().toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}</div>
        </div>
      </div>
    `).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>GGS - Live Attendance Report</title><style>${letterheadCSS}</style></head><body>${pages}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const printExamDocument = (exams: ExamReport[]) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const pages = exams.map((exam, idx) => `
      <div class="page">
        ${generateLetterhead()}
        <div class="doc-title-block">
          <div class="doc-title">Examination Attendance Report</div>
          <div class="doc-ref">Ref: ${generateDocRef('EAR')}-${idx+1}</div>
        </div>
        <div class="info-grid">
          <div class="info-row"><span class="label">Exam Title:</span> <span class="value">${exam.title}</span></div>
          <div class="info-row"><span class="label">Created:</span> <span class="value">${formatDate(exam.created_at)}</span></div>
          <div class="info-row"><span class="label">Subject:</span> <span class="value">${exam.subject?.name || 'General'}</span></div>
          <div class="info-row"><span class="label">Mode:</span> <span class="value">${exam.mode.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Stream:</span> <span class="value">${exam.stream?.name || 'All Streams'}</span></div>
          <div class="info-row"><span class="label">Due Date:</span> <span class="value">${exam.due_date ? formatDate(exam.due_date) : 'N/A'}</span></div>
        </div>
        <div class="summary-box">
          <div class="summary-item"><div class="num">${exam.totalAttempts}</div><div class="lbl">Total Attempts</div></div>
          <div class="summary-item"><div class="num">${exam.submitted}</div><div class="lbl">Submitted</div></div>
          <div class="summary-item"><div class="num">${exam.totalAttempts - exam.submitted}</div><div class="lbl">Incomplete</div></div>
        </div>
        ${exam.examSessions.length > 0 ? `
          <table>
            <thead>
              <tr><th>No.</th><th>Student Name</th><th>Adm. Number</th><th>Stream</th><th>Status</th><th>Score</th><th>Date</th></tr>
            </thead>
            <tbody>
              ${exam.examSessions.map((es, i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${es.student?.full_name || 'Unknown'}</td>
                  <td>${es.student?.admission_number || '-'}</td>
                  <td>${es.student?.stream || '-'}</td>
                  <td>${es.status === 'submitted' ? 'Submitted' : es.status === 'in_progress' ? 'In Progress' : es.status === 'timed_out' ? 'Timed Out' : es.status}</td>
                  <td>${es.score !== null && es.total_points ? es.score + '/' + es.total_points : '-'}</td>
                  <td>${formatDate(es.started_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="no-data">No exam attempts recorded</p>'}
        <div class="doc-footer">
          <div class="signatures">
            <div class="sig-block"><div class="sig-line">Subject Teacher</div></div>
            <div class="sig-block"><div class="sig-line">Examinations Office</div></div>
          </div>
          <div class="stamp-area">Official School Stamp</div>
          <div class="print-date">Printed: ${new Date().toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}</div>
        </div>
      </div>
    `).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>GGS - Exam Attendance Report</title><style>${letterheadCSS}</style></head><body>${pages}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const printAssignmentDocument = (assignments: AssignmentReport[]) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const pages = assignments.map((a, idx) => `
      <div class="page">
        ${generateLetterhead()}
        <div class="doc-title-block">
          <div class="doc-title">Assignment Submission Report</div>
          <div class="doc-ref">Ref: ${generateDocRef('ASR')}-${idx+1}</div>
        </div>
        <div class="info-grid">
          <div class="info-row"><span class="label">Assignment:</span> <span class="value">${a.title}</span></div>
          <div class="info-row"><span class="label">Created:</span> <span class="value">${formatDate(a.created_at)}</span></div>
          <div class="info-row"><span class="label">Subject:</span> <span class="value">${a.subject?.name || 'General'}</span></div>
          <div class="info-row"><span class="label">Type:</span> <span class="value">${a.mode.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Stream:</span> <span class="value">${a.stream?.name || 'All Streams'}</span></div>
          <div class="info-row"><span class="label">Due Date:</span> <span class="value">${a.due_date ? formatDate(a.due_date) : 'N/A'}</span></div>
        </div>
        <div class="summary-box">
          <div class="summary-item"><div class="num">${a.totalSubmissions}</div><div class="lbl">Submitted</div></div>
          <div class="summary-item"><div class="num">${a.graded}</div><div class="lbl">Graded</div></div>
          <div class="summary-item"><div class="num">${a.totalSubmissions - a.graded}</div><div class="lbl">Ungraded</div></div>
        </div>
        ${a.submissions.length > 0 ? `
          <table>
            <thead>
              <tr><th>No.</th><th>Student Name</th><th>Adm. Number</th><th>Stream</th><th>Submitted</th><th>Grade</th><th>Graded On</th></tr>
            </thead>
            <tbody>
              ${a.submissions.map((sub, i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${sub.student?.full_name || 'Unknown'}</td>
                  <td>${sub.student?.admission_number || '-'}</td>
                  <td>${sub.student?.stream || '-'}</td>
                  <td>${formatDate(sub.submitted_at)}</td>
                  <td>${sub.grade || '-'}</td>
                  <td>${sub.graded_at ? formatDate(sub.graded_at) : 'Pending'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="no-data">No submissions received</p>'}
        <div class="doc-footer">
          <div class="signatures">
            <div class="sig-block"><div class="sig-line">Subject Teacher</div></div>
            <div class="sig-block"><div class="sig-line">Head of Department</div></div>
          </div>
          <div class="stamp-area">Official School Stamp</div>
          <div class="print-date">Printed: ${new Date().toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}</div>
        </div>
      </div>
    `).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>GGS - Assignment Submission Report</title><style>${letterheadCSS}</style></head><body>${pages}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const handlePrint = () => {
    if (tab === 'live') printLiveDocument(liveData);
    if (tab === 'exams') printExamDocument(examData);
    if (tab === 'assignments') printAssignmentDocument(assignmentData);
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
          {tab === 'live' && <LiveClassReport data={liveData} expandedId={expandedId} setExpandedId={setExpandedId} onPrintSingle={printSingleSession} />}
          {tab === 'exams' && <ExamReportView data={examData} expandedId={expandedId} setExpandedId={setExpandedId} onPrintSingle={printSingleExam} />}
          {tab === 'assignments' && <AssignmentSubmissionReport data={assignmentData} expandedId={expandedId} setExpandedId={setExpandedId} onPrintSingle={printSingleAssignment} />}
        </>
      )}
    </div>
  );
}

/* ─────────────── LIVE CLASS ATTENDANCE ─────────────── */

function LiveClassReport({ data, expandedId, setExpandedId, onPrintSingle }: { data: LiveReport[]; expandedId: string | null; setExpandedId: (id: string | null) => void; onPrintSingle: (id: string) => void }) {
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

            {expandedId === session.id && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex justify-end mb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onPrintSingle(session.id); }}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    🖨️ Print This Report
                  </button>
                </div>
                {session.attendance.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-gray-400">No students recorded attendance for this session.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── EXAM ATTENDANCE ─────────────── */

function ExamReportView({ data, expandedId, setExpandedId, onPrintSingle }: { data: ExamReport[]; expandedId: string | null; setExpandedId: (id: string | null) => void; onPrintSingle: (id: string) => void }) {
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

            {expandedId === exam.id && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex justify-end mb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onPrintSingle(exam.id); }}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    🖨️ Print This Report
                  </button>
                </div>
                {exam.examSessions.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-gray-400">No students have attempted this exam yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── ASSIGNMENT SUBMISSIONS ─────────────── */

function AssignmentSubmissionReport({ data, expandedId, setExpandedId, onPrintSingle }: { data: AssignmentReport[]; expandedId: string | null; setExpandedId: (id: string | null) => void; onPrintSingle: (id: string) => void }) {
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

            {expandedId === assignment.id && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex justify-end mb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onPrintSingle(assignment.id); }}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    🖨️ Print This Report
                  </button>
                </div>
                {assignment.submissions.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-gray-400">No submissions yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
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
