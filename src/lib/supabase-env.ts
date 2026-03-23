const DEFAULT_SUPABASE_URL = 'https://qxiepbqdurkalvqwahxm.supabase.co';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getSupabaseUrl(): string {
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');

  return supabaseUrl || DEFAULT_SUPABASE_URL;
}

export function getSupabasePublishableKey(): string {
  const publishableKey = readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (publishableKey) {
    return publishableKey;
  }

  if (anonKey) {
    return anonKey;
  }

  throw new Error('Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}
