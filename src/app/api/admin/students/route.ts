import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const routeContext = await requireAdminRoute(request);
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { adminClient } = routeContext;

  const { data } = await adminClient
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('full_name');

  return NextResponse.json({ students: data || [] });
}
