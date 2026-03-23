'use client';

import { useEffect, useState } from 'react';
import { AnnouncementContent } from '@/components/AnnouncementContent';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { Announcement, StreamName } from '@/lib/types';

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

              <AnnouncementContent body={announcement.body} className="mt-5" />

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