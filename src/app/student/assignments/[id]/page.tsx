'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { extractSubmissionFilePath } from '@/lib/storage';
import type { Assignment, Submission, Question, QuestionOption, ExamSession, StudentAnswer } from '@/lib/types';

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const IMAGE_TYPES = ['image/jpeg', 'image/png'];

function getFileIcon(name: string): string {
  if (name.endsWith('.pdf')) return '📄';
  if (name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
  return '📎';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AssignmentDetail() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  // Assignment & submission state (file_upload mode)
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Exam mode state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, { text: string; optionId: string | null }>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isExamMode = assignment && ['mcq', 'theory', 'mixed', 'exam'].includes(assignment.mode);

  const generateSignedUrl = async (fileUrl: string) => {
    const filePath = extractSubmissionFilePath(fileUrl);
    if (!filePath) { setSignedImageUrl(fileUrl); return; }
    const supabase = createClient();
    const { data } = await supabase.storage.from('submissions').createSignedUrl(filePath, 3600);
    setSignedImageUrl(data?.signedUrl || fileUrl);
  };

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: asgn } = await supabase
        .from('assignments')
        .select('*, subject:subjects(name), stream:streams(name)')
        .eq('id', assignmentId)
        .single();

      if (!asgn) { router.push('/student/assignments'); return; }
      if (!['published', 'active'].includes(asgn.status || 'published')) {
        router.push('/student/assignments');
        return;
      }
      setAssignment(asgn as Assignment);

      const mode = asgn.mode || 'file_upload';

      if (['mcq', 'theory', 'mixed', 'exam'].includes(mode)) {
        // Load questions
        const { data: qs } = await supabase
          .from('questions')
          .select('*, options:question_options(id, option_label, option_text)')
          .eq('assignment_id', assignmentId)
          .order('order_index');

        let loadedQs = (qs || []) as Question[];
        if (asgn.shuffle_questions) loadedQs = shuffleArray(loadedQs);
        setQuestions(loadedQs);

        // Check for existing exam session
        const { data: sess } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('assignment_id', assignmentId)
          .eq('student_id', user.id)
          .maybeSingle();

        if (sess) {
          setExamSession(sess as ExamSession);
          if (sess.status === 'submitted' || sess.status === 'timed_out') {
            setExamFinished(true);
          } else if (sess.status === 'in_progress') {
            // Resume: calculate remaining time
            if (asgn.time_limit) {
              const elapsed = Math.floor((Date.now() - new Date(sess.started_at).getTime()) / 1000);
              const remaining = Math.max(0, asgn.time_limit * 60 - elapsed);
              setTimeLeft(remaining);
              if (remaining <= 0) {
                // Time expired while away — auto-submit
                setExamFinished(true);
              }
            }
          }

          // Load saved answers
          const { data: savedAnswers } = await supabase
            .from('student_answers')
            .select('*')
            .eq('exam_session_id', sess.id);

          if (savedAnswers) {
            const ansMap: Record<string, { text: string; optionId: string | null }> = {};
            savedAnswers.forEach((a: any) => {
              ansMap[a.question_id] = {
                text: a.answer_text || '',
                optionId: a.selected_option_id || null,
              };
            });
            setAnswers(ansMap);
          }
        }
      } else {
        // File upload mode — load existing submission
        const { data: sub } = await supabase
          .from('submissions')
          .select('*')
          .eq('assignment_id', assignmentId)
          .eq('student_id', user.id)
          .maybeSingle();

        if (sub) {
          setSubmission(sub as Submission);
          setAnswerText(sub.answer_text || '');
          if (sub.file_url) await generateSignedUrl(sub.file_url);
        }
      }

      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, router]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || examFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleExamSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft !== null && !examFinished]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!examSession || examFinished || examSession.status !== 'in_progress') return;

    autoSaveRef.current = setInterval(() => {
      autoSaveAnswers();
    }, 30000);

    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examSession, examFinished]);

  const startExam = async () => {
    setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !assignment) return;

    const { data: sess, error: sessErr } = await supabase
      .from('exam_sessions')
      .insert({
        assignment_id: assignmentId,
        student_id: user.id,
        status: 'in_progress',
        time_remaining: assignment.time_limit ? assignment.time_limit * 60 : null,
        total_points: assignment.total_points,
      })
      .select()
      .single();

    if (sessErr) {
      setError('Failed to start exam. You may have already taken it.');
      return;
    }

    setExamSession(sess as ExamSession);
    if (assignment.time_limit) {
      setTimeLeft(assignment.time_limit * 60);
    }
  };

  const autoSaveAnswers = useCallback(async () => {
    if (!examSession) return;
    setAutoSaving(true);
    try {
      const supabase = createClient();

      // Update last activity + time remaining
      await supabase.from('exam_sessions').update({
        last_activity: new Date().toISOString(),
        time_remaining: timeLeft,
      }).eq('id', examSession.id);

      // Upsert answers
      for (const [qId, ans] of Object.entries(answers)) {
        if (!ans.text && !ans.optionId) continue;

        const q = questions.find(q => q.id === qId);
        const isCorrect = q?.question_type === 'mcq' && ans.optionId
          ? q.options?.some(o => o.id === ans.optionId && o.is_correct) ?? null
          : null;

        await supabase.from('student_answers').upsert({
          exam_session_id: examSession.id,
          question_id: qId,
          answer_text: ans.text || null,
          selected_option_id: ans.optionId || null,
          is_correct: isCorrect,
          points_earned: isCorrect ? (q?.points || 0) : 0,
          answered_at: new Date().toISOString(),
        }, { onConflict: 'exam_session_id,question_id' });
      }
    } catch { /* silent */ }
    setAutoSaving(false);
  }, [examSession, answers, questions, timeLeft]);

  const handleExamSubmit = async (autoSubmit = false) => {
    if (!examSession) return;
    setExamSubmitting(true);

    try {
      await autoSaveAnswers();

      const supabase = createClient();

      // Calculate score for MCQ
      let score = 0;
      for (const [qId, ans] of Object.entries(answers)) {
        const q = questions.find(q => q.id === qId);
        if (q?.question_type === 'mcq' && ans.optionId) {
          const correct = q.options?.some(o => o.id === ans.optionId && o.is_correct);
          if (correct) score += q.points;
        }
      }

      await supabase.from('exam_sessions').update({
        status: autoSubmit ? 'timed_out' : 'submitted',
        ended_at: new Date().toISOString(),
        score,
        time_remaining: 0,
      }).eq('id', examSession.id);

      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);

      setExamFinished(true);
      setExamSession(prev => prev ? { ...prev, status: autoSubmit ? 'timed_out' : 'submitted', score } : null);
    } catch {
      if (!autoSubmit) setError('Failed to submit. Please try again.');
    } finally {
      setExamSubmitting(false);
    }
  };

  const setAnswer = (questionId: string, text: string, optionId: string | null) => {
    setAnswers(prev => ({ ...prev, [questionId]: { text, optionId } }));
  };

  // --- File upload handlers (unchanged) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) { setError('Only JPEG, PNG, PDF and Word documents are allowed.'); return; }
    if (selected.size > MAX_FILE_SIZE) { setError('File must be smaller than 4MB.'); return; }
    setFile(selected);
    setFileName(selected.name);
    setError('');
    if (IMAGE_TYPES.includes(selected.type)) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!answerText.trim() && !file) { setError('Please type an answer or upload a photo.'); return; }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let fileUrl: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop();
        const filePath = `${user.id}/${assignmentId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('submissions').upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      if (submission) {
        const { error: updateError } = await supabase.from('submissions').update({
          answer_text: answerText.trim() || null,
          file_url: fileUrl || submission.file_url,
          submitted_at: new Date().toISOString(),
        }).eq('id', submission.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('submissions').insert({
          assignment_id: assignmentId, student_id: user.id,
          answer_text: answerText.trim() || null, file_url: fileUrl,
        });
        if (insertError) throw insertError;
      }

      setSuccess('Your work has been submitted successfully!');
      const { data: sub } = await supabase.from('submissions').select('*')
        .eq('assignment_id', assignmentId).eq('student_id', user.id).single();
      if (sub) { setSubmission(sub as Submission); if (sub.file_url) await generateSignedUrl(sub.file_url); }
    } catch { setError('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <PageLoading />;
  if (!assignment) return null;

  const isPastDue = new Date(assignment.due_date) < new Date();
  const isGraded = !!submission?.grade;
  const canSubmitFile = !isPastDue && !isGraded;
  const isPublished = assignment.status === 'published' || assignment.status === 'active';
  const examNotStarted = isExamMode && !examSession;
  const examInProgress = isExamMode && examSession && examSession.status === 'in_progress' && !examFinished;
  const answeredCount = Object.values(answers).filter(a => a.text || a.optionId).length;

  // ============ EXAM MODE RENDERING ============
  if (isExamMode) {
    // Exam finished view
    if (examFinished) {
      return (
        <div className="space-y-6 max-w-2xl">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <div className="card text-center py-10">
            <div className="text-5xl mb-4">
              {examSession?.status === 'timed_out' ? '⏰' : '✅'}
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {examSession?.status === 'timed_out' ? 'Time\'s Up!' : 'Exam Submitted'}
            </h1>
            <p className="text-gray-600 mb-4">
              {examSession?.status === 'timed_out'
                ? 'Your answers were automatically submitted when time ran out.'
                : 'Your answers have been recorded successfully.'}
            </p>
            {examSession?.score !== null && examSession?.score !== undefined && (
              <div className="inline-block bg-green-50 border border-green-200 rounded-xl px-6 py-4">
                <p className="text-sm text-green-600 mb-1">Auto-graded MCQ Score</p>
                <p className="text-3xl font-bold text-green-700">
                  {examSession.score} / {examSession.total_points}
                </p>
              </div>
            )}
            <div className="mt-4 text-sm text-gray-500">
              Answered {answeredCount} of {questions.length} questions
            </div>
          </div>
        </div>
      );
    }

    // Exam not started — show info
    if (examNotStarted) {
      return (
        <div className="space-y-6 max-w-2xl">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <div className="card">
            <h1 className="text-xl font-bold">{assignment.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{(assignment as any).subject?.name}</p>
            {assignment.description && <p className="text-sm text-gray-600 mt-3">{assignment.description}</p>}
          </div>

          <div className="card border-2 border-yellow-300 bg-yellow-50">
            <h2 className="font-semibold text-lg text-yellow-800 mb-3">📋 Exam Information</h2>
            <div className="space-y-2 text-sm text-yellow-700">
              <p>📝 <b>{questions.length}</b> question{questions.length !== 1 ? 's' : ''}</p>
              <p>🎯 <b>{assignment.total_points}</b> total points</p>
              {assignment.time_limit && (
                <p>⏱️ <b>{assignment.time_limit} minutes</b> time limit</p>
              )}
              {assignment.shuffle_questions && <p>🔀 Questions will be shuffled</p>}
              {assignment.time_limit && (
                <p className="font-medium text-red-600 mt-2">⚠️ Once you start, the timer begins immediately. Auto-submit when time ends.</p>
              )}
            </div>
          </div>

          {!isPublished ? (
            <div className="card bg-gray-50 text-center py-6">
              <p className="text-gray-500">This exam is not yet available.</p>
            </div>
          ) : (
            <>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <button onClick={startExam} className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2">
                🚀 Start Exam
              </button>
            </>
          )}
        </div>
      );
    }

    // Exam in progress
    if (examInProgress) {
      const q = questions[currentQ];
      const qAnswer = answers[q?.id] || { text: '', optionId: null };

      return (
        <div className="space-y-4 max-w-3xl">
          {/* Top bar: timer + progress */}
          <div className="card sticky top-0 z-20 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Q{currentQ + 1}</span> of {questions.length}
                <span className="text-gray-400 ml-2">({answeredCount} answered)</span>
              </div>
              {timeLeft !== null && (
                <div className={`text-lg font-mono font-bold ${timeLeft <= 60 ? 'text-red-600 animate-pulse' : timeLeft <= 300 ? 'text-orange-600' : 'text-gray-800'}`}>
                  ⏱️ {formatTime(timeLeft)}
                </div>
              )}
              {autoSaving && <span className="text-xs text-gray-400">Saving...</span>}
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%`, backgroundColor: 'rgb(var(--color-primary))' }} />
            </div>
          </div>

          {/* Question navigation pills */}
          <div className="flex flex-wrap gap-1">
            {questions.map((qu, i) => {
              const isAnswered = !!(answers[qu.id]?.text || answers[qu.id]?.optionId);
              const isCurrent = i === currentQ;
              return (
                <button key={qu.id} onClick={() => setCurrentQ(i)}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                    isCurrent ? 'text-white shadow-sm' :
                    isAnswered ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  style={isCurrent ? { backgroundColor: 'rgb(var(--color-primary))' } : {}}>
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Current question */}
          {q && (
            <div className="card border-2 border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  q.question_type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                  q.question_type === 'short_answer' ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'short_answer' ? 'Short Answer' : 'Structured'}
                </span>
                <span className="text-xs text-gray-500">{q.points} point{q.points !== 1 ? 's' : ''}</span>
              </div>

              <p className="text-base font-medium mb-4 whitespace-pre-wrap">{q.question_text}</p>

              {/* MCQ options */}
              {q.question_type === 'mcq' && q.options && (
                <div className="space-y-2">
                  {q.options.map(o => {
                    const selected = qAnswer.optionId === o.id;
                    return (
                      <button key={o.id}
                        onClick={() => setAnswer(q.id, '', o.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                          selected ? 'border-current shadow-sm' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={selected ? { borderColor: 'rgb(var(--color-primary))', backgroundColor: 'var(--color-primary-50)' } : {}}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          selected ? 'text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                          style={selected ? { backgroundColor: 'rgb(var(--color-primary))' } : {}}>
                          {o.option_label}
                        </span>
                        <span className="text-sm">{o.option_text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text answer */}
              {q.question_type !== 'mcq' && (
                <textarea value={qAnswer.text}
                  onChange={(e) => setAnswer(q.id, e.target.value, null)}
                  rows={q.question_type === 'structured' ? 8 : 4}
                  className="input-field resize-y text-sm"
                  placeholder={q.question_type === 'structured' ? 'Write your detailed answer here...' : 'Type your answer...'} />
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
              disabled={currentQ === 0}
              className="btn-secondary text-sm py-2 px-4 disabled:opacity-30">
              ← Previous
            </button>

            {currentQ < questions.length - 1 ? (
              <button onClick={() => setCurrentQ(currentQ + 1)}
                className="btn-primary text-sm py-2 px-4">
                Next →
              </button>
            ) : (
              <button onClick={() => handleExamSubmit(false)}
                disabled={examSubmitting}
                className="text-white font-semibold text-sm py-2 px-6 rounded-lg bg-green-600 hover:bg-green-700 flex items-center gap-2">
                {examSubmitting ? <><LoadingSpinner size="sm" /> Submitting...</> : '✅ Submit Exam'}
              </button>
            )}
          </div>

          {/* Submit anytime */}
          {currentQ < questions.length - 1 && (
            <div className="text-center">
              <button onClick={() => handleExamSubmit(false)}
                disabled={examSubmitting}
                className="text-sm text-gray-500 hover:text-gray-700 underline">
                Submit exam early
              </button>
            </div>
          )}
        </div>
      );
    }
  }

  // ============ FILE UPLOAD MODE RENDERING ============
  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Back</button>

      <div className="card">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h1 className="text-xl font-bold">{assignment.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{(assignment as any).subject?.name}</p>
          </div>
          <div className="text-right">
            <span className={`badge ${isPastDue ? 'bg-red-500' : 'bg-orange-500'}`}>
              {isPastDue ? 'Past Due' : 'Due'} {new Date(assignment.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
        {assignment.description && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700">Description</h3>
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{assignment.description}</p>
          </div>
        )}
        {assignment.instructions && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700">Instructions</h3>
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}
      </div>

      {isGraded && (
        <div className="card border-green-200 bg-green-50">
          <h2 className="font-semibold text-green-800">Grade: {submission!.grade}</h2>
          {submission!.feedback && <p className="mt-2 text-sm text-green-700 whitespace-pre-wrap">{submission!.feedback}</p>}
          <p className="text-xs text-green-600 mt-2">Graded on {new Date(submission!.graded_at!).toLocaleDateString('en-KE')}</p>
        </div>
      )}

      {canSubmitFile && (
        <form onSubmit={handleFileSubmit} className="card space-y-4">
          <h2 className="font-semibold text-lg">{submission ? 'Update Your Submission' : 'Submit Your Work'}</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type your answer</label>
            <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)}
              rows={6} className="input-field resize-y" placeholder="Type your answer here..." disabled={submitting} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Or upload a file (JPEG, PNG, PDF, Word — max 10MB)</label>
            <input type="file" accept="image/jpeg,image/png,application/pdf,.doc,.docx" onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 min-h-[44px]"
              disabled={submitting} />
            {filePreview && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={filePreview} alt="Preview" className="max-w-full max-h-64 rounded-lg border" />
              </div>
            )}
            {file && !filePreview && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-gray-50 border rounded-lg">
                <span className="text-2xl">{getFileIcon(file.name)}</span>
                <div>
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
            {submitting ? <><LoadingSpinner size="sm" /> Submitting...</> : submission ? 'Update Submission' : 'Submit'}
          </button>
        </form>
      )}

      {submission && !isGraded && !canSubmitFile && (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-yellow-700 text-sm font-medium">You submitted this assignment. The deadline has passed — waiting for grading.</p>
        </div>
      )}

      {submission && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">Your Submission</h2>
          <p className="text-xs text-gray-500">Submitted on {new Date(submission.submitted_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {submission.answer_text && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Written Answer</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{submission.answer_text}</p>
              </div>
            </div>
          )}
          {submission.file_url && signedImageUrl && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Uploaded Work</h4>
              {/\.(jpe?g|png)$/i.test(submission.file_url) ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signedImageUrl} alt="Your submission" className="max-w-full rounded-lg" style={{ maxHeight: '500px' }} />
                </div>
              ) : (
                <a href={signedImageUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  <span className="text-3xl">{getFileIcon(submission.file_url)}</span>
                  <div>
                    <p className="text-sm font-medium text-primary">View / Download File</p>
                    <p className="text-xs text-gray-400">{submission.file_url.split('/').pop()?.split('?')[0]}</p>
                  </div>
                </a>
              )}
            </div>
          )}
          {!submission.answer_text && !submission.file_url && (
            <p className="text-sm text-gray-400 italic">Empty submission — no content.</p>
          )}
        </div>
      )}
    </div>
  );
}
