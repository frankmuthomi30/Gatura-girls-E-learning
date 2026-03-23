'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { Assignment, Subject, Stream, StreamName, AssignmentMode } from '@/lib/types';
import { STREAM_COLORS } from '@/lib/types';

const MODE_LABELS: Record<AssignmentMode, { label: string; icon: string; desc: string }> = {
  mcq:         { label: 'Multiple Choice', icon: '🔘', desc: 'Auto-graded MCQ questions' },
  theory:      { label: 'Theory / Short Answer', icon: '📝', desc: 'Open-ended text responses' },
  mixed:       { label: 'Mixed', icon: '🔀', desc: 'Combine MCQ + theory questions' },
  practical:   { label: 'Practical Task', icon: '🔧', desc: 'Step-by-step instructions' },
  exam:        { label: 'Quick Exam (Timed)', icon: '⏱️', desc: 'Timed test with auto-submit' },
  file_upload: { label: 'File Upload', icon: '📎', desc: 'Students upload photos/files' },
};

const CREATION_MODES: AssignmentMode[] = ['mcq', 'theory', 'mixed', 'practical', 'exam', 'file_upload'];

export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const { confirm, dialogProps } = useConfirmDialog();

  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    subject_id: '',
    stream_ids: [] as string[],
    due_date: '',
    mode: 'file_upload' as AssignmentMode,
    time_limit: '',
    is_exam: false,
    shuffle_questions: false,
  });

  const [filterMode, setFilterMode] = useState<'all' | AssignmentMode>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'active' | 'closed'>('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: subs }, { data: strs }, { data: asgns }] = await Promise.all([
      supabase.from('subjects').select('*, stream:streams(id, name)').eq('teacher_id', user.id),
      supabase.from('streams').select('*').order('name'),
      supabase.from('assignments')
        .select('*, subject:subjects(name), stream:streams(name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
    ]);

    setSubjects((subs || []) as Subject[]);
    setStreams((strs || []) as Stream[]);
    setAssignments((asgns || []) as Assignment[]);
    setLoading(false);
  };

  const handleModeSelect = (mode: AssignmentMode) => {
    const isExam = mode === 'exam';
    setForm(f => ({
      ...f, mode, is_exam: isExam,
      time_limit: isExam ? '60' : f.time_limit,
      shuffle_questions: isExam ? true : f.shuffle_questions,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.subject_id || form.stream_ids.length === 0 || !form.due_date) {
      setError('Please fill in title, subject, at least one stream, and due date.');
      return;
    }

    const needsQuestions = ['mcq', 'theory', 'mixed', 'exam'].includes(form.mode);
    const status = needsQuestions ? 'draft' : 'published';

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const inserts = (form.stream_ids.includes('all') ? [null] : form.stream_ids).map((streamId) => ({
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        subject_id: form.subject_id,
        stream_id: streamId,
        due_date: new Date(form.due_date).toISOString(),
        created_by: user.id,
        mode: form.mode,
        time_limit: form.time_limit ? parseInt(form.time_limit) : null,
        is_exam: form.is_exam,
        shuffle_questions: form.shuffle_questions,
        status,
        total_points: 0,
      }));

      const { data: created, error: insertError } = await supabase
        .from('assignments')
        .insert(inserts)
        .select();

      if (insertError) throw insertError;

      setForm({
        title: '', description: '', instructions: '', subject_id: '', stream_ids: [],
        due_date: '', mode: 'file_upload', time_limit: '', is_exam: false, shuffle_questions: false,
      });
      setShowForm(false);
      await loadData();

      if (needsQuestions && created && created.length > 0) {
        window.location.href = `/teacher/assignments/${created[0].id}`;
      }
    } catch {
      setError('Failed to create assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignment: Assignment) => {
    const confirmed = await confirm(
      'Delete assignment?',
      `This will permanently remove "${assignment.title}" and all related submissions, questions, and exam records.`,
      'Delete'
    );

    if (!confirmed) return;

    setActionError('');
    setDeletingId(assignment.id);

    try {
      const response = await fetch('/api/teacher/delete-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment.id }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to delete assignment.');
      }

      await loadData();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Failed to delete assignment.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStream = (id: string) => {
      setForm(f => {
        const withoutAll = f.stream_ids.filter(s => s !== 'all');
        return {
          ...f,
          stream_ids: withoutAll.includes(id)
            ? withoutAll.filter(s => s !== id)
            : [...withoutAll, id],
        };
      });
    };

    const selectAllStreams = () => {
      setForm(f => ({
        ...f,
        stream_ids: f.stream_ids.includes('all') ? [] : ['all'],
      }));
    };

  if (loading) return <PageLoading />;

  const filteredAssignments = assignments.filter(a => {
    if (filterMode !== 'all' && a.mode !== filterMode) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="badge bg-gray-500">Draft</span>;
      case 'published': return <span className="badge bg-blue-600">Published</span>;
      case 'active': return <span className="badge bg-green-600">Active</span>;
      case 'closed': return <span className="badge bg-red-500">Closed</span>;
      default: return <span className="badge bg-blue-600">Published</span>;
    }
  };

  const getModeBadge = (mode: string) => {
    const m = MODE_LABELS[mode as AssignmentMode];
    if (!m) return null;
    return <span className="text-xs text-gray-500">{m.icon} {m.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Assignments</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm py-2 px-4">
          {showForm ? 'Cancel' : '+ New Assignment'}
        </button>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {actionError}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-5">
          <h2 className="font-semibold text-lg">Create Assignment</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Mode *</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {CREATION_MODES.map((mode) => {
                const m = MODE_LABELS[mode];
                const selected = form.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeSelect(mode)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selected ? 'border-current shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={selected ? { borderColor: 'rgb(var(--color-primary))', backgroundColor: 'var(--color-primary-50)' } : {}}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <p className={`text-sm font-medium mt-1 ${selected ? '' : 'text-gray-700'}`}
                       style={selected ? { color: 'rgb(var(--color-primary))' } : {}}>
                      {m.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder={form.mode === 'exam' ? 'e.g. End Term ICT Test' : 'e.g. Week 3 Mathematics Homework'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <select value={form.subject_id}
                onChange={(e) => setForm(f => ({ ...f, subject_id: e.target.value }))}
                className="input-field">
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {(s.stream as any)?.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input type="datetime-local" value={form.due_date}
                onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="input-field" />
            </div>
          </div>

          {(form.mode === 'exam' || form.mode === 'mcq' || form.mode === 'mixed') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Limit (minutes) {form.mode === 'exam' ? '*' : '(optional)'}
                </label>
                <input type="number" value={form.time_limit}
                  onChange={(e) => setForm(f => ({ ...f, time_limit: e.target.value }))}
                  className="input-field" placeholder="e.g. 60" min="1" max="300" />
              </div>
              <div className="flex items-end gap-4 pb-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.shuffle_questions}
                    onChange={(e) => setForm(f => ({ ...f, shuffle_questions: e.target.checked }))}
                    className="w-4 h-4 rounded" style={{ accentColor: 'rgb(var(--color-primary))' }} />
                  Shuffle questions
                </label>
                {form.mode !== 'exam' && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_exam}
                      onChange={(e) => setForm(f => ({ ...f, is_exam: e.target.checked }))}
                      className="w-4 h-4 rounded" style={{ accentColor: 'rgb(var(--color-primary))' }} />
                    Exam mode
                  </label>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="input-field resize-y" placeholder="Brief description" />
          </div>

          {(form.mode === 'practical' || form.mode === 'file_upload') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.mode === 'practical' ? 'Step-by-step Instructions *' : 'Instructions'}
              </label>
              <textarea value={form.instructions}
                onChange={(e) => setForm(f => ({ ...f, instructions: e.target.value }))}
                rows={4} className="input-field resize-y"
                placeholder={form.mode === 'practical' ? 'Step 1: ...\nStep 2: ...' : 'Detailed instructions'} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Stream(s) *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={selectAllStreams}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
                  form.stream_ids.includes('all')
                    ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                }`}>
                All Streams
              </button>
              {streams.map((s) => (
                <button key={s.id} type="button" onClick={() => toggleStream(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
                    form.stream_ids.includes(s.id)
                      ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                  }`}
                  style={form.stream_ids.includes(s.id) ? { backgroundColor: (STREAM_COLORS as any)[s.name] } : {}}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? (
              <><LoadingSpinner size="sm" /> Creating...</>
            ) : ['mcq', 'theory', 'mixed', 'exam'].includes(form.mode) ? (
              'Create & Add Questions →'
            ) : (
              'Create Assignment'
            )}
          </button>

          {['mcq', 'theory', 'mixed', 'exam'].includes(form.mode) && (
            <p className="text-xs text-gray-500 text-center">
              After creating, you&apos;ll be taken to the question builder to add questions.
            </p>
          )}
        </form>
      )}

      {/* Filters */}
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
            <option value="all">All Modes</option>
            {CREATION_MODES.map(m => (
              <option key={m} value={m}>{MODE_LABELS[m].icon} {MODE_LABELS[m].label}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
            <option value="all">All Status</option>
            <option value="draft">📋 Draft</option>
            <option value="published">📢 Published</option>
            <option value="active">🟢 Active</option>
            <option value="closed">🔴 Closed</option>
          </select>
        </div>
      )}

      {/* Assignment list */}
      {filteredAssignments.length === 0 && !showForm ? (
        <div className="card text-center py-10">
          <p className="text-gray-500 mb-3">
            {assignments.length === 0 ? 'No assignments yet.' : 'No assignments match your filters.'}
          </p>
          {assignments.length === 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2 px-4">
              Create Your First Assignment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((a) => {
            const mode = a.mode || 'file_upload';
            const status = a.status || 'published';
            const needsQuestions = ['mcq', 'theory', 'mixed', 'exam'].includes(mode);
            const isDraft = status === 'draft';
            const href = needsQuestions && isDraft
              ? `/teacher/assignments/${a.id}`
              : `/teacher/submissions?assignment=${a.id}`;

            return (
              <div
                key={a.id}
                className={`card transition-colors ${isDraft ? 'border-dashed border-yellow-300 bg-yellow-50/50 dark:border-yellow-500/40 dark:bg-yellow-500/10' : 'hover:border-primary/30'}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <Link href={href} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{a.title}</p>
                      {getStatusBadge(status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">{(a as any).subject?.name}</span>
                      <StreamBadge stream={(a as any).stream?.name as StreamName} />
                      {getModeBadge(mode)}
                      {a.time_limit && (
                        <span className="text-xs text-gray-400">⏱️ {a.time_limit}min</span>
                      )}
                    </div>
                    {isDraft && needsQuestions && (
                      <p className="text-xs text-yellow-600 mt-1 font-medium dark:text-yellow-300">⚠️ Add questions to publish</p>
                    )}
                  </Link>
                  <div className="flex shrink-0 items-start gap-3">
                    <span className="text-xs text-gray-400 whitespace-nowrap pt-1">
                      Due {new Date(a.due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(a)}
                      disabled={deletingId === a.id}
                      className="btn-danger text-xs py-2 px-3 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === a.id ? <LoadingSpinner size="sm" /> : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
