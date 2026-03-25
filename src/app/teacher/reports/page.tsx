'use client';

import { useEffect, useState } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { StreamName } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // ── PDF HELPERS ──

  const GREEN: [number, number, number] = [6, 95, 70]; // #065f46
  const LIGHT_GREEN: [number, number, number] = [240, 253, 244];
  const GRAY: [number, number, number] = [100, 100, 100];

  const generateDocRef = (type: string) => {
    const now = new Date();
    return `GGS/${type}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  };

  const addLetterhead = (doc: jsPDF, startY: number = 15): number => {
    const pageW = doc.internal.pageSize.getWidth();
    const cx = pageW / 2;

    // School crest placeholder (green rounded rect with "GG")
    doc.setFillColor(...GREEN);
    doc.roundedRect(cx - 12, startY, 24, 24, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GG', cx, startY + 15.5, { align: 'center' });

    // School name
    let y = startY + 30;
    doc.setTextColor(...GREEN);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("GATURA GIRLS' SECONDARY SCHOOL", cx, y, { align: 'center' });

    // Motto
    y += 6;
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('"Education for Excellence"', cx, y, { align: 'center' });

    // Address
    y += 5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('P.O. Box 82 — Gatura  |  Murang\'a County, Kenya  |  E-Learning Platform', cx, y, { align: 'center' });

    // Green decorative line
    y += 4;
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(1);
    doc.line(20, y, pageW - 20, y);

    return y + 6;
  };

  const addDocTitle = (doc: jsPDF, title: string, ref: string, y: number): number => {
    const cx = doc.internal.pageSize.getWidth() / 2;

    // Title with lines
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.4);
    doc.line(50, y, doc.internal.pageSize.getWidth() - 50, y);
    y += 6;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), cx, y, { align: 'center' });
    y += 3;
    doc.line(50, y, doc.internal.pageSize.getWidth() - 50, y);

    // Ref
    y += 5;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${ref}`, cx, y, { align: 'center' });

    return y + 6;
  };

  const addInfoGrid = (doc: jsPDF, items: [string, string][], y: number): number => {
    doc.setFontSize(9);
    const colW = 85;
    const startX = 22;

    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * colW;
      const yPos = y + row * 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(`${item[0]}:`, x, yPos);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(item[1], x + 28, yPos);
    });

    return y + Math.ceil(items.length / 2) * 6 + 4;
  };

  const addSummaryBoxes = (doc: jsPDF, items: { num: number; label: string }[], y: number): number => {
    const pageW = doc.internal.pageSize.getWidth();
    const boxW = (pageW - 44) / items.length;

    doc.setFillColor(...LIGHT_GREEN);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(20, y, pageW - 40, 18, 3, 3, 'FD');

    items.forEach((item, i) => {
      const cx = 20 + boxW * i + boxW / 2;
      doc.setTextColor(...GREEN);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.num), cx, y + 9, { align: 'center' });

      doc.setTextColor(...GRAY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label.toUpperCase(), cx, y + 14, { align: 'center' });
    });

    return y + 24;
  };

  const addFooter = (doc: jsPDF, leftLabel: string, rightLabel: string) => {
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    let y = pageH - 42;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(20, y, pageW - 20, y);
    y += 18;

    // Signature lines
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.3);
    doc.line(30, y, 90, y);
    doc.line(pageW - 90, y, pageW - 30, y);

    y += 4;
    doc.setTextColor(...GRAY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(leftLabel, 60, y, { align: 'center' });
    doc.text(rightLabel, pageW - 60, y, { align: 'center' });

    // Stamp area
    y += 10;
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Official School Stamp', pageW / 2, y, { align: 'center' });

    // Print date
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(6.5);
    doc.text(`Printed: ${new Date().toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}`, pageW - 20, pageH - 10, { align: 'right' });
  };

  // ── PDF DOCUMENT GENERATORS ──

  const printLiveDocument = (sessions: LiveReport[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    sessions.forEach((session, idx) => {
      if (idx > 0) doc.addPage();

      let y = addLetterhead(doc);
      y = addDocTitle(doc, 'Live Class Attendance Register', `${generateDocRef('LCA')}-${idx + 1}`, y);
      y = addInfoGrid(doc, [
        ['Class Title', session.title],
        ['Date', formatDate(session.started_at)],
        ['Subject', session.subject?.name || 'General'],
        ['Duration', formatDuration(session.started_at, session.ended_at)],
        ['Stream', session.stream?.name || 'All Streams'],
        ['Status', session.status === 'live' ? 'In Progress' : 'Completed'],
      ], y);
      y = addSummaryBoxes(doc, [{ num: session.attendanceCount, label: 'Students Present' }], y);

      if (session.attendance.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['No.', 'Student Name', 'Adm. Number', 'Stream', 'Form', 'Time Joined']],
          body: session.attendance.map((a, i) => [
            i + 1,
            a.student?.full_name || 'Unknown',
            a.student?.admission_number || '-',
            a.student?.stream || '-',
            a.student?.grade ? `Form ${a.student.grade - 9}` : '-',
            formatDate(a.joined_at),
          ]),
          theme: 'grid',
          headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 20, right: 20 },
          styles: { cellPadding: 2.5 },
        });
      } else {
        doc.setTextColor(...GRAY);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('No attendance records for this session', doc.internal.pageSize.getWidth() / 2, y + 8, { align: 'center' });
      }

      addFooter(doc, "Teacher's Signature", 'Head of Department');
    });

    doc.save(`GGS_Live_Attendance_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const printExamDocument = (exams: ExamReport[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    exams.forEach((exam, idx) => {
      if (idx > 0) doc.addPage();

      let y = addLetterhead(doc);
      y = addDocTitle(doc, 'Examination Attendance Report', `${generateDocRef('EAR')}-${idx + 1}`, y);
      y = addInfoGrid(doc, [
        ['Exam Title', exam.title],
        ['Created', formatDate(exam.created_at)],
        ['Subject', exam.subject?.name || 'General'],
        ['Mode', exam.mode.toUpperCase()],
        ['Stream', exam.stream?.name || 'All Streams'],
        ['Due Date', exam.due_date ? formatDate(exam.due_date) : 'N/A'],
      ], y);
      y = addSummaryBoxes(doc, [
        { num: exam.totalAttempts, label: 'Total Attempts' },
        { num: exam.submitted, label: 'Submitted' },
        { num: exam.totalAttempts - exam.submitted, label: 'Incomplete' },
      ], y);

      if (exam.examSessions.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['No.', 'Student Name', 'Adm. Number', 'Stream', 'Status', 'Score', 'Date']],
          body: exam.examSessions.map((es, i) => [
            i + 1,
            es.student?.full_name || 'Unknown',
            es.student?.admission_number || '-',
            es.student?.stream || '-',
            es.status === 'submitted' ? 'Submitted' : es.status === 'in_progress' ? 'In Progress' : es.status === 'timed_out' ? 'Timed Out' : es.status,
            es.score !== null && es.total_points ? `${es.score}/${es.total_points}` : '-',
            formatDate(es.started_at),
          ]),
          theme: 'grid',
          headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 20, right: 20 },
          styles: { cellPadding: 2.5 },
        });
      } else {
        doc.setTextColor(...GRAY);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('No exam attempts recorded', doc.internal.pageSize.getWidth() / 2, y + 8, { align: 'center' });
      }

      addFooter(doc, 'Subject Teacher', 'Examinations Office');
    });

    doc.save(`GGS_Exam_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const printAssignmentDocument = (assignments: AssignmentReport[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    assignments.forEach((a, idx) => {
      if (idx > 0) doc.addPage();

      let y = addLetterhead(doc);
      y = addDocTitle(doc, 'Assignment Submission Report', `${generateDocRef('ASR')}-${idx + 1}`, y);
      y = addInfoGrid(doc, [
        ['Assignment', a.title],
        ['Created', formatDate(a.created_at)],
        ['Subject', a.subject?.name || 'General'],
        ['Type', a.mode.toUpperCase()],
        ['Stream', a.stream?.name || 'All Streams'],
        ['Due Date', a.due_date ? formatDate(a.due_date) : 'N/A'],
      ], y);
      y = addSummaryBoxes(doc, [
        { num: a.totalSubmissions, label: 'Submitted' },
        { num: a.graded, label: 'Graded' },
        { num: a.totalSubmissions - a.graded, label: 'Ungraded' },
      ], y);

      if (a.submissions.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['No.', 'Student Name', 'Adm. Number', 'Stream', 'Submitted', 'Grade', 'Graded On']],
          body: a.submissions.map((sub, i) => [
            i + 1,
            sub.student?.full_name || 'Unknown',
            sub.student?.admission_number || '-',
            sub.student?.stream || '-',
            formatDate(sub.submitted_at),
            sub.grade || '-',
            sub.graded_at ? formatDate(sub.graded_at) : 'Pending',
          ]),
          theme: 'grid',
          headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 20, right: 20 },
          styles: { cellPadding: 2.5 },
        });
      } else {
        doc.setTextColor(...GRAY);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('No submissions received', doc.internal.pageSize.getWidth() / 2, y + 8, { align: 'center' });
      }

      addFooter(doc, 'Subject Teacher', 'Head of Department');
    });

    doc.save(`GGS_Assignment_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const printSingleSession = (sessionId: string) => {
    const session = liveData.find(s => s.id === sessionId);
    if (session) printLiveDocument([session]);
  };

  const printSingleExam = (examId: string) => {
    const exam = examData.find(e => e.id === examId);
    if (exam) printExamDocument([exam]);
  };

  const printSingleAssignment = (assignmentId: string) => {
    const assignment = assignmentData.find(a => a.id === assignmentId);
    if (assignment) printAssignmentDocument([assignment]);
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
          🖨️ Download PDF
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
