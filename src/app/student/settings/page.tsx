'use client';

import { useState } from 'react';
import { changePin } from '@/lib/auth';
import { WEAK_PINS } from '@/lib/types';
import { LoadingSpinner } from '@/components/Loading';

export default function StudentSettings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPin.length !== 6) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    if (WEAK_PINS.includes(newPin)) {
      setError('That PIN is too easy to guess. Choose a stronger PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      await changePin(newPin);
      setSuccess('PIN changed successfully!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setError('Failed to change PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="page-title">Settings</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold text-lg">Change PIN</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Enter new 6-digit PIN"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="input-field"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Re-enter new PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="input-field"
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <><LoadingSpinner size="sm" /> Updating...</> : 'Change PIN'}
        </button>
      </form>
    </div>
  );
}
