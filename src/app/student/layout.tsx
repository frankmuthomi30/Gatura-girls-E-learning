'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageLoading } from '@/components/Loading';
import type { Profile } from '@/lib/types';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/auth/profile', { cache: 'no-store' });
        if (!response.ok) { router.push('/login'); return; }
        const result = await response.json();
        if (!result.profile || result.profile.role !== 'student') { router.push('/login'); return; }
        setProfile(result.profile as Profile);
      } catch { router.push('/login'); return; }
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading || !profile) return <PageLoading />;

  return (
    <AppShell role="student" userName={profile.full_name}>
      {children}
    </AppShell>
  );
}
