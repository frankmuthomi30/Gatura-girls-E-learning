'use client';

import { useEffect, useState } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { StreamBadge } from '@/components/StreamBadge';
import type { Subject, Stream, Profile, StreamName } from '@/lib/types';

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editForm, setEditForm] = useState({ name: '', stream_id: '', teacher_id: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const { confirm, dialogProps } = useConfirmDialog();

  const [form, setForm] = useState({
    name: '',
    stream_id: '',
    teacher_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/api/admin/subjects', { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        setSubjects((result.subjects || []) as Subject[]);
        setStreams((result.streams || []) as Stream[]);
        setTeachers((result.teachers || []) as Profile[]);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Please enter subject name.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          stream_id: form.stream_id || null,
          teacher_id: form.teacher_id || null,
        }),
      });

      if (!response.ok) throw new Error('Failed');

      setForm({ name: '', stream_id: '', teacher_id: '' });
      setShowForm(false);
      await loadData();
    } catch {
      setError('Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setEditForm({
      name: subject.name,
      stream_id: subject.stream_id,
      teacher_id: subject.teacher_id || '',
    });
    setEditError('');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setEditError('');

    if (!editForm.name.trim()) {
      setEditError('Please enter subject name.');
      return;
    }

    setEditSaving(true);
    try {
      const response = await fetch('/api/admin/subjects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSubject.id,
          name: editForm.name.trim(),
          stream_id: editForm.stream_id || null,
          teacher_id: editForm.teacher_id || null,
        }),
      });

      if (!response.ok) throw new Error('Failed');

      setEditingSubject(null);
      await loadData();
    } catch {
      setEditError('Failed to update subject.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (subject: Subject) => {
    const confirmed = await confirm(
      'Delete Subject',
      `Permanently delete "${subject.name}"? Any assignments and submissions for this subject will also be deleted.`,
      'Delete'
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/subjects?id=${subject.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed');

      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete subject.');
    }
  };

  const handleAssignTeacher = async (subjectId: string, teacherId: string) => {
    await fetch('/api/admin/subjects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subjectId, teacher_id: teacherId || null }),
    });
    await loadData();
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Subjects ({subjects.length})</h1>
        <button onClick={() => { setShowForm(!showForm); setEditingSubject(null); }} className="btn-primary text-sm py-2 px-4">
          {showForm ? 'Cancel' : '+ Add Subject'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="e.g. Mathematics"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stream (Optional)</label>
            <select
              value={form.stream_id}
              onChange={(e) => setForm(f => ({ ...f, stream_id: e.target.value }))}
              className="input-field"
            >
              <option value="">All Streams</option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher (optional)</label>
            <select
              value={form.teacher_id}
              onChange={(e) => setForm(f => ({ ...f, teacher_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <><LoadingSpinner size="sm" /> Creating...</> : 'Create Subject'}
          </button>
        </form>
      )}

      {/* Edit form */}
      {editingSubject && (
        <form onSubmit={handleEditSave} className="card space-y-4 border-2 border-blue-200">
          <h2 className="font-semibold text-lg">Edit Subject: {editingSubject.name}</h2>

          {editError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{editError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stream (Optional)</label>
            <select
              value={editForm.stream_id}
              onChange={(e) => setEditForm(f => ({ ...f, stream_id: e.target.value }))}
              className="input-field"
            >
              <option value="">All Streams</option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
            <select
              value={editForm.teacher_id}
              onChange={(e) => setEditForm(f => ({ ...f, teacher_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={editSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {editSaving ? <><LoadingSpinner size="sm" /> Saving...</> : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditingSubject(null)} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Subjects table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-500">Subject</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Stream</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Teacher</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 px-3 font-medium">{s.name}</td>
                <td className="py-2.5 px-3">
                  <StreamBadge stream={(s.stream as any)?.name as StreamName} />
                </td>
                <td className="py-2.5 px-3">
                  <select
                    value={s.teacher_id || ''}
                    onChange={(e) => handleAssignTeacher(s.id, e.target.value)}
                    className="text-sm border border-gray-200 rounded px-2 py-1 min-h-[36px]"
                  >
                    <option value="">Unassigned</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2.5 px-3 text-right space-x-2">
                  <button
                    onClick={() => { handleEdit(s); setShowForm(false); }}
                    className="text-xs text-blue-600 hover:underline min-h-[44px] px-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="text-xs text-red-600 hover:underline min-h-[44px] px-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subjects.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No subjects yet.</p>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
