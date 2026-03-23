const DEFAULT_SUPABASE_URL = 'https://qxiepbqdurkalvqwahxm.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0B6oGINZFghltpKiFfbZpw_nyWzkvwl';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export function getSupabaseUrl(): string {
  return SUPABASE_URL;
}

export function getSupabasePublishableKey(): string {
  return SUPABASE_PUBLISHABLE_KEY;
}
