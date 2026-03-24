'use client';

import { useEffect, useState } from 'react';
import { PageLoading } from '@/components/Loading';
import type { Submission } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function parseGrade(grade: string | null): number | null {
  if (!grade) return null;
  // Parse formats like "85", "85%", "17/20"
  if (grade.includes('/')) {
    const [num, den] = grade.split('/').map(s => parseFloat(s.trim()));
    if (!isNaN(num) && !isNaN(den) && den > 0) return Math.round((num / den) * 100);
  }
  const match = grade.match(/(\d+(\.\d+)?)/);
  if (match) return parseFloat(match[1]);
  return null;
}

export default function StudentGrades() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/student/grades', { cache: 'no-store' });
        if (response.ok) {
          const result = await response.json();
          setSubmissions((result.submissions || []) as Submission[]);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoading />;

  // Prepare Chart Data
  const reverseSubmissions = [...submissions].reverse(); // oldest first for timeline
  const timelineData = reverseSubmissions.map(s => {
    const num = parseGrade(s.grade);
    return {
      name: new Date(s.graded_at!).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
      assignment: (s.assignment as any)?.title,
      score: num
    };
  }).filter((item): item is { name: string; assignment: string; score: number } => item.score !== null);

  const subjectAverages: Record<string, { total: number, count: number }> = {};
  submissions.forEach(s => {
    const num = parseGrade(s.grade);
    const subj = (s.assignment as any)?.subject?.name || 'Other';
    if (num !== null) {
      if (!subjectAverages[subj]) subjectAverages[subj] = { total: 0, count: 0 };
      subjectAverages[subj].total += num;
      subjectAverages[subj].count += 1;
    }
  });

  const subjectData = Object.keys(subjectAverages).map(subj => ({
    subject: subj,
    average: Math.round(subjectAverages[subj].total / subjectAverages[subj].count)
  }));

  const scoredSubmissions = submissions
    .map((submission) => ({
      submission,
      score: parseGrade(submission.grade),
    }))
    .filter((item): item is { submission: Submission; score: number } => item.score !== null);

  const overallAverage = scoredSubmissions.length > 0
    ? Math.round(scoredSubmissions.reduce((sum, item) => sum + item.score, 0) / scoredSubmissions.length)
    : null;
  const highestScore = scoredSubmissions.length > 0
    ? Math.max(...scoredSubmissions.map((item) => item.score))
    : null;
  const latestScore = scoredSubmissions.length > 0 ? scoredSubmissions[0].score : null;
  const trendDelta = timelineData.length >= 2
    ? timelineData[timelineData.length - 1].score - timelineData[timelineData.length - 2].score
    : null;
  const bestSubject = subjectData.length > 0
    ? [...subjectData].sort((left, right) => right.average - left.average)[0]
    : null;

  return (
    <div className="space-y-6">
      <h1 className="page-title">My Grades</h1>

      {submissions.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">No grades yet. Grades will appear here once your teachers mark your work.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary">{overallAverage !== null ? `${overallAverage}%` : '—'}</p>
              <p className="text-sm text-gray-500">Overall Average</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">{highestScore !== null ? `${highestScore}%` : '—'}</p>
              <p className="text-sm text-gray-500">Best Score</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600">{bestSubject ? bestSubject.subject : '—'}</p>
              <p className="text-sm text-gray-500">Strongest Subject</p>
            </div>
            <div className="card text-center">
              <p className={`text-3xl font-bold ${trendDelta === null ? 'text-gray-400' : trendDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trendDelta === null ? (latestScore !== null ? `${latestScore}%` : '—') : `${trendDelta > 0 ? '+' : ''}${trendDelta}%`}
              </p>
              <p className="text-sm text-gray-500">{trendDelta === null ? 'Latest Score' : 'Recent Trend'}</p>
            </div>
          </div>

          {/* Analytics Widgets */}
          {timelineData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-4">Progress Over Time (%)</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                      <XAxis dataKey="name" fontSize={12} stroke="#8884d8" />
                      <YAxis domain={[0, 100]} fontSize={12} stroke="#8884d8" />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '14px' }} />
                      <Line type="monotone" dataKey="score" stroke="#185FA5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Score (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-4">Averages by Subject (%)</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                      <XAxis type="number" domain={[0, 100]} fontSize={12} stroke="#8884d8" />
                      <YAxis type="category" dataKey="subject" fontSize={12} stroke="#8884d8" width={80} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', fontSize: '14px' }} />
                      <Bar dataKey="average" fill="#1A6B45" radius={[0, 4, 4, 0]} name="Avg Score (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 mt-4">
            {submissions.map((s) => (
              <div key={s.id} className="card">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{(s.assignment as any)?.title}</p>
                    <p className="text-xs text-gray-500">{(s.assignment as any)?.subject?.name}</p>
                    {s.feedback && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{s.feedback}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Graded {new Date(s.graded_at!).toLocaleDateString('en-KE', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-primary flex-shrink-0">{s.grade}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
 
