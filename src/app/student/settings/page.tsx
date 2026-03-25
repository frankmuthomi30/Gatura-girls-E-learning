'use client';

import { useState } from 'react';
import { changePin } from '@/lib/auth';
import { WEAK_PINS } from '@/lib/types';
import { LoadingSpinner } from '@/components/Loading';
import { Eye, EyeOff } from 'lucide-react';

export default function StudentSettings() {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPin.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (/^\d+$/.test(newPin) && WEAK_PINS.includes(newPin)) {
      setError('That PIN is too easy to guess. Choose something stronger.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changePin(newPin);
      setSuccess('Password changed successfully!');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="page-title">Settings</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold text-lg">Change Password</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          Use numbers, letters, or both — at least 6 characters.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              maxLength={50}
              placeholder="Enter new password or PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="input-field pr-10"
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Confirm New Password</label>
          <input
            type="password"
            maxLength={50}
            placeholder="Re-enter password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            className="input-field"
            disabled={loading}
            autoComplete="new-password"
          />
          {confirmPin && newPin !== confirmPin && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <><LoadingSpinner size="sm" /> Updating...</> : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
