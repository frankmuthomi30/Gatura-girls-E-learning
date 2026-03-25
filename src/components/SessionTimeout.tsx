'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { Clock, LogOut } from 'lucide-react';

type Props = {
  /** Role of the current user */
  role: 'admin' | 'teacher' | 'student';
};

// Timeout durations in milliseconds
const TIMEOUT_CONFIG: Record<string, { idle: number; warning: number } | null> = {
  admin: { idle: 15 * 60 * 1000, warning: 2 * 60 * 1000 },     // 15 min idle, 2 min warning
  teacher: { idle: 30 * 60 * 1000, warning: 2 * 60 * 1000 },    // 30 min idle, 2 min warning
  student: null,  // No timeout for students
};

export function SessionTimeout({ role }: Props) {
  const router = useRouter();
  const config = TIMEOUT_CONFIG[role];
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const handleLogout = useCallback(async () => {
    try { await signOut(); } catch { /* ignore */ }
    router.push('/login');
  }, [router]);

  const resetTimers = useCallback(() => {
    if (!config) return;

    // Clear existing timers
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    setShowWarning(false);

    // Set idle timer — fires the warning
    idleTimer.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.floor(config.warning / 1000));

      // Start countdown
      countdownInterval.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Absolute logout timer
      warningTimer.current = setTimeout(handleLogout, config.warning);
    }, config.idle);
  }, [config, handleLogout]);

  const handleStayActive = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!config) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    const onActivity = () => {
      if (!showWarning) {
        resetTimers();
      }
    };

    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach(e => document.removeEventListener(e, onActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [config, resetTimers, showWarning]);

  // No timeout for this role
  if (!config) return null;

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-xl font-bold text-foreground">Session Expiring</h2>
        <p className="text-sm text-muted-foreground">
          Your session will expire due to inactivity.
          You will be logged out in:
        </p>

        <div className="text-4xl font-mono font-bold text-red-600 dark:text-red-400">
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleStayActive}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            Stay Logged In
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
          {role === 'admin' ? '15-minute' : '30-minute'} inactivity timeout
        </p>
      </div>
    </div>
  );
}
