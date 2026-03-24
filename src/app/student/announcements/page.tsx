'use client';

import { useEffect, useRef, useState } from 'react';
import { AnnouncementContent } from '@/components/AnnouncementContent';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { Announcement, StreamName } from '@/lib/types';

const COLLAPSE_HEIGHT = 160; // px — roughly 6-7 lines on mobile

function CollapsibleBody({ body }: { body: string | null | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.scrollHeight > COLLAPSE_HEIGHT + 40) {
      setNeedsCollapse(true);
    }
  }, [body]);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${!expanded && needsCollapse ? '' : ''}`}
        style={!expanded && needsCollapse ? { maxHeight: COLLAPSE_HEIGHT } : undefined}
      >
        <AnnouncementContent body={body} className="mt-5" />
      </div>
      {needsCollapse && !expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-[hsl(var(--card))] to-transparent pointer-events-none" />
      )}
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm font-semibold text-primary hover:underline"
        >
          {expanded ? 'Show less ▲' : 'Read more ▼'}
        </button>
      )}
    </div>
  );
}

export default function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const response = await fetch('/api/student/announcements');
        if (!response.ok) {
          setAnnouncements([]);
          return;
        }

        const result = await response.json();
        setAnnouncements((result.announcements || []) as Announcement[]);
      } catch {
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  if (loading) {
    return <PageLoading message="Loading announcements" description="Preparing the latest updates for your stream." />;
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden relative p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_22%)]" />
        <div className="relative p-7 lg:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Notice Board</p>
          <h1 className="page-title mt-3">Announcements</h1>
          <p className="mt-4 max-w-3xl text-sm md:text-base leading-7 text-gray-600">
            Read class updates, reminders, and notices in a clean format with headings, lists, and emphasis preserved.
          </p>
        </div>
      </section>

      {announcements.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">No announcements available right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="announcement-card card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">School update</p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-50">
                    {announcement.title}
                  </h2>
                </div>
                <StreamBadge stream={(announcement.stream as { name?: StreamName } | undefined)?.name ?? null} />
              </div>

              <CollapsibleBody body={announcement.body} />

              <p className="mt-6 text-xs uppercase tracking-[0.18em] text-gray-400">
                Posted {new Date(announcement.created_at).toLocaleString('en-KE')}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}