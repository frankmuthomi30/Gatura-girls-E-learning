'use client';

import { useEffect, useState } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import type { Profile } from '@/lib/types';

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', admission_number: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [latestTemporaryPin, setLatestTemporaryPin] = useState<{ name: string; pin: string } | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const [form, setForm] = useState({
    full_name: '',
    admission_number: '',
  });

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const response = await fetch('/api/admin/teachers', { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        setTeachers((result.teachers || []) as Profile[]);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim() || !form.admission_number.trim()) {
      setError('Please enter both name and staff ID.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          admission_number: form.admission_number.trim(),
          role: 'teacher',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create teacher');

      setLatestTemporaryPin({ name: form.full_name.trim(), pin: result.user?.temporary_pin || '' });
      setForm({ full_name: '', admission_number: '' });
      setShowForm(false);
      await loadTeachers();
    } catch (err: any) {
      setError(err?.message || 'Failed to create teacher account.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (teacher: Profile) => {
    setEditingTeacher(teacher);
    setEditForm({ full_name: teacher.full_name, admission_number: teacher.admission_number });
    setEditError('');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setEditError('');

    if (!editForm.full_name.trim() || !editForm.admission_number.trim()) {
      setEditError('Please enter both name and staff ID.');
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch('/api/admin/update-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: editingTeacher.id,
          full_name: editForm.full_name.trim(),
          admission_number: editForm.admission_number.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update teacher');

      setEditingTeacher(null);
      await loadTeachers();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update teacher.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (teacher: Profile) => {
    const confirmed = await confirm(
      'Delete Teacher',
      `Permanently delete ${teacher.full_name} (${teacher.admission_number})? This will also unassign them from all subjects.`,
      'Delete'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/delete-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: teacher.id }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete teacher');

      await loadTeachers();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete teacher.');
    }
  };

  const handleResetPin = async (teacher: Profile) => {
    const confirmed = await confirm(
      'Reset PIN',
      `Generate a new temporary PIN for ${teacher.full_name}?`,
      'Reset PIN'
    );
    if (!confirmed) return;

    const res = await fetch('/api/admin/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: teacher.id }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || 'Failed to reset PIN.');
      return;
    }

    setLatestTemporaryPin({ name: teacher.full_name, pin: result.temporary_pin || '' });
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Teachers ({teachers.length})</h1>
        <button onClick={() => { setShowForm(!showForm); setEditingTeacher(null); }} className="btn-primary text-sm py-2 px-4">
          {showForm ? 'Cancel' : '+ Add Teacher'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-lg">New Teacher Account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID / Login Number *</label>
            <input
              type="text"
              value={form.admission_number}
              onChange={(e) => setForm(f => ({ ...f, admission_number: e.target.value }))}
              className="input-field"
              placeholder="e.g. T001"
            />
            <p className="text-xs text-gray-400 mt-1">This will be their login number</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="input-field"
              placeholder="e.g. Jane Wambui"
            />
          </div>

          <p className="text-xs text-gray-400">
            A unique temporary PIN will be generated and the teacher will be asked to change it on first login.
          </p>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <><LoadingSpinner size="sm" /> Creating...</> : 'Create Teacher Account'}
          </button>
        </form>
      )}

      {/* Edit form */}
      {editingTeacher && (
        <form onSubmit={handleEditSave} className="card space-y-4 border-2 border-blue-200">
          <h2 className="font-semibold text-lg">Edit Teacher: {editingTeacher.full_name}</h2>

          {editError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{editError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID / Login Number *</label>
            <input
              type="text"
              value={editForm.admission_number}
              onChange={(e) => setEditForm(f => ({ ...f, admission_number: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={editForm.full_name}
              onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
              className="input-field"
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={editSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {editSaving ? <><LoadingSpinner size="sm" /> Saving...</> : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditingTeacher(null)} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Teacher list */}
      {latestTemporaryPin && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900">
          <p className="font-medium">Temporary PIN for {latestTemporaryPin.name}</p>
          <p className="mt-1 font-mono text-xl tracking-[0.24em]">{latestTemporaryPin.pin}</p>
          <p className="mt-2 text-xs text-emerald-800">Share it securely. The teacher will be forced to change it after signing in.</p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-500">Staff ID</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Full Name</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Created</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 px-3 font-mono text-gray-600">{t.admission_number}</td>
                <td className="py-2.5 px-3 font-medium">{t.full_name}</td>
                <td className="py-2.5 px-3 text-gray-500">
                  {new Date(t.created_at).toLocaleDateString('en-KE')}
                </td>
                <td className="py-2.5 px-3 text-right space-x-2">
                  <button
                    onClick={() => { handleEdit(t); setShowForm(false); }}
                    className="text-xs text-blue-600 hover:underline min-h-[44px] px-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleResetPin(t)}
                    className="text-xs text-orange-600 hover:underline min-h-[44px] px-2"
                  >
                    Reset PIN
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="text-xs text-red-600 hover:underline min-h-[44px] px-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {teachers.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No teachers yet.</p>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
