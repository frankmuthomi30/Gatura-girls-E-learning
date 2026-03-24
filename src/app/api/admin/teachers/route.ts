import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

async function getAdminContext() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbClient = serviceKey ? createClient(getSupabaseUrl(), serviceKey) : supabase;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { dbClient };
}

export async function GET() {
  const context = await getAdminContext();
  if ('error' in context) return context.error;
  const { dbClient } = context;

  const { data, error } = await dbClient
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: 'Failed to load teachers' }, { status: 500 });
  }

  return NextResponse.json({ teachers: data || [] });
}
