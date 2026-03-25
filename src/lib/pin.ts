import { WEAK_PINS } from './types';

/** Generate a 6-digit temporary PIN for students */
export function generateTemporaryPin(): string {
  while (true) {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    if (!WEAK_PINS.includes(pin)) {
      return pin;
    }
  }
}

/** Generate a strong temporary password for admin/teacher (12 chars, letters + numbers + special) */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!%&*';
  const all = upper + lower + digits + special;

  // Ensure at least one of each type
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  // Fill remaining 8 chars from the full set
  for (let i = 0; i < 8; i++) {
    required.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
}

/** Validate password strength for admin/teacher */
export function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character (@#$!%&* etc.)';
  return null;
}