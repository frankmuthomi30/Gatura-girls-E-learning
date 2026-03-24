import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

type AdminRouteOptions = {
  enforceOrigin?: boolean;
  requireServiceRole?: boolean;
};

type AdminRouteContext = {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  adminClient: SupabaseClient<any, 'public', any>;
  userId: string;
};

function hasValidSameOrigin(request: NextRequest): boolean {
  const requestOrigin = request.nextUrl.origin;
  const originHeader = request.headers.get('origin');

  if (originHeader) {
    return originHeader === requestOrigin;
  }

  const refererHeader = request.headers.get('referer');

  if (!refererHeader) {
    return false;
  }

  try {
    return new URL(refererHeader).origin === requestOrigin;
  } catch {
    return false;
  }
}

export async function requireAdminRoute(
  request: NextRequest,
  options: AdminRouteOptions = {}
): Promise<AdminRouteContext | NextResponse> {
  if (options.enforceOrigin && !hasValidSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const requireServiceRole = options.requireServiceRole ?? true;

  if (requireServiceRole && !serviceRole) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const adminClient = serviceRole
    ? createClient(getSupabaseUrl(), serviceRole)
    : (supabase as unknown as SupabaseClient<any, 'public', any>);

  // Use the admin client for the profile check to bypass RLS
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    supabase,
    adminClient,
    userId: user.id,
  };
}