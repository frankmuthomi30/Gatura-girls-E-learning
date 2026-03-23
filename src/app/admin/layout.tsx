'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageLoading } from '@/components/Loading';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!data || data.role !== 'admin') { router.push('/login'); return; }
      setProfile(data as Profile);
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading || !profile) return <PageLoading />;

  return (
    <AppShell role="admin" userName={profile.full_name}>
      {children}
    </AppShell>
  );
}
