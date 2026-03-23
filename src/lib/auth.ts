import { createClient } from './supabase';
import type { Profile, UserRole } from './types';

/**
 * Convert admission number to the internal email format
 */
export function admissionToEmail(admissionNumber: string): string {
  return `${admissionNumber}@gatura.school`;
}

/**
 * Sign in with admission number and PIN
 */
export async function signIn(admissionNumber: string, pin: string) {
  const supabase = createClient();
  const email = admissionToEmail(admissionNumber);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pin,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return data as Profile;
}

/**
 * Change PIN (password)
 */
export async function changePin(newPin: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPin,
  });

  if (error) throw error;

  // Update must_change_pin flag
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ must_change_pin: false })
      .eq('id', user.id);
  }
}

/**
 * Get the dashboard path for a role
 */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'teacher': return '/teacher';
    case 'student': return '/student';
    default: return '/login';
  }
}
