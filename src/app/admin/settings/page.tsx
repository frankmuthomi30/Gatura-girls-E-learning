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
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="page-title">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account credentials and profile
        </p>
      </div>

      {/* Account Info */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground">
              Staff ID: {profile?.admission_number} &middot; Admin
            </p>
          </div>
        </div>
      </div>

      {/* Update Display Name */}
      <form onSubmit={handleProfileUpdate} className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" />
          Update Profile
        </h2>

        {profileError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm">
            {profileSuccess}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
          <input
            type="text"
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
            disabled={profileLoading}
          />
        </div>

        <button
          type="submit"
          disabled={profileLoading || fullName.trim() === profile?.full_name}
          className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {profileLoading ? <><LoadingSpinner size="sm" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={handlePasswordChange} className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-muted-foreground" />
          Change Password
        </h2>

        {pwError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm">
            {pwSuccess}
          </div>
        )}

        <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground mb-2">Password Requirements:</p>
          <PasswordRequirement met={newPassword.length >= 8} text="At least 8 characters" />
          <PasswordRequirement met={/[A-Z]/.test(newPassword)} text="One uppercase letter (A-Z)" />
          <PasswordRequirement met={/[a-z]/.test(newPassword)} text="One lowercase letter (a-z)" />
          <PasswordRequirement met={/[0-9]/.test(newPassword)} text="One number (0-9)" />
          <PasswordRequirement met={/[^A-Za-z0-9]/.test(newPassword)} text="One special character (@#$!%&* etc.)" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              maxLength={50}
              placeholder="Enter a strong password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-4 pr-12 rounded-xl border border-border bg-muted/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              disabled={pwLoading}
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
          <label className="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
          <input
            type="password"
            maxLength={50}
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
            disabled={pwLoading}
            autoComplete="new-password"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pwLoading}
          className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {pwLoading ? <><LoadingSpinner size="sm" /> Updating...</> : <><KeyRound className="w-4 h-4" /> Change Password</>}
        </button>
      </form>
    </div>
  );
}
