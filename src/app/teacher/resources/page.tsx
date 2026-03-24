'use client';

import { useEffect, useState } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import type { StreamName } from '@/lib/types';

interface Resource {
  id: string;
  title: string;
  url: string;
  description: string | null;
  resource_type: 'youtube' | 'link';
  thumbnail_url: string | null;
  stream_id: string | null;
  grade: number | null;
  subject_id: string | null;
  created_at: string;
  subject?: { name: string };
  stream?: { name: string };
  teacher?: { full_name: string };
}

interface SubjectOption {
  id: string;
  name: string;
  stream?: { id: string; name: string };
}

interface StreamOption {
  id: string;
  name: StreamName;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch|embed|shorts)|youtu\.be\/)/i.test(url);
}

export default function TeacherResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [streams, setStreams] = useState<StreamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const [form, setForm] = useState({
    title: '',
    url: '',
    description: '',
    stream_id: '',
    grade: '',
    subject_id: '',
  });

  const [urlPreview, setUrlPreview] = useState<{ type: 'youtube' | 'link'; videoId?: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/teacher/resources', { cache: 'no-store' });
      if (res.ok) {
        const result = await res.json();
        setResources(result.resources || []);
        setSubjects(result.subjects || []);
        setStreams(result.streams || []);
      }
    } catch {}
    setLoading(false);
  };

  // Live URL preview
  const handleUrlChange = (url: string) => {
    setForm(f => ({ ...f, url }));
    if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeId(url);
      setUrlPreview(videoId ? { type: 'youtube', videoId } : null);
    } else if (url.startsWith('http')) {
      setUrlPreview({ type: 'link' });
    } else {
      setUrlPreview(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim() || !form.url.trim()) {
      setError('Title and URL are required.');
      return;
    }

    if (!form.url.startsWith('http://') && !form.url.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/teacher/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          url: form.url.trim(),
          description: form.description.trim() || null,
          stream_id: form.stream_id || null,
          grade: form.grade ? parseInt(form.grade) : null,
          subject_id: form.subject_id || null,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      setForm({ title: '', url: '', description: '', stream_id: '', grade: '', subject_id: '' });
      setUrlPreview(null);
      setShowForm(false);
      await loadData();
    } catch {
      setError('Failed to share resource.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource: Resource) => {
    const confirmed = await confirm(
      'Delete resource?',
      `Remove "${resource.title}"? Students will no longer see it.`,
      'Delete'
    );
    if (!confirmed) return;

    setDeletingId(resource.id);
    try {
      await fetch(`/api/teacher/resources?id=${resource.id}`, { method: 'DELETE' });
      await loadData();
    } catch {}
    setDeletingId(null);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">📺 Shared Resources</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Share YouTube videos and useful links with your students</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Share Link'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="text-lg font-semibold">Share a New Resource</h2>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>}

          <div>
            <label className="block text-sm font-medium mb-1">URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="input w-full"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Paste a YouTube link or any website URL</p>
          </div>

          {/* Live YouTube Preview */}
          {urlPreview?.type === 'youtube' && urlPreview.videoId && (
            <div className="rounded-xl overflow-hidden border border-border bg-black">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${urlPreview.videoId}`}
                  title="Video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {urlPreview?.type === 'link' && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
              <span className="text-2xl">🌐</span>
              <div className="text-sm text-muted-foreground truncate">{form.url}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Photosynthesis Explained"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief note about why students should watch this..."
              className="input w-full"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Subject (optional)</label>
              <select
                value={form.subject_id}
                onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                className="input w-full"
              >
                <option value="">All subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stream (optional)</label>
              <select
                value={form.stream_id}
                onChange={e => setForm(f => ({ ...f, stream_id: e.target.value }))}
                className="input w-full"
              >
                <option value="">All streams</option>
                {streams.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Grade (optional)</label>
              <select
                value={form.grade}
                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                className="input w-full"
              >
                <option value="">All grades</option>
                <option value="10">Form 1 (Grade 10)</option>
                <option value="11">Form 2 (Grade 11)</option>
                <option value="12">Form 3 (Grade 12)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowForm(false); setUrlPreview(null); }} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><LoadingSpinner /> Sharing...</> : '🔗 Share with Students'}
            </button>
          </div>
        </form>
      )}

      {/* Resources Grid */}
      {resources.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📺</p>
          <p className="text-gray-500 dark:text-gray-400">No resources shared yet.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Click "Share Link" to post a YouTube video or website for your students.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resources.map(r => {
            const videoId = r.resource_type === 'youtube' ? extractYouTubeId(r.url) : null;

            return (
              <div key={r.id} className="card group hover:shadow-lg transition-shadow overflow-hidden">
                {/* Thumbnail / Embed */}
                {videoId ? (
                  <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 bg-black">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                        title={r.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center h-32">
                    <span className="text-5xl">🌐</span>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-semibold text-base line-clamp-2">{r.title}</h3>

                  {r.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{r.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs">
                    {r.subject?.name && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {r.subject.name}
                      </span>
                    )}
                    {r.stream?.name && (
                      <StreamBadge stream={r.stream.name as StreamName} />
                    )}
                    {r.grade && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Form {r.grade - 9}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate max-w-[200px]"
                    >
                      {r.resource_type === 'youtube' ? '▶ Open on YouTube' : '🔗 Open link'}
                    </a>
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      {deletingId === r.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
