'use client';

import { useState, useEffect } from 'react';
import { changePin, getProfile } from '@/lib/auth';
import { validateStrongPassword } from '@/lib/pin';
import { LoadingSpinner } from '@/components/Loading';
import { ShieldCheck, Eye, EyeOff, KeyRound, CheckCircle2, XCircle, User, Save } from 'lucide-react';
import type { Profile } from '@/lib/types';

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 opacity-40" />}
      {text}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Profile update
  const [fullName, setFullName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setProfile(p);
        setFullName(p.full_name);
      }
      setLoading(false);
    });
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    const validationError = validateStrongPassword(newPassword);
    if (validationError) { setPwError(validationError); return; }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      await changePin(newPassword);
      setPwSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwError('Failed to change password. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!fullName.trim()) {
      setProfileError('Name is required');
      return;
    }

    setProfileLoading(true);
    try {
      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setProfileSuccess('Profile updated successfully!');
      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim() } : prev);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Page Header */}
      <div>
        <h1 className="page-title">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account credentials and profile
        </p>
      </div>

      {/* Account Info — Glass Card */}
      <div className="relative overflow-hidden rounded-[28px] border border-border/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border border-primary/10 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-bold text-lg text-foreground">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Staff ID: {profile?.admission_number} &middot; Administrator
            </p>
          </div>
        </div>
      </div>

      {/* Update Display Name — Glass Card */}
      <form onSubmit={handleProfileUpdate} className="relative overflow-hidden rounded-[28px] border border-border/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl p-6 space-y-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-indigo-500/[0.03] pointer-events-none" />
        <div className="relative space-y-5">
          <h2 className="font-semibold text-lg flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <User className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            Update Profile
          </h2>

          {profileError && (
            <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-2xl text-sm">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="bg-green-500/10 backdrop-blur-sm border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-2xl text-sm">
              {profileSuccess}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
            <input
              type="text"
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-border/50 bg-white/45 dark:bg-white/5 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              disabled={profileLoading}
            />
          </div>

          <button
            type="submit"
            disabled={profileLoading || fullName.trim() === profile?.full_name}
            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 transition-all duration-300 flex items-center gap-2"
          >
            {profileLoading ? <><LoadingSpinner size="sm" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </form>

      {/* Change Password — Glass Card */}
      <form onSubmit={handlePasswordChange} className="relative overflow-hidden rounded-[28px] border border-border/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl p-6 space-y-5">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] via-transparent to-orange-500/[0.03] pointer-events-none" />
        <div className="relative space-y-5">
          <h2 className="font-semibold text-lg flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            Change Password
          </h2>

          {pwError && (
            <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-2xl text-sm">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="bg-green-500/10 backdrop-blur-sm border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-2xl text-sm">
              {pwSuccess}
            </div>
          )}

          {/* Requirements Panel — Inner Glass */}
          <div className="rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-border/40 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-foreground mb-2">Password Requirements:</p>
            <PasswordRequirement met={newPassword.length >= 8} text="At least 8 characters" />
            <PasswordRequirement met={/[A-Z]/.test(newPassword)} text="One uppercase letter (A-Z)" />
            <PasswordRequirement met={/[a-z]/.test(newPassword)} text="One lowercase letter (a-z)" />
            <PasswordRequirement met={/[0-9]/.test(newPassword)} text="One number (0-9)" />
            <PasswordRequirement met={/[^A-Za-z0-9]/.test(newPassword)} text="One special character (@#$!%&* etc.)" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                maxLength={50}
                placeholder="Enter a strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-2xl border border-border/50 bg-white/45 dark:bg-white/5 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                disabled={pwLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
            <input
              type="password"
              maxLength={50}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-border/50 bg-white/45 dark:bg-white/5 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              disabled={pwLoading}
              autoComplete="new-password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 transition-all duration-300 flex items-center gap-2"
          >
            {pwLoading ? <><LoadingSpinner size="sm" /> Updating...</> : <><KeyRound className="w-4 h-4" /> Change Password</>}
          </button>
        </div>
      </form>
    </div>
  );
}
