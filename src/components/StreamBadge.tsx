import type { StreamName } from '@/lib/types';
import { STREAM_COLORS } from '@/lib/types';

export function StreamBadge({ stream }: { stream?: StreamName | string | null }) {
  if (!stream) {
    return (
      <span
        className="badge"
        style={{ backgroundColor: '#64748b' }} // gray-500 for All Streams
      >
        All Streams
      </span>
    );
  }

  // Type assertion or check here since 'stream' could be a generic string
  const color = STREAM_COLORS[stream as StreamName] || '#64748b';

  return (
    <span
      className="badge"
      style={{ backgroundColor: color }}
    >
      {stream}
    </span>
  );
}
