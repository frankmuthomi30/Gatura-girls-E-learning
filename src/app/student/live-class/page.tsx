'use client';

import { useEffect, useState } from 'react';
import { PageLoading } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { StreamName } from '@/lib/types';

interface LiveSession {
  id: string;
  room_id: string;
  title: string;
  started_at: string;
  subject?: { name: string };
  stream?: { name: string };
  teacher?: { full_name: string };
}

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just started';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function StudentLiveClass() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [joinedTitle, setJoinedTitle] = useState('');
  const [roomOpened, setRoomOpened] = useState(false);
  const [studentName, setStudentName] = useState('');

  // Fetch student name for Jitsi display
  useEffect(() => {
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile?.full_name) setStudentName(d.profile.full_name); })
      .catch(() => {});
  }, []);

  const joinSession = (session: LiveSession) => {
    setJoinedRoom(session.room_id);
    setJoinedTitle(session.title);
    // Record attendance
    fetch('/api/student/live-class', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    }).catch(() => {});
    // Open Jitsi
    openJitsiRoom(session.room_id);
  };

  const openJitsiRoom = (roomId: string) => {
    const encodedName = encodeURIComponent(studentName || 'Student');
    const jitsiUrl = `https://meet.jit.si/${roomId}#userInfo.displayName="${encodedName}"&config.prejoinConfig.enabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.resolution=720&config.constraints.video.height.ideal=720&config.constraints.video.height.max=720&config.disableDeepLinking=true&config.p2p.enabled=true&config.channelLastN=4&config.enableLayerSuspension=true&config.enableNoAudioDetection=true&config.enableNoisyMicDetection=true&config.enableTalkWhileMuted=true&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true&interfaceConfig.MOBILE_APP_PROMO=false`;
    window.open(jitsiUrl, '_blank');
    setRoomOpened(true);
  };

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/student/live-class', { cache: 'no-store' });
      if (res.ok) {
        const result = await res.json();
        setSessions(result.liveSessions || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
    // Poll every 15s for new live sessions
    const interval = setInterval(loadSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <PageLoading />;

  // Watching a class
  if (joinedRoom) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Live header */}
        <div className="card border-2 border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
              <div>
                <h2 className="font-bold text-lg">{joinedTitle}</h2>
                <span className="text-sm font-mono text-red-500 font-semibold">LIVE</span>
              </div>
            </div>
            <button
              onClick={() => { setJoinedRoom(null); setJoinedTitle(''); setRoomOpened(false); }}
              className="btn-secondary px-4 py-2 rounded-xl text-sm transition-all hover:scale-[1.02]"
            >
              ← Leave Class
            </button>
          </div>
        </div>

        {/* Open Video Room */}
        <div className="card text-center py-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-4xl mx-auto shadow-lg shadow-red-500/20 transition-transform hover:scale-105">
            🎥
          </div>
          <div>
            <p className="text-lg font-semibold">
              {roomOpened ? 'Video room is open!' : 'Click below to join the video'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {roomOpened
                ? 'Switch to the Jitsi tab. You can re-open it anytime if you closed it.'
                : 'Opens in a new tab — no account needed, just click and join.'}
            </p>
          </div>
          <button
            onClick={() => openJitsiRoom(joinedRoom)}
            className={`px-8 py-3 rounded-xl font-semibold text-base inline-flex items-center gap-2 shadow-lg transition-all duration-300 ${
              roomOpened
                ? 'btn-secondary hover:shadow-md'
                : 'btn-primary shadow-primary/20 hover:scale-[1.02]'
            }`}
          >
            {roomOpened ? '🔄 Re-open Video Room' : '▶ Open Video Room'}
          </button>
          {roomOpened && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 animate-in fade-in duration-300">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected — check the video tab
            </div>
          )}
        </div>

        <div className="card bg-muted/30">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your mic and camera start <strong>off by default</strong>. Turn them on in the video room controls.
            Video quality adjusts automatically based on your internet speed.
          </p>
        </div>
      </div>
    );
  }

  // No active classes
  if (sessions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">🎥 Live Classes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join your teacher&apos;s live video sessions</p>
        </div>

        <div className="card text-center py-16">
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-5xl mx-auto">
              📡
            </div>
          </div>
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">No live classes right now</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-sm mx-auto">
            When your teacher starts a live class, it will appear here with a 🔴 LIVE badge.
            This page auto-refreshes every 15 seconds.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Checking for live classes...
          </div>
        </div>
      </div>
    );
  }

  // Active classes available
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">🎥 Live Classes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {sessions.length === 1 ? 'A teacher is live right now!' : `${sessions.length} teachers are live right now!`}
        </p>
      </div>

      <div className="space-y-4">
        {sessions.map(s => (
          <div
            key={s.id}
            className="card border-2 border-red-500/20 hover:border-red-500/40 transition-all duration-300 overflow-hidden hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              {/* Live pulse icon */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-red-500/20">
                  🎥
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white dark:border-gray-900" />
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
                    🔴 LIVE
                  </span>
                  <span className="text-xs text-gray-400">Started {timeAgo(s.started_at)}</span>
                </div>

                <h3 className="font-bold text-lg">{s.title}</h3>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm">
                  {s.teacher?.full_name && (
                    <span className="text-gray-500 dark:text-gray-400">
                      by <strong>{s.teacher.full_name}</strong>
                    </span>
                  )}
                  {s.subject?.name && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {s.subject.name}
                    </span>
                  )}
                  {s.stream?.name && (
                    <StreamBadge stream={s.stream.name as StreamName} />
                  )}
                </div>

                <button
                  onClick={() => joinSession(s)}
                  className="btn-primary mt-4 px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-base shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-lg">▶</span> Join Live Class
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-4">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Auto-refreshing every 15 seconds
      </div>
    </div>
  );
}
