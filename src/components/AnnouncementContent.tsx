'use client';

import { getAnnouncementHtml } from '@/lib/announcement-format';

export function AnnouncementContent({
  body,
  className = '',
}: {
  body: string | null | undefined;
  className?: string;
}) {
  const html = getAnnouncementHtml(body);

  if (!html) {
    return null;
  }

  return (
    <div
      className={`announcement-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}