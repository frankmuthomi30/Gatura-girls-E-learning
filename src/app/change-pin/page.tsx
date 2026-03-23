'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePin, getProfile, getDashboardPath } from '@/lib/auth';
import { WEAK_PINS } from '@/lib/types';

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((module) => module.ThemeToggle),
  { ssr: false }
);

export default function ChangePinPage() {
  const router = useRouter();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length !== 6) {
      setError('PIN must be exactly 6 digits');
      return;
    }

    if (WEAK_PINS.includes(newPin)) {
      setError('That PIN is too easy to guess. Choose a stronger 6-digit PIN.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
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
      setError('Failed to change PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 lg:px-8">
      <div className="mx-auto flex max-w-md justify-end pb-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-[26px] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <span className="text-white text-3xl font-bold">GG</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Change Your PIN</h1>
          <p className="text-gray-500 mt-1">
            You must set a new PIN before continuing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="newPin" className="block text-sm font-medium text-gray-700 mb-1">
              New PIN
            </label>
            <input
              id="newPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter 6-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="input-field"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New PIN
            </label>
            <input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Re-enter 6-digit PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="input-field"
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Updating...' : 'Set New PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
