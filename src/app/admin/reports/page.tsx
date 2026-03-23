'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { StreamName } from '@/lib/types';

interface ReportData {
  assignmentTitle: string;
  subjectName: string;
  streamName: string;
  totalStudents: number;
  submitted: number;
  graded: number;
  averageGrade: string;
}

export default function AdminReports() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title, subject:subjects(name), stream:streams(id, name)')
        .order('created_at', { ascending: false });

      const reportData: ReportData[] = [];

      for (const a of assignments || []) {
        const streamName = (a as any).stream?.name;
        const streamId = (a as any).stream?.id;

        // Count students in stream
        const { count: totalStudents } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student')
          .eq('stream', streamName);

        // Count submissions
        const { data: subs } = await supabase
          .from('submissions')
          .select('grade')
          .eq('assignment_id', a.id);

        const submitted = subs?.length || 0;
        const graded = subs?.filter(s => s.grade)?.length || 0;

        reportData.push({
          assignmentTitle: a.title,
          subjectName: (a as any).subject?.name || '',
          streamName,
          totalStudents: totalStudents || 0,
          submitted,
          graded,
          averageGrade: graded > 0 ? `${graded}/${submitted} graded` : 'N/A',
        });
      }

      setReports(reportData);
      setLoading(false);
    };
    load();
  }, []);

  const exportCSV = () => {
    const headers = ['Assignment', 'Subject', 'Stream', 'Total Students', 'Submitted', 'Graded', 'Status'];
    const rows = reports.map(r => [
      r.assignmentTitle,
      r.subjectName,
      r.streamName,
      r.totalStudents,
      r.submitted,
      r.graded,
      r.averageGrade,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gatura-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Reports</h1>
        <button onClick={exportCSV} className="btn-secondary text-sm py-2 px-4">
          Export CSV
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">No assignment data to report on yet.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Assignment</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Subject</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Stream</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">Students</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">Submitted</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">Graded</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 px-3 font-medium">{r.assignmentTitle}</td>
                  <td className="py-2.5 px-3 text-gray-600">{r.subjectName}</td>
                  <td className="py-2.5 px-3">
                    {r.streamName && <StreamBadge stream={r.streamName as StreamName} />}
                  </td>
                  <td className="py-2.5 px-3 text-center">{r.totalStudents}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={r.submitted < r.totalStudents ? 'text-orange-600' : 'text-green-600'}>
                      {r.submitted}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">{r.graded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
