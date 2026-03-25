'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { changePin, getProfile, getDashboardPath } from '@/lib/auth';
import { validateStrongPassword } from '@/lib/pin';
import { WEAK_PINS } from '@/lib/types';
import type { UserRole } from '@/lib/types';
import { ShieldCheck, KeyRound, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((module) => module.ThemeToggle),
  { ssr: false }
);

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 opacity-40" />}
      {text}
    </div>
  );
}

export default function ChangePinPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  const isStaffRole = role === 'admin' || role === 'teacher';

  useEffect(() => {
    getProfile().then((p) => {
      if (p) setRole(p.role);
      setLoadingRole(false);
    }).catch(() => setLoadingRole(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isStaffRole) {
      // Admin/teacher: strong password required
      const pwError = validateStrongPassword(newPin);
      if (pwError) { setError(pwError); return; }
    } else {
      // Student: flexible — at least 6 characters (PIN or password)
      if (newPin.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      // Block weak numeric PINs
      if (/^\d+$/.test(newPin) && WEAK_PINS.includes(newPin)) {
        setError('That PIN is too easy to guess. Choose something stronger.');
        return;
      }
    }

    if (newPin !== confirmPin) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changePin(newPin);
      const profile = await getProfile();
      if (profile) {
        router.push(getDashboardPath(profile.role));
      } else {
        router.push('/login');
      }
    } catch {
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 lg:px-8">
      <div className="mx-auto flex max-w-md justify-end pb-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-[26px] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <span className="text-white text-3xl font-bold">GG</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Set Your Password
          </h1>
          <p className="text-muted-foreground mt-1">
            {isStaffRole
              ? 'Staff accounts require a strong password for security'
              : 'Choose a password you\'ll remember — use numbers, letters, or both'}
          </p>
          {isStaffRole && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              {role === 'admin' ? 'Admin Account' : 'Teacher Account'}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-2xl text-sm">
              {error}
            </div>
          )}

          <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground mb-2">
              {isStaffRole ? 'Password Requirements:' : 'Password Tips:'}
            </p>
            {isStaffRole ? (
              <>
                <PasswordRequirement met={newPin.length >= 8} text="At least 8 characters" />
                <PasswordRequirement met={/[A-Z]/.test(newPin)} text="One uppercase letter (A-Z)" />
                <PasswordRequirement met={/[a-z]/.test(newPin)} text="One lowercase letter (a-z)" />
                <PasswordRequirement met={/[0-9]/.test(newPin)} text="One number (0-9)" />
                <PasswordRequirement met={/[^A-Za-z0-9]/.test(newPin)} text="One special character (@#$!%&* etc.)" />
              </>
            ) : (
              <>
                <PasswordRequirement met={newPin.length >= 6} text="At least 6 characters" />
                <div className="text-xs text-muted-foreground mt-1 pl-5">
                  Use numbers (e.g. 847291), letters (e.g. mydog), or mix them (e.g. stars2026!) — whatever you'll remember.
                </div>
              </>
            )}
          </div>

          <div>
            <label htmlFor="newPin" className="block text-sm font-medium text-foreground mb-1">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <input
                id="newPin"
                type={showPassword ? 'text' : 'password'}
                maxLength={50}
                placeholder={isStaffRole ? 'Enter a strong password' : 'Enter PIN or password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-muted/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-foreground mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <input
                id="confirmPin"
                type="password"
                maxLength={50}
                placeholder="Re-enter password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full h-12 pl-10 rounded-xl border border-border bg-muted/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
            {confirmPin && newPin !== confirmPin && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Updating...
              </span>
            ) : (
              'Set Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
