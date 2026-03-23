import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile) {
    redirect(`/${profile.role}`);
  }

  redirect('/login');
}
