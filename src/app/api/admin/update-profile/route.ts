import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';

export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { full_name } = await request.json();

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  if (full_name.trim().length > 100) {
    return NextResponse.json({ error: 'Name too long' }, { status: 400 });
  }

  const { adminClient, userId } = routeContext;

  const { error } = await adminClient
    .from('profiles')
    .update({ full_name: full_name.trim() })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
