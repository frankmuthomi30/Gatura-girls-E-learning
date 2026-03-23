'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, getProfile } from '@/lib/auth';
import { getDashboardPath } from '@/lib/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!admissionNumber.trim()) {
      setError('Please enter your admission or staff number');
      return;
    }
    if (!pin.trim() || pin.length < 6) {
      setError('Please enter your 6-digit PIN');
      return;
    }

    setLoading(true);
    try {
      await signIn(admissionNumber.trim(), pin);
      const profile = await getProfile();

      if (!profile) {
        setError('Account not found. Please contact your administrator.');
        return;
      }

      if (profile.must_change_pin) {
        router.push('/change-pin');
      } else {
        router.push(getDashboardPath(profile.role));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('rate limit')) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        setError('Invalid admission number or PIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl justify-end pb-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[36px] border border-white/60 bg-white/50 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_28%)]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.28em] text-gray-500">Gatura Girls Secondary School</p>
            <h1 className="mt-4 text-5xl leading-none text-slate-900">
              Learn,
              <br />
              submit,
              <br />
              track progress.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-gray-600">
              A cleaner academic workspace for students, teachers, and administrators to manage assignments, grades, and live school activity in one place.
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Students</p>
              <p className="mt-2 text-sm text-gray-700">Assignments, grades, and progress insights.</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Teachers</p>
              <p className="mt-2 text-sm text-gray-700">Create work, grade fast, and monitor activity.</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Admin</p>
              <p className="mt-2 text-sm text-gray-700">Control users, subjects, and reporting.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto lg:mx-0 mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primary-light via-primary to-primary-dark shadow-lg shadow-primary/25">
                <span className="text-white text-2xl font-bold">GG</span>
              </div>
              <p className="text-xs uppercase tracking-[0.26em] text-gray-500">Welcome Back</p>
              <h2 className="mt-3 text-4xl text-gray-900">Sign in to your portal</h2>
              <p className="mt-3 text-sm leading-6 text-gray-500">Use your admission number or staff ID and your 6-digit PIN to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="card space-y-5 p-7 sm:p-8">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="admission" className="block text-sm font-medium text-gray-700 mb-2">
                  Admission / Staff Number
                </label>
                <input
                  id="admission"
                  type="text"
                  maxLength={20}
                  placeholder="e.g. 8074 or T001"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value.replace(/\s/g, ''))}
                  className="input-field"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
                    PIN
                  </label>
                  <span className="text-xs text-gray-400">6 digits</span>
                </div>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="6-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="input-field"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="rounded-2xl bg-slate-50/85 px-4 py-4 text-xs leading-6 text-gray-500">
                <p>Students: use your admission number</p>
                <p>Teachers: use your staff ID</p>
                <p>Use the temporary PIN provided by the administrator.</p>
              </div>
            </form>

            <p className="text-center lg:text-left text-xs text-gray-400 mt-6">
              Gatura Girls Secondary School &copy; {new Date().getFullYear()}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
