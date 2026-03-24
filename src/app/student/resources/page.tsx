'use client';

import { useEffect, useState } from 'react';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
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

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

export default function StudentResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('');
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/student/resources', { cache: 'no-store' });
        if (res.ok) {
          const result = await res.json();
          setResources(result.resources || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoading />;

  // Unique subjects for filter
  const subjectNames = Array.from(new Set(resources.map(r => r.subject?.name).filter(Boolean))) as string[];

  const filtered = filterSubject
    ? resources.filter(r => r.subject?.name === filterSubject)
    : resources;

  // New resources (last 24h)
  const dayAgo = Date.now() - 86400000;
  const newCount = resources.filter(r => new Date(r.created_at).getTime() > dayAgo).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">📺 Learning Resources</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Videos and links shared by your teachers
            {newCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse">
                🔴 {newCount} new
              </span>
            )}
          </p>
        </div>

        {subjectNames.length > 1 && (
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="input text-sm"
          >
            <option value="">All subjects</option>
            {subjectNames.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-5xl mb-4">📺</p>
          <p className="text-gray-500 dark:text-gray-400 text-lg">No resources yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Your teachers will share videos and links here. Check back later!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => {
            const videoId = r.resource_type === 'youtube' ? extractYouTubeId(r.url) : null;
            const isNew = new Date(r.created_at).getTime() > dayAgo;
            const isExpanded = expandedVideo === r.id;

            return (
              <div
                key={r.id}
                className={`card overflow-hidden transition-all ${isNew ? 'ring-2 ring-primary/30' : ''}`}
              >
                {/* New badge */}
                {isNew && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      🔴 NEW
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                  </div>
                )}

                <div className={videoId && !isExpanded ? 'flex gap-4' : ''}>
                  {/* YouTube Thumbnail (collapsed) */}
                  {videoId && !isExpanded && (
                    <button
                      onClick={() => setExpandedVideo(r.id)}
                      className="relative flex-shrink-0 w-40 h-24 sm:w-52 sm:h-32 rounded-lg overflow-hidden bg-black group"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                        alt={r.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* YouTube Embed (expanded) */}
                  {videoId && isExpanded && (
                    <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 bg-black">
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute inset-0 w-full h-full"
                          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
                          title={r.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <button
                        onClick={() => setExpandedVideo(null)}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Non-YouTube link */}
                  {!videoId && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center text-3xl hover:scale-105 transition-transform"
                    >
                      🌐
                    </a>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base line-clamp-2">{r.title}</h3>

                    {r.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {r.teacher?.full_name && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          by {r.teacher.full_name}
                        </span>
                      )}
                      {r.subject?.name && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {r.subject.name}
                        </span>
                      )}
                      {r.stream?.name && (
                        <StreamBadge stream={r.stream.name as StreamName} />
                      )}
                      {!isNew && (
                        <span className="text-xs text-gray-400">
                          {timeAgo(r.created_at)}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex gap-2">
                      {videoId && !isExpanded && (
                        <button
                          onClick={() => setExpandedVideo(r.id)}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          ▶ Watch Video
                        </button>
                      )}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        {videoId ? 'Open on YouTube ↗' : 'Open Link ↗'}
                      </a>
                    </div>
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
