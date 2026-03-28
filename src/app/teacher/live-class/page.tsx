'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import type { StreamName } from '@/lib/types';

interface LiveSession {
  id: string;
  room_id: string;
  title: string;
  subject_id: string | null;
  stream_id: string | null;
  grade: number | null;
  status: 'live' | 'ended';
  started_at: string;
  ended_at: string | null;
  subject?: { name: string };
  stream?: { name: string };
}

interface SubjectOption { id: string; name: string; }
interface StreamOption { id: string; name: StreamName; }

function formatDuration(start: string, end?: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default function TeacherLiveClass() {
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [pastSessions, setPastSessions] = useState<LiveSession[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [streams, setStreams] = useState<StreamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState('');
  const [roomOpened, setRoomOpened] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [form, setForm] = useState({
    title: '',
    subject_id: '',
    stream_id: '',
    grade: '',
  });

  // Fetch teacher name for Jitsi display
  useEffect(() => {
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile?.full_name) setTeacherName(d.profile.full_name); })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/live-class', { cache: 'no-store' });
      if (res.ok) {
        const result = await res.json();
        setActiveSession(result.activeSession || null);
        setPastSessions(result.pastSessions || []);
        setSubjects(result.subjects || []);
        setStreams(result.streams || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live timer
  useEffect(() => {
    if (!activeSession) { setElapsed(''); return; }
    const tick = () => setElapsed(formatDuration(activeSession.started_at));
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Please enter a class title'); return; }

    setStarting(true);
    try {
      const res = await fetch('/api/teacher/live-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to start');
      setActiveSession(result.session);
      setRoomOpened(false);
      setForm({ title: '', subject_id: '', stream_id: '', grade: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    if (!activeSession) return;
    setEnding(true);
    try {
      await fetch('/api/teacher/live-class', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSession.id }),
      });
      await loadData();
    } catch {}
    setEnding(false);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">🎥 Live Class</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Start a live video session — students join instantly
        </p>
      </div>

      {/* ACTIVE SESSION — Full Jitsi Embed */}
      {activeSession ? (
        <div className="space-y-4">
          {/* Live header bar */}
          <div className="card border-2 border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                </span>
                <div>
                  <h2 className="font-bold text-lg">{activeSession.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-mono text-red-500 font-semibold">LIVE</span>
                    <span>•</span>
                    <span>{elapsed}</span>
                    {activeSession.subject?.name && (
                      <><span>•</span><span>{activeSession.subject.name}</span></>
                    )}
                    {activeSession.stream?.name && (
                      <><span>•</span><StreamBadge stream={activeSession.stream.name as StreamName} /></>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleEnd}
                disabled={ending}
                className="btn-danger px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2"
              >
                {ending ? <LoadingSpinner /> : '⏹'}
                {ending ? 'Ending...' : 'End Class'}
              </button>
            </div>
          </div>

          {/* Open Video Room */}
          <div className="card text-center py-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-4xl mx-auto shadow-lg shadow-blue-500/20 transition-transform hover:scale-105">
              📹
            </div>
            <div>
              <p className="text-lg font-semibold">{roomOpened ? 'Video room is open in another tab' : 'Your video room is ready'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {roomOpened
                  ? 'Switch to the Jitsi tab to teach. You can re-open it anytime.'
                  : 'Click below to open the video room. Share your screen, chat, and teach live.'}
              </p>
            </div>
            <button
              onClick={() => {
                const encodedName = encodeURIComponent(teacherName || 'Teacher');
                const jitsiUrl = `https://meet.jit.si/${activeSession.room_id}#userInfo.displayName=${encodedName}&config.prejoinConfig.enabled=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.resolution=1080&config.constraints.video.height.ideal=1080&config.constraints.video.height.max=1080&config.disableDeepLinking=true&config.disableInitialGUM=false&config.p2p.enabled=true&config.channelLastN=6&config.enableLayerSuspension=true&config.enableNoAudioDetection=true&config.enableNoisyMicDetection=true&config.disableAP=false&config.stereo=false&config.enableTalkWhileMuted=true&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true&interfaceConfig.MOBILE_APP_PROMO=false`;
                window.open(jitsiUrl, '_blank');
                setRoomOpened(true);
              }}
              className={`px-8 py-3 rounded-xl font-semibold text-base inline-flex items-center gap-2 shadow-lg transition-all duration-300 ${
                roomOpened
                  ? 'btn-secondary hover:shadow-md'
                  : 'btn-primary shadow-primary/20 hover:scale-[1.02]'
              }`}
            >
              {roomOpened ? '🔄 Re-open Video Room' : '🎥 Open Video Room'}
            </button>
            {roomOpened && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 animate-in fade-in duration-300">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Connected — video room is active
              </div>
            )}
            {!roomOpened && (
              <p className="text-xs text-gray-400">
                Opens in a new browser tab — no account needed, completely free
              </p>
            )}
          </div>

          {/* Room info */}
          <div className="card bg-muted/30">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <strong>Students can see this class</strong> — they&apos;ll have a 🔴 LIVE indicator on their dashboard.
              When they click &quot;Join&quot;, the same video room opens in their browser.
            </p>
            <p className="text-xs text-gray-400 mt-2 font-mono">
              Room: {activeSession.room_id}
            </p>
          </div>
        </div>
      ) : (
        /* START NEW SESSION FORM */
        <form onSubmit={handleStart} className="card space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg">
              🎥
            </div>
            <div>
              <h2 className="text-lg font-bold">Start a Live Class</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Broadcast to your students in real-time</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Class Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Biology — Photosynthesis Revision"
              className="input w-full"
              required
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

          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
            <span className="text-2xl">💡</span>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p className="font-medium">How it works</p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                A video room opens here. Students see a live indicator and can join with one click.
                You can share your screen, use the chat, and manage the call.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={starting}
            className="btn-primary w-full py-3 text-base font-semibold flex items-center justify-center gap-2"
          >
            {starting ? <><LoadingSpinner /> Starting...</> : '🔴 Go Live'}
          </button>
        </form>
      )}

      {/* PAST SESSIONS */}
      {pastSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Past Sessions</h2>
          <div className="space-y-2">
            {pastSessions.map(s => (
              <div key={s.id} className="card flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
                    📹
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(s.started_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>{formatDuration(s.started_at, s.ended_at)}</span>
                      {s.subject?.name && <><span>•</span><span>{s.subject.name}</span></>}
                    </div>
                  </div>
                </div>
                {s.stream?.name && (
                  <StreamBadge stream={s.stream.name as StreamName} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
