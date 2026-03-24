'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { extractSubmissionFilePath } from '@/lib/storage';
import type { Assignment, Submission, Profile } from '@/lib/types';

export default function TeacherSubmissions() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>(assignmentId || '');
  const [submissions, setSubmissions] = useState<(Submission & { student: Profile })[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Signed URLs cache for images
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Grading state
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  // Expanded submission view
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Filter
  const [filter, setFilter] = useState<'all' | 'graded' | 'ungraded'>('all');

  const generateSignedUrls = useCallback(async (subs: (Submission & { student: Profile })[]) => {
    const supabase = createClient();
    const urls: Record<string, string> = {};

    const subsWithFiles = subs.filter(s => s.file_url);
    if (subsWithFiles.length === 0) return;

    await Promise.all(
      subsWithFiles.map(async (sub) => {
        const filePath = extractSubmissionFilePath(sub.file_url!);
        if (!filePath) {
          // If we can't parse it, try using the URL directly
          urls[sub.id] = sub.file_url!;
          return;
        }
        const { data } = await supabase.storage
          .from('submissions')
          .createSignedUrl(filePath, 3600); // 1 hour
        if (data?.signedUrl) {
          urls[sub.id] = data.signedUrl;
        } else {
          // Fallback to stored URL
          urls[sub.id] = sub.file_url!;
        }
      })
    );

    setSignedUrls(urls);
  }, []);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(
        `/api/teacher/submissions${assignmentId ? `?assignment=${assignmentId}` : ''}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const result = await response.json();
      setAssignments((result.assignments || []) as Assignment[]);

      if (assignmentId) {
        setSubmissions((result.submissions || []) as (Submission & { student: Profile })[]);
        setAllStudents((result.students || []) as Profile[]);
        await generateSignedUrls((result.submissions || []) as (Submission & { student: Profile })[]);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const loadSubmissions = async (aId: string) => {
    setLoadingSubs(true);
    setExpandedId(null);
    const response = await fetch(`/api/teacher/submissions?assignment=${aId}`, { cache: 'no-store' });
    if (!response.ok) {
      setSubmissions([]);
      setAllStudents([]);
      setLoadingSubs(false);
      return;
    }

    const result = await response.json();
    const typedSubs = (result.submissions || []) as (Submission & { student: Profile })[];
    setSubmissions(typedSubs);
    setAllStudents((result.students || []) as Profile[]);

    // Generate signed URLs for files
    await generateSignedUrls(typedSubs);

    setLoadingSubs(false);
  };

  const handleSelectAssignment = (id: string) => {
    setSelectedAssignment(id);
    setFilter('all');
    if (id) loadSubmissions(id);
    else {
      setSubmissions([]);
      setAllStudents([]);
      setSignedUrls({});
    }
  };

  const handleGrade = async (submissionId: string) => {
    if (!gradeInput.trim()) return;
    setSavingGrade(true);

    const response = await fetch('/api/teacher/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        grade: gradeInput.trim(),
        feedback: feedbackInput.trim(),
      }),
    });

    if (response.ok) {
      setGradingId(null);
      setGradeInput('');
      setFeedbackInput('');
      if (selectedAssignment) await loadSubmissions(selectedAssignment);
    }
    setSavingGrade(false);
  };

  const getImageUrl = (sub: Submission) => {
    return signedUrls[sub.id] || sub.file_url || '';
  };

  if (loading) return <PageLoading />;

  const submittedStudentIds = new Set(submissions.map(s => s.student_id));
  const notSubmitted = allStudents.filter(s => !submittedStudentIds.has(s.id));
  const gradedCount = submissions.filter(s => s.grade).length;

  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'graded') return !!sub.grade;
    if (filter === 'ungraded') return !sub.grade;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Submissions & Grading</h1>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Assignment</label>
        <select
          value={selectedAssignment}
          onChange={(e) => handleSelectAssignment(e.target.value)}
          className="input-field"
        >
          <option value="">Choose an assignment...</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} — {(a as any).subject?.name} ({(a as any).stream?.name || 'All Streams'})
            </option>
          ))}
        </select>
      </div>

      {loadingSubs && <LoadingSpinner />}

      {selectedAssignment && !loadingSubs && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-green-600">{submissions.length}</p>
              <p className="text-xs text-gray-500">Submitted</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-blue-600">{gradedCount}</p>
              <p className="text-xs text-gray-500">Graded</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-red-500">{notSubmitted.length}</p>
              <p className="text-xs text-gray-500">Not Submitted</p>
            </div>
          </div>

          {/* Filter buttons */}
          {submissions.length > 0 && (
            <div className="flex gap-2">
              {(['all', 'ungraded', 'graded'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-sm py-1.5 px-4 rounded-full border transition-colors ${
                    filter === f
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? `All (${submissions.length})` : f === 'ungraded' ? `Ungraded (${submissions.length - gradedCount})` : `Graded (${gradedCount})`}
                </button>
              ))}
            </div>
          )}

          {/* Submissions list */}
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">
              {filter === 'all' ? 'All Submissions' : filter === 'graded' ? 'Graded Submissions' : 'Ungraded Submissions'} ({filteredSubmissions.length})
            </h2>

            {filteredSubmissions.length === 0 ? (
              <div className="card">
                <p className="text-gray-500 text-sm text-center py-4">No {filter !== 'all' ? filter : ''} submissions.</p>
              </div>
            ) : (
              filteredSubmissions.map((sub, idx) => {
                const isExpanded = expandedId === sub.id;
                const imageUrl = getImageUrl(sub);
                const hasContent = !!sub.answer_text || !!sub.file_url;

                return (
                  <div key={sub.id} className={`card border-2 transition-colors ${
                    sub.grade ? 'border-green-200' : 'border-yellow-200'
                  }`}>
                    {/* Header row — always visible */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-mono w-6">{idx + 1}.</span>
                        <div>
                          <p className="font-semibold text-sm">{(sub.student as any)?.full_name}</p>
                          <p className="text-xs text-gray-500">
                            #{(sub.student as any)?.admission_number}
                            {(sub.student as any)?.stream && (
                              <span className="ml-2 text-gray-400">• {(sub.student as any)?.stream}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {sub.grade ? (
                          <span className="text-lg font-bold text-green-700 bg-green-50 rounded-lg px-3 py-1">{sub.grade}</span>
                        ) : (
                          <span className="text-xs font-medium text-yellow-700 bg-yellow-50 rounded-full px-3 py-1">Ungraded</span>
                        )}

                        <div className="flex items-center gap-1 text-gray-400">
                          {sub.answer_text && (
                            <span title="Has text answer" className="text-base">📝</span>
                          )}
                          {sub.file_url && (
                            <span title="Has file upload" className="text-base">📎</span>
                          )}
                        </div>

                        <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>

                    {/* Submitted timestamp */}
                    <p className="text-xs text-gray-400 ml-9 mt-1">
                      Submitted {new Date(sub.submitted_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-4 ml-9 space-y-4 border-t pt-4">
                        {/* What the student submitted */}
                        {!hasContent && (
                          <p className="text-sm text-gray-400 italic">No content — empty submission.</p>
                        )}

                        {/* Written answer */}
                        {sub.answer_text && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Written Answer</h4>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{sub.answer_text}</p>
                            </div>
                          </div>
                        )}

                        {/* Uploaded file */}
                        {sub.file_url && (() => {
                          const isImage = /\.(jpe?g|png)$/i.test(sub.file_url!);
                          const fileIcon = sub.file_url!.endsWith('.pdf') ? '📄' : (sub.file_url!.endsWith('.doc') || sub.file_url!.endsWith('.docx')) ? '📝' : '📎';
                          return (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  {isImage ? 'Uploaded Image' : 'Uploaded File'}
                                </h4>
                                <div className="flex gap-2">
                                  {isImage && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setLightboxUrl(imageUrl); }}
                                      className="text-xs text-blue-600 hover:underline px-2 py-1"
                                    >
                                      🔍 View Full Screen
                                    </button>
                                  )}
                                  <a
                                    href={imageUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-blue-600 hover:underline px-2 py-1"
                                  >
                                    {isImage ? '⬇ Download' : '⬇ Download / Open'}
                                  </a>
                                </div>
                              </div>
                              {isImage ? (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageUrl}
                                    alt={`Submission by ${(sub.student as any)?.full_name}`}
                                    className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{ maxHeight: '600px' }}
                                    onClick={() => setLightboxUrl(imageUrl)}
                                  />
                                </div>
                              ) : (
                                <a href={imageUrl} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                                  <span className="text-3xl">{fileIcon}</span>
                                  <div>
                                    <p className="text-sm font-medium text-primary">View / Download File</p>
                                    <p className="text-xs text-gray-400">{sub.file_url!.split('/').pop()?.split('?')[0]}</p>
                                  </div>
                                </a>
                              )}
                            </div>
                          );
                        })()}

                        {/* Existing grade & feedback */}
                        {sub.grade && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-green-800">Grade: {sub.grade}</span>
                              {sub.graded_at && (
                                <span className="text-xs text-green-600">
                                  • Graded {new Date(sub.graded_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                                </span>
                              )}
                            </div>
                            {sub.feedback && (
                              <p className="text-sm text-green-700 mt-1 whitespace-pre-wrap">{sub.feedback}</p>
                            )}
                          </div>
                        )}

                        {/* Grade form */}
                        {gradingId === sub.id ? (
                          <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-blue-800">{sub.grade ? 'Edit Grade' : 'Grade Submission'}</h4>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Grade *</label>
                              <input
                                type="text"
                                placeholder="e.g. A, B+, 85/100"
                                value={gradeInput}
                                onChange={(e) => setGradeInput(e.target.value)}
                                className="input-field"
                                maxLength={10}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Feedback (optional)</label>
                              <textarea
                                placeholder="Write feedback for the student..."
                                value={feedbackInput}
                                onChange={(e) => setFeedbackInput(e.target.value)}
                                rows={3}
                                className="input-field resize-y"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleGrade(sub.id)}
                                disabled={savingGrade}
                                className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                              >
                                {savingGrade ? <><LoadingSpinner size="sm" /> Saving...</> : 'Save Grade'}
                              </button>
                              <button
                                onClick={() => { setGradingId(null); setGradeInput(''); setFeedbackInput(''); }}
                                className="text-sm py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setGradingId(sub.id);
                              setGradeInput(sub.grade || '');
                              setFeedbackInput(sub.feedback || '');
                            }}
                            className="btn-primary text-sm py-2 px-4"
                          >
                            {sub.grade ? '✏️ Edit Grade' : '📝 Grade This Submission'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Not submitted */}
          {notSubmitted.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-3 text-red-600">
                Not Submitted ({notSubmitted.length})
              </h2>
              <div className="space-y-1">
                {notSubmitted.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm text-gray-600">#{s.admission_number}</span>
                    <span className="text-sm font-medium">{s.full_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Full-screen image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300 z-10"
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
          <div className="absolute top-4 left-4 flex gap-3 z-10">
            <a
              href={lightboxUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="text-white text-sm bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2"
              onClick={(e) => e.stopPropagation()}
            >
              ⬇ Download
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Full screen submission"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
