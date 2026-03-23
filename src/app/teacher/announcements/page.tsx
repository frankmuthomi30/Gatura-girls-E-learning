'use client';

import { useEffect, useState } from 'react';
import { AnnouncementContent } from '@/components/AnnouncementContent';
import { createClient } from '@/lib/supabase';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { RichTextEditor } from '@/components/RichTextEditor';
import { StreamBadge } from '@/components/StreamBadge';
import type { Announcement, Stream, StreamName } from '@/lib/types';

export default function TeacherAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    body: '',
    stream_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({ title: '', body: '', stream_id: '' });
    setEditingId(null);
    setError('');
  };

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: anns }, { data: strs }] = await Promise.all([
      supabase.from('announcements')
        .select('*, stream:streams(name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('streams').select('*').order('name'),
    ]);

    setAnnouncements((anns || []) as Announcement[]);
    setStreams((strs || []) as Stream[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Please fill in title.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        title: form.title.trim(),
        body: form.body.trim() || null,
        stream_id: form.stream_id || null,
      };

      const query = editingId
        ? supabase.from('announcements').update(payload).eq('id', editingId).eq('created_by', user.id)
        : supabase.from('announcements').insert({ ...payload, created_by: user.id });

      const { error: submitError } = await query;
      if (submitError) throw submitError;

      resetForm();
      setShowForm(false);
      await loadData();
    } catch {
      setError(editingId ? 'Failed to update announcement.' : 'Failed to post announcement.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (announcement: Announcement) => {
    setForm({
      title: announcement.title,
      body: announcement.body || '',
      stream_id: announcement.stream_id || '',
    });
    setEditingId(announcement.id);
    setError('');
    setShowForm(true);
  };

  if (loading) return <PageLoading message="Loading announcements" description="Bringing in your latest notices and stream targets." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Announcements</h1>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm(!showForm);
          }}
          className="btn-primary text-sm py-2 px-4"
        >
          {showForm ? 'Close' : '+ New'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Composer</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-slate-50">
                {editingId ? 'Edit announcement' : 'Create announcement'}
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                Use headings, emphasis, lists, and pasted formatting to make updates easier for learners to read.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="btn-secondary text-sm py-2 px-4"
              >
                Cancel edit
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="Announcement title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <RichTextEditor
              value={form.body}
              onChange={(body) => setForm(f => ({ ...f, body }))}
              placeholder="Write the announcement details, or paste them from another document..."
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

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <><LoadingSpinner size="sm" /> {editingId ? 'Saving...' : 'Posting...'}</> : editingId ? 'Save Announcement' : 'Post Announcement'}
          </button>
        </form>
      )}

      {announcements.length === 0 && !showForm ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <article key={ann.id} className="announcement-card card">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Published notice</p>
                  <p className="font-semibold text-lg mt-2 text-gray-900 dark:text-slate-50">{ann.title}</p>
                </div>
                <StreamBadge stream={(ann.stream as any)?.name as StreamName} />
              </div>

              <AnnouncementContent body={ann.body} className="mt-4" />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                {new Date(ann.created_at).toLocaleString('en-KE')}
                </p>
                <button onClick={() => startEdit(ann)} className="btn-secondary text-sm py-2 px-4">
                  Edit announcement
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
