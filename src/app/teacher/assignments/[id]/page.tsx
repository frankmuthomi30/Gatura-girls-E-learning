'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import type { Assignment, Question, QuestionOption, QuestionType } from '@/lib/types';

interface QuestionDraft {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order_index: number;
  marking_scheme: string;
  instructions: string;
  options: OptionDraft[];
}

interface OptionDraft {
  id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
}

const EMPTY_OPTION = (label: string): OptionDraft => ({
  option_label: label, option_text: '', is_correct: false,
});

const EMPTY_MCQ: () => QuestionDraft = () => ({
  question_text: '', question_type: 'mcq', points: 1, order_index: 0,
  marking_scheme: '', instructions: '',
  options: [EMPTY_OPTION('A'), EMPTY_OPTION('B'), EMPTY_OPTION('C'), EMPTY_OPTION('D')],
});

const EMPTY_SHORT: () => QuestionDraft = () => ({
  question_text: '', question_type: 'short_answer', points: 2, order_index: 0,
  marking_scheme: '', instructions: '', options: [],
});

const EMPTY_STRUCTURED: () => QuestionDraft = () => ({
  question_text: '', question_type: 'structured', points: 5, order_index: 0,
  marking_scheme: '', instructions: '', options: [],
});

export default function AssignmentQuestionBuilder() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const { data: asgn } = await supabase
      .from('assignments')
      .select('*, subject:subjects(name), stream:streams(name)')
      .eq('id', assignmentId)
      .single();

    if (!asgn) { router.push('/teacher/assignments'); return; }
    setAssignment(asgn as Assignment);

    const { data: qs } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('assignment_id', assignmentId)
      .order('order_index');

    if (qs && qs.length > 0) {
      setQuestions(qs.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        points: q.points,
        order_index: q.order_index,
        marking_scheme: q.marking_scheme || '',
        instructions: q.instructions || '',
        options: (q.options || [])
          .sort((a: any, b: any) => a.option_label.localeCompare(b.option_label))
          .map((o: any) => ({
            id: o.id,
            option_label: o.option_label,
            option_text: o.option_text,
            is_correct: o.is_correct,
          })),
      })));
    }
    setLoading(false);
  }, [assignmentId, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const addQuestion = (type: QuestionType) => {
    const newQ = type === 'mcq' ? EMPTY_MCQ()
      : type === 'short_answer' ? EMPTY_SHORT()
      : EMPTY_STRUCTURED();
    newQ.order_index = questions.length;
    setQuestions(prev => [...prev, newQ]);
    setEditingIdx(questions.length);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i })));
    setEditingIdx(null);
  };

  const updateQuestion = (idx: number, updates: Partial<QuestionDraft>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  };

  const updateOption = (qIdx: number, oIdx: number, updates: Partial<OptionDraft>) => {
    setQuestions(prev => prev.map((q, qi) => {
      if (qi !== qIdx) return q;
      const newOptions = q.options.map((o, oi) => {
        if (oi !== oIdx) return updates.is_correct ? { ...o, is_correct: false } : o;
        return { ...o, ...updates };
      });
      return { ...q, options: newOptions };
    }));
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setQuestions(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((q, i) => ({ ...q, order_index: i }));
    });
  };

  const saveAllQuestions = async () => {
    setError('');
    setSuccess('');

    for (const q of questions) {
      if (!q.question_text.trim()) {
        setError('All questions must have text.');
        return;
      }
      if (q.question_type === 'mcq') {
        if (q.options.some(o => !o.option_text.trim())) {
          setError('All MCQ options must have text.');
          return;
        }
        if (!q.options.some(o => o.is_correct)) {
          setError(`MCQ "${q.question_text.substring(0, 40)}..." needs a correct answer selected.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const supabase = createClient();

      // Delete existing questions (cascade deletes options)
      await supabase.from('questions').delete().eq('assignment_id', assignmentId);

      // Insert questions
      for (const q of questions) {
        const { data: savedQ, error: qErr } = await supabase
          .from('questions')
          .insert({
            assignment_id: assignmentId,
            question_text: q.question_text.trim(),
            question_type: q.question_type,
            points: q.points,
            order_index: q.order_index,
            marking_scheme: q.marking_scheme.trim() || null,
            instructions: q.instructions.trim() || null,
          })
          .select()
          .single();

        if (qErr) throw qErr;

        if (q.question_type === 'mcq' && q.options.length > 0) {
          const optInserts = q.options.map(o => ({
            question_id: savedQ.id,
            option_label: o.option_label,
            option_text: o.option_text.trim(),
            is_correct: o.is_correct,
          }));

          const { error: oErr } = await supabase.from('question_options').insert(optInserts);
          if (oErr) throw oErr;
        }
      }

      // Update total points
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      await supabase.from('assignments').update({ total_points: totalPoints }).eq('id', assignmentId);

      setSuccess('Questions saved successfully!');
      await loadData();
    } catch {
      setError('Failed to save questions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const publishAssignment = async () => {
    if (questions.length === 0) {
      setError('Add at least one question before publishing.');
      return;
    }
    await saveAllQuestions();
    if (error) return;

    setPublishing(true);
    try {
      const supabase = createClient();
      const { error: pubErr } = await supabase
        .from('assignments')
        .update({ status: 'published' })
        .eq('id', assignmentId);

      if (pubErr) throw pubErr;

      setSuccess('Assignment published! Students can now see it.');
      await loadData();
    } catch {
      setError('Failed to publish.');
    } finally {
      setPublishing(false);
    }
  };

  const startExam = async () => {
    if (questions.length === 0) {
      setError('Add at least one question before starting the exam.');
      return;
    }
    await saveAllQuestions();

    setPublishing(true);
    try {
      const supabase = createClient();
      const { error: pubErr } = await supabase
        .from('assignments')
        .update({ status: 'active' })
        .eq('id', assignmentId);

      if (pubErr) throw pubErr;

      setSuccess('Exam is now LIVE! Students can start taking it.');
      await loadData();
    } catch {
      setError('Failed to start exam.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <PageLoading />;
  if (!assignment) return null;

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const isExam = assignment.is_exam || assignment.mode === 'exam';
  const allowedTypes: QuestionType[] =
    assignment.mode === 'mcq' ? ['mcq']
    : assignment.mode === 'theory' ? ['short_answer', 'structured']
    : ['mcq', 'short_answer', 'structured'];

  const modeLabel =
    assignment.mode === 'mcq' ? 'MCQ Quiz' :
    assignment.mode === 'theory' ? 'Theory Quiz' :
    assignment.mode === 'mixed' ? 'Mixed Quiz' :
    assignment.mode === 'exam' ? 'Timed Exam' : 'Quiz';

  // Step progress
  const stepsDone = {
    created: true,
    hasQuestions: questions.length > 0,
    published: assignment.status === 'published' || assignment.status === 'active',
    live: assignment.status === 'active',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => router.push('/teacher/assignments')}
        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
        ← Back to Assignments
      </button>

      {/* Step Progress Bar */}
      <div className="card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {modeLabel} — Setup Progress
        </p>
        <div className="flex items-center gap-1">
          {/* Step 1: Created */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex-shrink-0">✓</span>
            <span className="text-xs font-medium text-green-700 dark:text-green-400 hidden sm:inline">Created</span>
          </div>
          <div className="flex-1 h-0.5 mx-1 bg-green-300 dark:bg-green-600 rounded" />

          {/* Step 2: Questions Added */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
              stepsDone.hasQuestions ? 'bg-green-500 text-white' : 'bg-blue-500 text-white animate-pulse'
            }`}>
              {stepsDone.hasQuestions ? '✓' : '2'}
            </span>
            <span className={`text-xs font-medium hidden sm:inline ${
              stepsDone.hasQuestions ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'
            }`}>Add Questions</span>
          </div>
          <div className={`flex-1 h-0.5 mx-1 rounded ${stepsDone.hasQuestions ? 'bg-green-300 dark:bg-green-600' : 'bg-gray-200 dark:bg-gray-600'}`} />

          {/* Step 3: Publish / Go Live */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
              stepsDone.published ? 'bg-green-500 text-white' :
              stepsDone.hasQuestions ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
            }`}>
              {stepsDone.published ? '✓' : '3'}
            </span>
            <span className={`text-xs font-medium hidden sm:inline ${
              stepsDone.published ? 'text-green-700 dark:text-green-400' :
              stepsDone.hasQuestions ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400'
            }`}>{isExam ? 'Start Live' : 'Publish'}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h1 className="text-xl font-bold">{assignment.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {(assignment as any).subject?.name} · {(assignment as any).stream?.name}
              {assignment.time_limit && <span className="ml-2">⏱️ {assignment.time_limit} min</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${assignment.status === 'draft' ? 'bg-gray-500' :
              assignment.status === 'published' ? 'bg-blue-600' :
              assignment.status === 'active' ? 'bg-green-600' : 'bg-red-500'}`}>
              {assignment.status}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
          <span>📋 {questions.length} question{questions.length !== 1 ? 's' : ''}</span>
          <span>🎯 {totalPoints} total points</span>
          {assignment.shuffle_questions && <span>🔀 Questions shuffled</span>}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>
      )}

      {/* Questions */}
      {questions.map((q, idx) => (
        <div key={idx} className={`card border-2 ${editingIdx === idx ? 'border-blue-300' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-400">Q{idx + 1}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                q.question_type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                q.question_type === 'short_answer' ? 'bg-green-100 text-green-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {q.question_type === 'mcq' ? '🔘 MCQ' :
                 q.question_type === 'short_answer' ? '📝 Short' : '📄 Structured'}
              </span>
              <span className="text-xs text-gray-500">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">▲</button>
              <button onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">▼</button>
              <button onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                className="p-1 text-blue-500 hover:text-blue-700 text-sm" title="Edit">✏️</button>
              <button onClick={() => removeQuestion(idx)}
                className="p-1 text-red-400 hover:text-red-600 text-sm" title="Delete">🗑️</button>
            </div>
          </div>

          {/* Collapsed view */}
          {editingIdx !== idx && (
            <div className="mt-2 cursor-pointer" onClick={() => setEditingIdx(idx)}>
              <p className="text-sm font-medium">{q.question_text || <span className="italic text-gray-400">No question text</span>}</p>
              {q.question_type === 'mcq' && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {q.options.map((o, oi) => (
                    <span key={oi} className={`text-xs px-2 py-1 rounded ${o.is_correct ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-50 text-gray-600'}`}>
                      {o.option_label}. {o.option_text || '...'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editing view */}
          {editingIdx === idx && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Question Text *</label>
                <textarea value={q.question_text}
                  onChange={(e) => updateQuestion(idx, { question_text: e.target.value })}
                  rows={3} className="input-field resize-y text-sm"
                  placeholder="Type your question here..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Points</label>
                  <input type="number" value={q.points} min={1} max={100}
                    onChange={(e) => updateQuestion(idx, { points: parseInt(e.target.value) || 1 })}
                    className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={q.question_type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      const updates: Partial<QuestionDraft> = { question_type: newType };
                      if (newType === 'mcq' && q.options.length === 0) {
                        updates.options = [EMPTY_OPTION('A'), EMPTY_OPTION('B'), EMPTY_OPTION('C'), EMPTY_OPTION('D')];
                      } else if (newType !== 'mcq') {
                        updates.options = [];
                      }
                      updateQuestion(idx, updates);
                    }}
                    className="input-field text-sm">
                    {allowedTypes.includes('mcq') && <option value="mcq">🔘 MCQ</option>}
                    {allowedTypes.includes('short_answer') && <option value="short_answer">📝 Short Answer</option>}
                    {allowedTypes.includes('structured') && <option value="structured">📄 Structured</option>}
                  </select>
                </div>
              </div>

              {/* MCQ Options */}
              {q.question_type === 'mcq' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">Options (select correct answer)</label>
                  {q.options.map((o, oi) => (
                    <div key={oi} className={`flex items-center gap-2 p-2 rounded-lg border ${o.is_correct ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                      <button type="button"
                        onClick={() => updateOption(idx, oi, { is_correct: true })}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                          o.is_correct ? 'text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        style={o.is_correct ? { backgroundColor: 'rgb(var(--color-primary))' } : {}}
                        title={o.is_correct ? 'Correct answer' : 'Click to mark as correct'}>
                        {o.option_label}
                      </button>
                      <input type="text" value={o.option_text}
                        onChange={(e) => updateOption(idx, oi, { option_text: e.target.value })}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                        placeholder={`Option ${o.option_label}`} />
                      {o.is_correct && <span className="text-green-600 text-sm">✓</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Marking scheme for theory */}
              {q.question_type !== 'mcq' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Marking Scheme / Expected Answer (for teacher reference)
                  </label>
                  <textarea value={q.marking_scheme}
                    onChange={(e) => updateQuestion(idx, { marking_scheme: e.target.value })}
                    rows={2} className="input-field resize-y text-sm"
                    placeholder="Expected answer or grading rubric..." />
                </div>
              )}

              <button onClick={() => setEditingIdx(null)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                ✓ Done editing
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add question buttons */}
      <div className="card border-dashed border-2 border-gray-300 dark:border-gray-600">
        {questions.length === 0 ? (
          <>
            <div className="text-center py-4">
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {assignment.mode === 'mcq' ? '🔘 Add Your MCQ Questions' :
                 assignment.mode === 'theory' ? '📝 Add Your Theory Questions' :
                 assignment.mode === 'mixed' ? '🔀 Add Your Questions (MCQ + Theory)' :
                 '⏱️ Add Your Exam Questions'}
              </p>
              <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                {assignment.mode === 'mcq'
                  ? 'Each question has 4 options (A-D). Select the correct answer. Auto-graded for students.'
                  : assignment.mode === 'theory'
                  ? 'Add Short Answer or Structured questions. You can include a marking scheme for reference.'
                  : assignment.mode === 'mixed'
                  ? 'Mix MCQ and theory questions in any order. MCQs auto-grade, theory needs manual grading.'
                  : 'Add questions for the timed exam. You control when students can start.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {allowedTypes.includes('mcq') && (
                <button onClick={() => addQuestion('mcq')}
                  className="btn-primary text-sm py-2.5 px-5">🔘 Add MCQ Question</button>
              )}
              {allowedTypes.includes('short_answer') && (
                <button onClick={() => addQuestion('short_answer')}
                  className="btn-primary text-sm py-2.5 px-5">📝 Add Short Answer</button>
              )}
              {allowedTypes.includes('structured') && (
                <button onClick={() => addQuestion('structured')}
                  className="btn-primary text-sm py-2.5 px-5">📄 Add Structured Question</button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add Another Question</p>
            <div className="flex flex-wrap gap-2">
              {allowedTypes.includes('mcq') && (
                <button onClick={() => addQuestion('mcq')}
                  className="btn-primary text-sm py-2 px-4">🔘 MCQ</button>
              )}
              {allowedTypes.includes('short_answer') && (
                <button onClick={() => addQuestion('short_answer')}
                  className="btn-primary text-sm py-2 px-4">📝 Short Answer</button>
              )}
              {allowedTypes.includes('structured') && (
                <button onClick={() => addQuestion('structured')}
                  className="btn-primary text-sm py-2 px-4">📄 Structured</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action bar */}
      {questions.length > 0 && (
        <div className="card sticky bottom-4 shadow-lg border-2 border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} points
              </div>
              {assignment.status === 'draft' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {isExam
                    ? 'Save your questions, then start the exam live when ready.'
                    : 'Save your questions, then publish so students can see the quiz.'}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={saveAllQuestions} disabled={saving}
                className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
                {saving ? <><LoadingSpinner size="sm" /> Saving...</> : '💾 Save Draft'}
              </button>
              {assignment.status === 'draft' && !isExam && (
                <button onClick={publishAssignment} disabled={publishing}
                  className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                  title="Students will be able to see and take this quiz">
                  {publishing ? <><LoadingSpinner size="sm" /> Publishing...</> : '📢 Publish to Students'}
                </button>
              )}
              {isExam && assignment.status !== 'active' && (
                <button onClick={startExam} disabled={publishing}
                  className="text-white font-semibold text-sm py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 flex items-center gap-2"
                  title="Students will immediately be able to start the timed exam">
                  {publishing ? <><LoadingSpinner size="sm" /> Starting...</> : '🚀 Start Exam LIVE'}
                </button>
              )}
              {assignment.status === 'published' && !isExam && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-lg">
                  ✅ Published — students can see this quiz
                </span>
              )}
              {assignment.status === 'active' && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-lg">
                  🟢 Exam is LIVE — students are taking it
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
